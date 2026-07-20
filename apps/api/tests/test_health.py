import json

from fastapi.testclient import TestClient

from reviewtrace_api import workflow
from reviewtrace_api.main import app
from reviewtrace_api.workflow import ReviewSourceBatch
from reviewtrace_api.workflow import ScopeSelector
from reviewtrace_api.workflow import TraceableArtifactBuilder
from reviewtrace_api.workflow import WorkflowRunRequest
from reviewtrace_api.workflow import WorkflowRunner
from reviewtrace_api.workflow import analyze_reviews


def test_health_check_identifies_reviewtrace_api():
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "ReviewTrace 后端服务",
    }


def test_model_status_reports_missing_provider_key_without_exposing_secret(monkeypatch):
    monkeypatch.setenv("MODEL_PROVIDER", "deepseek")
    monkeypatch.setenv("MODEL_NAME", "deepseek-v4-flash")
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)

    response = TestClient(app).get("/config/model")

    assert response.status_code == 200
    assert response.json() == {
        "provider": "deepseek",
        "model": "deepseek-v4-flash",
        "keyConfigured": False,
        "modelDrivenAvailable": False,
        "fallbackAvailable": True,
        "message": "未配置 DEEPSEEK_API_KEY，当前将使用确定性兜底分析。",
    }


def test_model_status_reports_configured_provider_without_returning_key(monkeypatch):
    monkeypatch.setenv("MODEL_PROVIDER", "deepseek")
    monkeypatch.setenv("MODEL_NAME", "deepseek-v4-flash")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "secret-value")

    response = TestClient(app).get("/config/model")

    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "deepseek"
    assert body["model"] == "deepseek-v4-flash"
    assert body["keyConfigured"] is True
    assert body["modelDrivenAvailable"] is True
    assert body["fallbackAvailable"] is True
    assert "secret-value" not in response.text


def test_model_status_describes_default_deterministic_analysis(monkeypatch):
    monkeypatch.delenv("MODEL_PROVIDER", raising=False)
    monkeypatch.delenv("MODEL_NAME", raising=False)

    response = TestClient(app).get("/config/model")

    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "stub"
    assert body["model"] == "deterministic-import-summary"
    assert body["modelDrivenAvailable"] is False


def test_workflow_runner_interface_returns_complete_fixture_run():
    runner = WorkflowRunner()

    body = runner.run(
        WorkflowRunRequest(
            appStoreUrl="https://apps.apple.com/us/app/workout-for-women-home-gym/id839285684",
            analysisGoal="关注订阅转化相关投诉",
            sourceMode="fixture",
        )
    )

    assert body["runId"] == "fixture-run-001"
    assert body["findings"][0]["evidence"]
    assert body["requirements"][0]["sourceReviewIds"] == body["findings"][0]["reviewIds"]
    assert body["testCases"][0]["requirementId"] == body["requirements"][0]["id"]
    assert body["traceabilityValidation"]["status"] == "passed"


def test_traceable_artifact_builder_keeps_review_to_test_chain_together():
    reviews = [
        {
            "id": "review-001",
            "rating": 2,
            "title": "订阅说明不清楚",
            "body": "购买前没有看懂价格。",
        }
    ]
    findings = [
        {
            "id": "finding-subscription-copy",
            "title": "订阅说明需要在购买前更清楚地解释。",
            "reviewIds": ["review-001"],
            "sampleCount": 1,
            "confidence": "高",
            "method": "stub",
            "evidence": [
                {
                    "reviewId": "review-001",
                    "excerpt": "订阅说明不清楚：购买前没有看懂价格。",
                }
            ],
            "conflictingEvidence": [],
        }
    ]
    analysis_scope = {
        "requestedGoal": "关注订阅说明",
        "focusSummary": "关注订阅说明",
        "focusAreas": ["付费和订阅路径"],
        "dataSignals": [],
        "constraints": [],
        "uncertaintyNotes": [],
        "scopeReviewIds": ["review-001"],
        "selectionSummary": "保留全部评论。",
        "filteringRules": [],
        "excludedReviewIds": [],
    }

    bundle = TraceableArtifactBuilder().build(
        findings=findings,
        analysis_scope=analysis_scope,
        reviews=reviews,
        analysis_goal="关注订阅说明",
    )

    assert bundle.requirements[0]["findingIds"] == ["finding-subscription-copy"]
    assert bundle.requirements[0]["sourceReviewIds"] == ["review-001"]
    assert bundle.prd["requirements"][0]["id"] == bundle.requirements[0]["id"]
    assert bundle.test_cases[0]["requirementId"] == bundle.requirements[0]["id"]
    assert bundle.traceability_validation == {
        "status": "passed",
        "unsupportedFindingIds": [],
        "unsupportedRequirementIds": [],
        "unsupportedTestCaseIds": [],
    }


def test_scope_selector_returns_selected_reviews_and_scope_facts_together():
    reviews = [
        {
            "id": "subscription-001",
            "rating": 2,
            "title": "订阅说明不清楚",
            "body": "购买前没有看懂价格和取消方式。",
        },
        {
            "id": "workout-001",
            "rating": 5,
            "title": "训练体验不错",
            "body": "课程很适合居家使用。",
        },
    ]

    decision = ScopeSelector().select(reviews, "关注订阅说明")

    assert [review["id"] for review in decision.selected_reviews] == [
        "subscription-001",
        "workout-001",
    ]
    assert decision.analysis_scope["scopeReviewIds"] == [
        "subscription-001",
        "workout-001",
    ]
    assert decision.analysis_scope["excludedReviewIds"] == []
    assert "保留全部评论" in decision.analysis_scope["selectionSummary"]
    assert "付费和订阅路径" in decision.analysis_scope["focusAreas"]
    assert decision.report_details[0] == "范围评论：subscription-001, workout-001"
    assert decision.report_revisions[0].startswith("不确定性：")


def test_analysis_provider_seam_selects_openai_adapter(monkeypatch):
    monkeypatch.setenv("MODEL_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("MODEL_NAME", "gpt-test")

    def fake_openai_response(prompt: str, model: str) -> str:
        assert "review-001" in prompt
        assert model == "gpt-test"
        return """
        {
          "findings": [
            {
              "id": "finding-subscription",
              "title": "订阅说明不清楚。",
              "reviewIds": ["review-001"],
              "sampleCount": 1,
              "confidence": "高",
              "conflictingEvidence": []
            }
          ]
        }
        """

    monkeypatch.setattr(workflow, "call_openai_responses_api", fake_openai_response)

    analysis = analyze_reviews(
        [
            {
                "id": "review-001",
                "rating": 2,
                "title": "订阅说明不清楚",
                "body": "购买前没有看懂价格。",
                "appVersion": "",
            }
        ],
        "关注订阅说明",
    )

    assert analysis["summary"] == {
        "provider": "openai",
        "model": "gpt-test",
        "modelDriven": True,
    }
    assert analysis["findings"][0]["method"] == "openai:gpt-test"


def test_analysis_provider_seam_preserves_deepseek_error(monkeypatch):
    monkeypatch.setenv("MODEL_PROVIDER", "deepseek")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")

    def unavailable_model(prompt: str, model: str) -> str:
        raise RuntimeError("network unavailable")

    monkeypatch.setattr(workflow, "call_deepseek_chat_api", unavailable_model)

    try:
        analyze_reviews(
            [
                {
                    "id": "review-001",
                    "rating": 2,
                    "title": "订阅说明不清楚",
                    "body": "购买前没有看懂价格。",
                    "appVersion": "",
                }
            ],
            "关注订阅说明",
        )
    except Exception as error:
        assert getattr(error, "status_code") == 502
        assert getattr(error, "detail") == (
            "DeepSeek 模型服务不可用，请检查 API key、网络或改用确定性兜底。"
        )
    else:
        raise AssertionError("DeepSeek adapter failure should raise HTTPException")


def test_workflow_runner_accepts_substitutable_review_source_adapter():
    class MemoryReviewSourceAdapter:
        def collect(self, request: WorkflowRunRequest) -> ReviewSourceBatch:
            return ReviewSourceBatch(
                run_id="memory-run-001",
                source={"mode": "memory", "label": "内存评论数据"},
                scope={
                    "appStoreUrl": request.app_store_url,
                    "analysisGoal": request.analysis_goal,
                    "storefront": "us",
                },
                raw_reviews=[
                    {
                        "id": "memory-001",
                        "rating": 2,
                        "title": "说明不清楚",
                        "body": "用户需要更明确的说明。",
                        "appVersion": "",
                        "source": "memory",
                        "rawMetadata": {},
                    }
                ],
                validation_messages=["内存 adapter 已完成。"],
            )

    runner = WorkflowRunner(source_adapters={"memory": MemoryReviewSourceAdapter()})

    body = runner.run(
        WorkflowRunRequest(
            appStoreUrl="https://apps.apple.com/us/app/example/id123456789",
            analysisGoal="关注说明清晰度",
            sourceMode="memory",
        )
    )

    assert body["runId"] == "memory-run-001"
    assert body["source"]["label"] == "内存评论数据"
    assert body["reviews"][0]["id"] == "memory-001"
    assert body["traceabilityValidation"]["status"] == "passed"


def test_fixture_workflow_returns_traceable_artifacts():
    client = TestClient(app)

    response = client.post(
        "/workflow/runs",
        json={
            "appStoreUrl": "https://apps.apple.com/us/app/workout-for-women-home-gym/id839285684",
            "analysisGoal": "关注订阅转化相关投诉",
            "sourceMode": "fixture",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"]["mode"] == "fixture"
    assert body["source"]["label"] == "缓存示例数据集"
    assert body["scope"]["analysisGoal"] == "关注订阅转化相关投诉"
    assert body["stages"] == [
        {"name": "reviews", "status": "complete"},
        {"name": "cleaning", "status": "complete"},
        {"name": "scope", "status": "complete"},
        {"name": "analysis", "status": "complete"},
        {"name": "prd", "status": "complete"},
        {"name": "tests", "status": "complete"},
        {"name": "validation", "status": "complete"},
    ]

    finding = body["findings"][0]
    requirement = body["requirements"][0]
    test_case = body["testCases"][0]
    source_review_ids = {review["id"] for review in body["reviews"]}

    assert finding["reviewIds"]
    assert set(finding["reviewIds"]).issubset(source_review_ids)
    assert finding["sampleCount"] == len(finding["evidence"])
    assert finding["evidence"][0]["reviewId"] == finding["reviewIds"][0]
    assert requirement["findingIds"] == [finding["id"]]
    assert requirement["sourceReviewIds"] == finding["reviewIds"]
    assert requirement["boundaries"]
    assert requirement["acceptanceCriteria"]
    assert body["versionPlan"]["versions"][0]["requirementIds"] == [requirement["id"]]
    assert body["prd"]["requirements"][0]["id"] == requirement["id"]
    assert test_case["requirementId"] == requirement["id"]
    assert test_case["sourceReviewIds"] == finding["reviewIds"]
    assert test_case["verificationPoints"] == requirement["acceptanceCriteria"]
    assert body["traceabilityValidation"] == {
        "status": "passed",
        "unsupportedFindingIds": [],
        "unsupportedRequirementIds": [],
        "unsupportedTestCaseIds": [],
    }
    assert body["analysisScope"]["scopeReviewIds"]
    assert any(
        detail.startswith("范围样本：") for detail in body["stageReports"][2]["details"]
    )
    assert body["stageReports"][4]["details"][0].startswith("PRD 目标：")
    assert body["stageReports"][6]["summary"] == "追溯校验通过"
    assert body["validationMessages"] == [
        "所有发现、需求和测试用例都已关联示例评论证据。"
    ]


def test_workflow_run_can_be_fetched_after_creation():
    client = TestClient(app)

    created_response = client.post(
        "/workflow/runs",
        json={
            "appStoreUrl": "https://apps.apple.com/us/app/workout-for-women-home-gym/id839285684",
            "analysisGoal": "关注订阅转化相关投诉",
            "sourceMode": "fixture",
        },
    )

    assert created_response.status_code == 200
    created = created_response.json()

    detail_response = client.get(f"/workflow/runs/{created['runId']}")
    list_response = client.get("/workflow/runs")

    assert detail_response.status_code == 200
    assert detail_response.json() == created
    assert list_response.status_code == 200
    assert any(
        run["runId"] == created["runId"]
        and run["reviewCount"] == len(created["reviews"])
        and run["status"] == created["traceabilityValidation"]["status"]
        for run in list_response.json()["runs"]
    )


def test_unknown_workflow_run_returns_404():
    response = TestClient(app).get("/workflow/runs/missing-run")

    assert response.status_code == 404
    assert response.json()["detail"] == "未找到指定工作流运行。"


def test_workflow_stream_emits_stage_progress_before_final_run():
    client = TestClient(app)

    with client.stream(
        "POST",
        "/workflow/runs/stream",
        json={
            "appStoreUrl": "https://apps.apple.com/us/app/workout-for-women-home-gym/id839285684",
            "analysisGoal": "关注订阅转化相关投诉",
            "sourceMode": "fixture",
        },
    ) as response:
        assert response.status_code == 200
        events = [
            json.loads(line)
            for line in response.iter_lines()
            if line
        ]

    stage_events = [event for event in events if event["type"] == "stage"]
    report_events = [event for event in events if event["type"] == "report"]
    final_events = [event for event in events if event["type"] == "run"]

    assert stage_events[0]["stage"] == {"name": "reviews", "status": "running"}
    assert any(
        event["stage"] == {"name": "analysis", "status": "running"}
        for event in stage_events
    )
    assert report_events[0]["report"]["name"] == "reviews"
    assert final_events[0] == events[-1]
    assert final_events[0]["run"]["runId"] == "fixture-run-001"
    assert final_events[0]["run"]["analysisScope"]["selectionSummary"]
    assert final_events[0]["run"]["analysisScope"]["filteringRules"]

    detail_response = client.get("/workflow/runs/fixture-run-001")

    assert detail_response.status_code == 200
    assert detail_response.json() == final_events[0]["run"]


def test_live_app_store_reviews_run_through_same_workflow(monkeypatch):
    client = TestClient(app)

    def fake_app_store_reviews(app_id: str, storefront: str) -> list[dict[str, object]]:
        assert app_id == "839285684"
        assert storefront == "us"
        return [
            {
                "id": "live-001",
                "rating": 2,
                "title": "订阅说明不清楚",
                "body": "购买前没有看懂价格和取消方式。",
                "appVersion": "8.4.27",
                "source": "app-store",
            },
            {
                "id": "live-002",
                "rating": 5,
                "title": "训练内容不错",
                "body": "居家训练课程很方便。",
                "appVersion": "8.4.27",
                "source": "app-store",
            },
        ]

    monkeypatch.setattr(workflow, "fetch_app_store_reviews", fake_app_store_reviews)

    response = client.post(
        "/workflow/runs",
        json={
            "appStoreUrl": "https://apps.apple.com/us/app/workout-for-women-home-gym/id839285684",
            "analysisGoal": "关注订阅转化",
            "sourceMode": "live",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == {
        "mode": "live",
        "label": "U.S. App Store 最新评论",
    }
    assert body["scope"]["storefront"] == "us"
    assert [review["id"] for review in body["reviews"]] == ["live-001", "live-002"]
    assert body["requirements"][0]["sourceReviewIds"] == ["live-001", "live-002"]
    assert body["testCases"][0]["sourceReviewIds"] == ["live-001", "live-002"]


def test_live_empty_review_source_does_not_fabricate_findings(monkeypatch):
    client = TestClient(app)

    monkeypatch.setattr(workflow, "fetch_app_store_reviews", lambda app_id, storefront: [])

    response = client.post(
        "/workflow/runs",
        json={
            "appStoreUrl": "https://apps.apple.com/us/app/example/id123456789",
            "analysisGoal": "关注订阅转化",
            "sourceMode": "live",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["reviews"] == []
    assert body["findings"] == []
    assert body["requirements"] == []
    assert body["testCases"] == []
    assert body["dataLimitations"] == ["没有获取到可分析评论，请检查链接或改用导入评论。"]
    assert body["traceabilityValidation"] == {
        "status": "passed",
        "unsupportedFindingIds": [],
        "unsupportedRequirementIds": [],
        "unsupportedTestCaseIds": [],
    }


def test_live_app_store_flow_requires_us_app_store_link():
    client = TestClient(app)

    response = client.post(
        "/workflow/runs",
        json={
            "appStoreUrl": "https://apps.apple.com/cn/app/example/id123456789",
            "analysisGoal": "关注订阅转化",
            "sourceMode": "live",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "当前仅支持 U.S. App Store 链接。"


def test_live_app_store_reviews_use_review_page(monkeypatch):
    payload = {
        "feed": {
            "entry": [
                {
                    "author": {"name": {"label": "用户A"}},
                    "updated": {"label": "2026-07-18T20:45:41-07:00"},
                    "im:rating": {"label": "5"},
                    "im:version": {"label": "8.4.27"},
                    "id": {"label": "review-001"},
                    "title": {"label": "很好"},
                    "content": {"label": "内容不错"},
                }
            ]
        }
    }

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            import json

            return json.dumps(payload).encode("utf-8")

    def fake_urlopen(request, timeout=20):
        assert "page=2" in request.full_url
        return FakeResponse()

    monkeypatch.setattr(workflow.urllib.request, "urlopen", fake_urlopen)

    reviews = workflow.fetch_app_store_reviews("839285684", "us")

    assert [review["id"] for review in reviews] == ["review-001"]


def test_workflow_rejects_unknown_source_mode():
    client = TestClient(app)

    response = client.post(
        "/workflow/runs",
        json={
            "appStoreUrl": "https://apps.apple.com/us/app/example/id123456789",
            "analysisGoal": "关注订阅转化",
            "sourceMode": "liv",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "sourceMode 必须是 live、fixture 或 import。"


def test_imported_json_reviews_run_through_workflow():
    client = TestClient(app)

    response = client.post(
        "/workflow/runs",
        json={
            "appStoreUrl": "https://apps.apple.com/us/app/example/id123456789",
            "analysisGoal": "关注低评分评论",
            "sourceMode": "import",
            "datasetFormat": "json",
            "datasetText": """
            {
              "reviews": [
                {
                  "id": "json-001",
                  "rating": 1,
                  "title": "训练计划太突然",
                  "body": "低评分用户觉得新手训练没有解释清楚。",
                  "appVersion": "1.2.0",
                  "date": "2026-07-01T00:00:00Z",
                  "locale": "zh-CN",
                  "appId": "123456789"
                },
                {
                  "id": "json-002",
                  "rating": 5,
                  "title": "课程不错",
                  "body": "训练内容很适合居家使用。",
                  "appVersion": "1.2.0"
                }
              ]
            }
            """,
        },
    )

    assert response.status_code == 200
    body = response.json()

    assert body["source"] == {
        "mode": "import",
        "label": "导入的 JSON 数据集",
    }
    assert body["cleaningSummary"] == {
        "inputCount": 2,
        "retainedCount": 2,
        "duplicateCount": 0,
        "discardedEmptyCount": 0,
    }
    assert body["ratingSummary"] == {
        "averageRating": 3.0,
        "ratingCounts": {"1": 1, "5": 1},
    }
    assert [review["id"] for review in body["reviews"]] == ["json-001", "json-002"]
    assert body["reviews"][0]["date"] == "2026-07-01T00:00:00Z"
    assert body["reviews"][0]["locale"] == "zh-CN"
    assert body["reviews"][0]["appId"] == "123456789"
    assert body["reviews"][0]["rawMetadata"]["id"] == "json-001"
    assert body["findings"][0]["reviewIds"] == ["json-001", "json-002"]
    assert body["findings"][0]["evidence"][0] == {
        "reviewId": "json-001",
        "excerpt": "训练计划太突然：低评分用户觉得新手训练没有解释清楚。",
    }
    assert body["validationMessages"] == [
        "导入数据已完成结构化、清洗和基础统计，后续语义分析会在模型阶段替换当前占位结果。"
    ]
    assert body["analysisSummary"] == {
        "provider": "stub",
        "model": "deterministic-import-summary",
        "modelDriven": False,
    }
    requirement = body["requirements"][0]
    test_case = body["testCases"][0]
    assert requirement["findingIds"] == [body["findings"][0]["id"]]
    assert requirement["sourceReviewIds"] == ["json-001", "json-002"]
    assert requirement["assumption"] is False
    assert test_case["requirementId"] == requirement["id"]
    assert test_case["sourceReviewIds"] == requirement["sourceReviewIds"]
    assert "json-001, json-002" in test_case["steps"][0]
    assert requirement["title"].rstrip("。") in test_case["steps"][1]
    assert "源评论" in test_case["expectedResult"]
    assert body["versionPlan"]["versions"][0]["name"] == "版本 1：证据支撑的核心改进"
    assert body["prd"]["objective"] == "围绕「关注低评分评论」回应已导入评论中的高证据问题。"
    assert body["analysisScope"]["requestedGoal"] == "关注低评分评论"
    assert "低评分反馈" in body["analysisScope"]["focusAreas"]
    assert body["analysisScope"]["scopeReviewIds"] == ["json-001", "json-002"]
    assert body["prd"]["scopeSummary"] == body["analysisScope"]
    assert [report["name"] for report in body["stageReports"]] == [
        "reviews",
        "cleaning",
        "scope",
        "analysis",
        "prd",
        "tests",
        "validation",
    ]
    assert body["stageReports"][2]["summary"] == "关注低评分评论"


def test_imported_csv_reviews_run_through_workflow():
    client = TestClient(app)

    response = client.post(
        "/workflow/runs",
        json={
            "appStoreUrl": "https://apps.apple.com/us/app/example/id123456789",
            "analysisGoal": "关注订阅相关反馈",
            "sourceMode": "import",
            "datasetFormat": "csv",
            "datasetText": "\n".join(
                [
                    "id,rating,title,body,appVersion",
                    "csv-001,2,订阅说明不清楚,价格和取消方式需要更明确,2.0.0",
                    "csv-002,4,训练体验不错,动作提示很清晰,2.0.0",
                ]
            ),
        },
    )

    assert response.status_code == 200
    body = response.json()

    assert body["source"]["label"] == "导入的 CSV 数据集"
    assert body["reviews"][0]["id"] == "csv-001"
    assert body["reviews"][0]["title"] == "订阅说明不清楚"
    assert body["ratingSummary"]["averageRating"] == 3.0


def test_imported_reviews_are_cleaned_and_deduplicated():
    client = TestClient(app)

    response = client.post(
        "/workflow/runs",
        json={
            "appStoreUrl": "https://apps.apple.com/us/app/example/id123456789",
            "analysisGoal": "关注重复和空评论处理",
            "sourceMode": "import",
            "datasetFormat": "json",
            "datasetText": """
            {
              "reviews": [
                {
                  "id": "dup-001",
                  "rating": 2,
                  "title": "订阅说明不清楚",
                  "body": "价格和取消方式需要更明确。"
                },
                {
                  "id": "dup-002",
                  "rating": 2,
                  "title": "  订阅说明不清楚  ",
                  "body": "价格和取消方式需要更明确。"
                },
                {
                  "id": "empty-001",
                  "rating": 5,
                  "title": "",
                  "body": ""
                },
                {
                  "id": "unique-001",
                  "rating": 4,
                  "title": "训练体验不错",
                  "body": "动作提示很清晰。"
                }
              ]
            }
            """,
        },
    )

    assert response.status_code == 200
    body = response.json()

    assert len(body["rawReviews"]) == 4
    assert body["cleaningSummary"] == {
        "inputCount": 4,
        "retainedCount": 2,
        "duplicateCount": 1,
        "discardedEmptyCount": 1,
    }
    assert [review["id"] for review in body["reviews"]] == ["dup-001", "unique-001"]
    assert body["ratingSummary"] == {
        "averageRating": 3.0,
        "ratingCounts": {"2": 1, "4": 1},
    }


def test_openai_provider_can_drive_semantic_findings(monkeypatch):
    client = TestClient(app)

    monkeypatch.setenv("MODEL_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("MODEL_NAME", "gpt-5.6-sol")

    def fake_openai_response(prompt: str, model: str) -> str:
        assert "json-001" in prompt
        assert model == "gpt-5.6-sol"
        return """
        {
          "scope": {
            "focusSummary": "新手训练入口解释不足",
            "focusAreas": ["新手训练可用性"],
            "dataSignals": ["低评分评论明确提到解释不足"],
            "constraints": ["仅覆盖新手训练开始前体验"],
            "uncertaintyNotes": ["样本量为 1 条"]
          },
          "findings": [
            {
              "id": "finding-onboarding-clarity",
              "title": "新手训练开始前缺少足够解释。",
              "reviewIds": ["json-001"],
              "sampleCount": 1,
              "confidence": "高",
              "conflictingEvidence": []
            }
          ]
        }
        """

    monkeypatch.setattr(workflow, "call_openai_responses_api", fake_openai_response)

    response = client.post(
        "/workflow/runs",
        json={
            "appStoreUrl": "https://apps.apple.com/us/app/example/id123456789",
            "analysisGoal": "关注新手训练可用性",
            "sourceMode": "import",
            "datasetFormat": "json",
            "datasetText": """
            {
              "reviews": [
                {
                  "id": "json-001",
                  "rating": 1,
                  "title": "训练计划太突然",
                  "body": "低评分用户觉得新手训练没有解释清楚。"
                }
              ]
            }
            """,
        },
    )

    assert response.status_code == 200
    body = response.json()

    assert body["analysisSummary"] == {
        "provider": "openai",
        "model": "gpt-5.6-sol",
        "modelDriven": True,
    }
    assert {
        key: body["analysisScope"][key]
        for key in [
            "requestedGoal",
            "focusSummary",
            "focusAreas",
            "dataSignals",
            "constraints",
            "uncertaintyNotes",
            "scopeReviewIds",
        ]
    } == {
        "requestedGoal": "关注新手训练可用性",
        "focusSummary": "新手训练入口解释不足",
        "focusAreas": ["新手训练可用性"],
        "dataSignals": ["低评分评论明确提到解释不足"],
        "constraints": ["仅覆盖新手训练开始前体验"],
        "uncertaintyNotes": ["样本量为 1 条"],
        "scopeReviewIds": ["json-001"],
    }
    assert body["analysisScope"]["selectionSummary"] == (
        "清洗后只有 1 条评论，系统保留全部评论以避免过度过滤。"
    )
    assert body["analysisScope"]["filteringRules"]
    assert body["analysisScope"]["excludedReviewIds"] == []
    assert body["findings"] == [
        {
            "id": "finding-onboarding-clarity",
            "title": "新手训练开始前缺少足够解释。",
            "reviewIds": ["json-001"],
            "sampleCount": 1,
            "confidence": "高",
            "method": "openai:gpt-5.6-sol",
            "conflictingEvidence": [],
            "evidence": [
                {
                    "reviewId": "json-001",
                    "excerpt": "训练计划太突然：低评分用户觉得新手训练没有解释清楚。",
                }
            ],
        }
    ]


def test_deepseek_provider_can_drive_semantic_findings(monkeypatch):
    client = TestClient(app)

    monkeypatch.setenv("MODEL_PROVIDER", "deepseek")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setenv("MODEL_NAME", "deepseek-v4-flash")

    def fake_deepseek_response(prompt: str, model: str) -> str:
        assert "json-001" in prompt
        assert model == "deepseek-v4-flash"
        return """
        {
          "findings": [
            {
              "id": "finding-subscription-copy",
              "title": "订阅说明需要在购买前更清楚地解释。",
              "reviewIds": ["json-001"],
              "sampleCount": 1,
              "confidence": "高",
              "conflictingEvidence": []
            }
          ]
        }
        """

    monkeypatch.setattr(workflow, "call_deepseek_chat_api", fake_deepseek_response)

    response = client.post(
        "/workflow/runs",
        json={
            "appStoreUrl": "https://apps.apple.com/us/app/example/id123456789",
            "analysisGoal": "关注订阅说明",
            "sourceMode": "import",
            "datasetFormat": "json",
            "datasetText": """
            {
              "reviews": [
                {
                  "id": "json-001",
                  "rating": 2,
                  "title": "订阅说明不清楚",
                  "body": "购买前没有看懂价格和取消方式。"
                }
              ]
            }
            """,
        },
    )

    assert response.status_code == 200
    body = response.json()

    assert body["analysisSummary"] == {
        "provider": "deepseek",
        "model": "deepseek-v4-flash",
        "modelDriven": True,
    }
    assert body["findings"][0]["method"] == "deepseek:deepseek-v4-flash"
    assert body["findings"][0]["reviewIds"] == ["json-001"]


def test_deepseek_provider_without_api_key_falls_back_to_stub(monkeypatch):
    client = TestClient(app)

    monkeypatch.setenv("MODEL_PROVIDER", "deepseek")
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.delenv("MODEL_NAME", raising=False)

    def unexpected_deepseek_call(prompt: str, model: str) -> str:
        raise AssertionError("缺少 DEEPSEEK_API_KEY 时不应调用 DeepSeek API")

    monkeypatch.setattr(workflow, "call_deepseek_chat_api", unexpected_deepseek_call)

    response = client.post(
        "/workflow/runs",
        json={
            "appStoreUrl": "https://apps.apple.com/us/app/example/id123456789",
            "analysisGoal": "关注订阅说明",
            "sourceMode": "import",
            "datasetFormat": "json",
            "datasetText": """
            {
              "reviews": [
                {
                  "id": "json-001",
                  "rating": 2,
                  "title": "订阅说明不清楚",
                  "body": "购买前没有看懂价格和取消方式。"
                }
              ]
            }
            """,
        },
    )

    assert response.status_code == 200
    assert response.json()["analysisSummary"] == {
        "provider": "stub",
        "model": "deterministic-import-summary",
        "modelDriven": False,
    }


def test_openai_provider_failure_returns_recoverable_error(monkeypatch):
    client = TestClient(app)

    monkeypatch.setenv("MODEL_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    def unavailable_model(prompt: str, model: str) -> str:
        raise RuntimeError("network unavailable")

    monkeypatch.setattr(workflow, "call_openai_responses_api", unavailable_model)

    response = client.post(
        "/workflow/runs",
        json={
            "appStoreUrl": "https://apps.apple.com/us/app/example/id123456789",
            "analysisGoal": "关注新手训练可用性",
            "sourceMode": "import",
            "datasetFormat": "json",
            "datasetText": """
            {
              "reviews": [
                {
                  "id": "json-001",
                  "rating": 1,
                  "title": "训练计划太突然",
                  "body": "低评分用户觉得新手训练没有解释清楚。"
                }
              ]
            }
            """,
        },
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "模型服务不可用，请检查 API key、网络或改用确定性兜底。"


def test_deepseek_provider_failure_returns_recoverable_error(monkeypatch):
    client = TestClient(app)

    monkeypatch.setenv("MODEL_PROVIDER", "deepseek")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")

    def unavailable_model(prompt: str, model: str) -> str:
        raise RuntimeError("network unavailable")

    monkeypatch.setattr(workflow, "call_deepseek_chat_api", unavailable_model)

    response = client.post(
        "/workflow/runs",
        json={
            "appStoreUrl": "https://apps.apple.com/us/app/example/id123456789",
            "analysisGoal": "关注订阅说明",
            "sourceMode": "import",
            "datasetFormat": "json",
            "datasetText": """
            {
              "reviews": [
                {
                  "id": "json-001",
                  "rating": 2,
                  "title": "订阅说明不清楚",
                  "body": "购买前没有看懂价格和取消方式。"
                }
              ]
            }
            """,
        },
    )

    assert response.status_code == 502
    assert response.json()["detail"] == (
        "DeepSeek 模型服务不可用，请检查 API key、网络或改用确定性兜底。"
    )


def test_findings_include_conflicts_data_limits_and_traceability_validation():
    client = TestClient(app)

    response = client.post(
        "/workflow/runs",
        json={
            "appStoreUrl": "https://apps.apple.com/us/app/example/id123456789",
            "analysisGoal": "关注订阅说明",
            "sourceMode": "import",
            "datasetFormat": "json",
            "datasetText": """
            {
              "reviews": [
                {
                  "id": "low-001",
                  "rating": 1,
                  "title": "订阅说明不清楚",
                  "body": "低评分用户认为价格和取消方式需要更明确。"
                },
                {
                  "id": "high-001",
                  "rating": 5,
                  "title": "订阅说明很清楚",
                  "body": "高评分用户认为订阅说明足够透明。"
                }
              ]
            }
            """,
        },
    )

    assert response.status_code == 200
    body = response.json()

    finding = body["findings"][0]
    assert finding["sampleCount"] == 2
    assert finding["evidence"] == [
        {
            "reviewId": "low-001",
            "excerpt": "订阅说明不清楚：低评分用户认为价格和取消方式需要更明确。",
        },
        {
            "reviewId": "high-001",
            "excerpt": "订阅说明很清楚：高评分用户认为订阅说明足够透明。",
        },
    ]
    assert finding["conflictingEvidence"] == [
        {
            "reviewId": "high-001",
            "excerpt": "订阅说明很清楚：高评分用户认为订阅说明足够透明。",
        }
    ]
    assert body["dataLimitations"] == ["样本量较小，当前结论应视为方向性信号。"]
    assert body["traceabilityValidation"] == {
        "status": "passed",
        "unsupportedFindingIds": [],
        "unsupportedRequirementIds": [],
        "unsupportedTestCaseIds": [],
    }


def test_traceability_validation_flags_unsupported_test_cases(monkeypatch):
    client = TestClient(app)

    def unsupported_test_case(requirements: list[dict[str, object]]) -> list[dict[str, object]]:
        return [
            {
                "id": "test-unsupported-review-link",
                "title": "验证：错误来源评论链路",
                "requirementId": requirements[0]["id"],
                "sourceReviewIds": ["ghost-review"],
                "steps": ["错误地引用不存在的源评论。"],
                "expectedResult": "这个用例应该被追溯校验拦截。",
            }
        ]

    monkeypatch.setattr(workflow, "generate_test_cases", unsupported_test_case)

    response = client.post(
        "/workflow/runs",
        json={
            "appStoreUrl": "https://apps.apple.com/us/app/example/id123456789",
            "analysisGoal": "关注订阅说明",
            "sourceMode": "import",
            "datasetFormat": "json",
            "datasetText": """
            {
              "reviews": [
                {
                  "id": "json-001",
                  "rating": 1,
                  "title": "订阅说明不清楚",
                  "body": "价格和取消方式需要更明确。"
                }
              ]
            }
            """,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["traceabilityValidation"]["status"] == "failed"
    assert body["traceabilityValidation"]["unsupportedTestCaseIds"] == [
        "test-unsupported-review-link"
    ]
