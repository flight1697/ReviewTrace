from fastapi.testclient import TestClient

from reviewtrace_api import main
from reviewtrace_api.main import app


def test_health_check_identifies_reviewtrace_api():
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "ReviewTrace 后端服务",
    }


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
        {"name": "scope", "status": "complete"},
        {"name": "reviews", "status": "complete"},
        {"name": "cleaning", "status": "complete"},
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
    assert requirement["findingIds"] == [finding["id"]]
    assert test_case["requirementId"] == requirement["id"]
    assert test_case["sourceReviewIds"] == finding["reviewIds"]
    assert body["validationMessages"] == [
        "所有发现、需求和测试用例都已关联示例评论证据。"
    ]


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
                  "appVersion": "1.2.0"
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
    assert body["findings"][0]["reviewIds"] == ["json-001", "json-002"]
    assert body["validationMessages"] == [
        "导入数据已完成结构化、清洗和基础统计，后续语义分析会在模型阶段替换当前占位结果。"
    ]
    assert body["analysisSummary"] == {
        "provider": "stub",
        "model": "deterministic-import-summary",
        "modelDriven": False,
    }


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

    monkeypatch.setattr(main, "call_openai_responses_api", fake_openai_response)

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
    assert body["findings"] == [
        {
            "id": "finding-onboarding-clarity",
            "title": "新手训练开始前缺少足够解释。",
            "reviewIds": ["json-001"],
            "sampleCount": 1,
            "confidence": "高",
            "method": "openai:gpt-5.6-sol",
            "conflictingEvidence": [],
        }
    ]
