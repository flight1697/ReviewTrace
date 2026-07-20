import csv
import io
import json
import os
import re
import urllib.error
import urllib.request
from collections.abc import Callable
from collections.abc import Iterator
from collections import Counter
from dataclasses import dataclass
from typing import Any
from typing import Protocol
from urllib.parse import urlparse

from fastapi import HTTPException
from pydantic import BaseModel, Field

from reviewtrace_api.artifacts import validated_workflow_run


STAGE_STATUS_COMPLETE = "complete"
STAGE_STATUS_FAILED = "failed"
STAGE_STATUS_PENDING = "pending"
STAGE_STATUS_RUNNING = "running"

WORKFLOW_STAGE_NAMES = [
    "reviews",
    "cleaning",
    "scope",
    "analysis",
    "prd",
    "tests",
    "validation",
]
WORKFLOW_PROGRESS_SEQUENCE = [
    "reviews",
    "cleaning",
    "scope",
    "analysis",
    "prd",
    "tests",
    "validation",
]


class WorkflowRunRequest(BaseModel):
    app_store_url: str = Field(alias="appStoreUrl")
    analysis_goal: str = Field(default="", alias="analysisGoal")
    source_mode: str = Field(default="live", alias="sourceMode")
    dataset_format: str | None = Field(default=None, alias="datasetFormat")
    dataset_text: str | None = Field(default=None, alias="datasetText")


@dataclass(frozen=True)
class ReviewSourceBatch:
    run_id: str
    source: dict[str, object]
    scope: dict[str, object]
    raw_reviews: list[dict[str, object]]
    validation_messages: list[str]
    analysis_override: Callable[[list[dict[str, object]]], dict[str, object]] | None = None


@dataclass(frozen=True)
class TraceableArtifactBundle:
    requirements: list[dict[str, object]]
    version_plan: dict[str, object]
    prd: dict[str, object]
    test_cases: list[dict[str, object]]
    traceability_validation: dict[str, object]


@dataclass(frozen=True)
class ScopeDecision:
    selected_reviews: list[dict[str, object]]
    analysis_scope: dict[str, object]
    report_details: list[str]
    report_revisions: list[str]


class ReviewSourceAdapter(Protocol):
    def collect(self, request: WorkflowRunRequest) -> ReviewSourceBatch:
        pass


class WorkflowRunner:
    """Runs the complete ReviewTrace workflow behind one interface."""

    def __init__(
        self,
        source_adapters: dict[str, ReviewSourceAdapter] | None = None,
    ) -> None:
        self.source_adapters = source_adapters or {
            "live": LiveReviewSourceAdapter(),
            "import": ImportedReviewSourceAdapter(),
        }

    def run(self, request: WorkflowRunRequest) -> dict[str, object]:
        return run_review_workflow(request, self.source_adapters)

    def stream(self, request: WorkflowRunRequest) -> Iterator[dict[str, object]]:
        return run_review_workflow_events(request, self.source_adapters)


class LiveReviewSourceAdapter:
    def collect(self, request: WorkflowRunRequest) -> ReviewSourceBatch:
        app_id, storefront = parse_us_app_store_url(request.app_store_url)
        raw_reviews = fetch_app_store_reviews(app_id, storefront)

        return ReviewSourceBatch(
            run_id=f"live-{app_id}",
            source={
                "mode": "live",
                "label": "U.S. App Store 最新评论",
            },
            scope={
                "appStoreUrl": request.app_store_url,
                "analysisGoal": request.analysis_goal,
                "storefront": storefront,
            },
            raw_reviews=raw_reviews,
            validation_messages=[
                "已从 Apple RSS 评论源获取最新公开评论；若评论数量较少，请结合导入数据复核。"
            ],
        )

class ImportedReviewSourceAdapter:
    def collect(self, request: WorkflowRunRequest) -> ReviewSourceBatch:
        dataset_format = (request.dataset_format or "").lower()
        dataset_text = request.dataset_text or ""

        if not dataset_text.strip():
            raise HTTPException(status_code=400, detail="导入数据不能为空。")

        return ReviewSourceBatch(
            run_id="import-run-001",
            source={
                "mode": "import",
                "label": f"导入的 {dataset_format.upper()} 数据集",
            },
            scope={
                "appStoreUrl": request.app_store_url,
                "analysisGoal": request.analysis_goal,
                "storefront": "us",
            },
            raw_reviews=parse_imported_reviews(dataset_format, dataset_text),
            validation_messages=[
                "导入数据已完成结构化、清洗和基础统计，后续语义分析由后端模型能力生成。"
            ],
        )


def run_review_workflow(
    request: WorkflowRunRequest,
    source_adapters: dict[str, ReviewSourceAdapter],
) -> dict[str, object]:
    source_adapter = source_adapters.get(request.source_mode)
    if not source_adapter:
        raise HTTPException(status_code=400, detail="sourceMode 必须是 live 或 import。")

    batch = source_adapter.collect(request)
    workflow = complete_review_workflow(
        batch.raw_reviews,
        request.analysis_goal,
        batch.analysis_override,
    )

    return workflow_run_payload(
        run_id=batch.run_id,
        source=batch.source,
        scope=batch.scope,
        raw_reviews=batch.raw_reviews,
        workflow=workflow,
        validation_messages=batch.validation_messages,
    )


def run_review_workflow_events(
    request: WorkflowRunRequest,
    source_adapters: dict[str, ReviewSourceAdapter],
) -> Iterator[dict[str, object]]:
    source_adapter = source_adapters.get(request.source_mode)
    if not source_adapter:
        raise HTTPException(status_code=400, detail="sourceMode 必须是 live 或 import。")

    yield stage_event("reviews", STAGE_STATUS_RUNNING)
    batch = source_adapter.collect(request)
    yield stage_event("reviews", STAGE_STATUS_COMPLETE)
    yield report_event(
        "reviews",
        STAGE_STATUS_COMPLETE,
        f"收集到 {len(batch.raw_reviews)} 条原始评论。",
        [
            f"数据源：{batch.source['label']}",
            f"分析目标：{batch.scope['analysisGoal']}",
        ],
    )

    workflow: dict[str, object] | None = None
    for event in complete_review_workflow_events(
        batch.raw_reviews,
        request.analysis_goal,
        batch.analysis_override,
    ):
        if event["type"] == "workflow":
            workflow = event["workflow"]  # type: ignore[assignment]
        else:
            yield event

    if workflow is None:
        raise HTTPException(status_code=500, detail="工作流没有生成最终结果。")

    yield {
        "type": "run",
        "run": workflow_run_payload(
            run_id=batch.run_id,
            source=batch.source,
            scope=batch.scope,
            raw_reviews=batch.raw_reviews,
            workflow=workflow,
            validation_messages=batch.validation_messages,
        ),
    }


def complete_review_workflow_events(
    raw_reviews: list[dict[str, object]],
    analysis_goal: str,
    analysis_override: Any | None = None,
) -> Iterator[dict[str, object]]:
    yield stage_event("cleaning", STAGE_STATUS_RUNNING)
    cleaning_result = clean_reviews(raw_reviews)
    reviews = cleaning_result["reviews"]
    yield stage_event("cleaning", STAGE_STATUS_COMPLETE)
    yield report_event(
        "cleaning",
        STAGE_STATUS_COMPLETE,
        f"清洗后保留 {len(reviews)} 条评论。",
        [
            f"输入：{cleaning_result['summary']['inputCount']} 条",
            f"去重：{cleaning_result['summary']['duplicateCount']} 条",
            f"移除空评论：{cleaning_result['summary']['discardedEmptyCount']} 条",
        ],
    )

    yield stage_event("scope", STAGE_STATUS_RUNNING)
    scope_selector = ScopeSelector()
    scope_decision = scope_selector.select(reviews, analysis_goal)
    scope_reviews = scope_decision.selected_reviews
    default_scope = scope_decision.analysis_scope
    yield stage_event("scope", STAGE_STATUS_COMPLETE)
    yield report_event(
        "scope",
        STAGE_STATUS_COMPLETE,
        str(default_scope["selectionSummary"]),
        scope_decision.report_details,
        revisions=scope_decision.report_revisions,
    )

    yield stage_event("analysis", STAGE_STATUS_RUNNING)
    analysis = (
        analysis_override(scope_reviews)
        if analysis_override
        else analyze_reviews(scope_reviews, analysis_goal)
    )
    analysis_scope = scope_selector.normalize(
        analysis.get("scope"),
        analysis_goal,
        scope_reviews,
        reviews,
    )
    findings = enrich_findings_with_evidence(analysis["findings"], reviews)
    yield stage_event("analysis", STAGE_STATUS_COMPLETE)
    yield report_event(
        "analysis",
        STAGE_STATUS_COMPLETE,
        f"{analysis['summary']['provider']} / {analysis['summary']['model']} 生成 {len(findings)} 个发现。",
        [
            "模型驱动" if analysis["summary"]["modelDriven"] else "未配置模型，未生成发现",
            *[f"发现：{finding['title']}" for finding in findings[:3]],
        ],
    )

    yield stage_event("prd", STAGE_STATUS_RUNNING)
    artifact_bundle = TraceableArtifactBuilder(
        test_case_generator=generate_test_cases,
    ).build(
        findings=findings,
        analysis_scope=analysis_scope,
        reviews=reviews,
        analysis_goal=analysis_goal,
    )
    requirements = artifact_bundle.requirements
    version_plan = artifact_bundle.version_plan
    prd = artifact_bundle.prd
    yield stage_event("prd", STAGE_STATUS_COMPLETE)
    yield report_event(
        "prd",
        STAGE_STATUS_COMPLETE,
        f"生成 {len(requirements)} 条需求，拆分为 {len(version_plan['versions'])} 个版本。",
        [f"PRD 目标：{prd['objective']}"],
        revisions=[*[f"版本：{version['name']}" for version in version_plan["versions"]]],
    )

    yield stage_event("tests", STAGE_STATUS_RUNNING)
    test_cases = artifact_bundle.test_cases
    yield stage_event("tests", STAGE_STATUS_COMPLETE)
    yield report_event(
        "tests",
        STAGE_STATUS_COMPLETE,
        f"生成 {len(test_cases)} 个 QA 测试用例。",
        [*[f"测试：{test_case['title']}" for test_case in test_cases[:3]]],
        revisions=[
            "只为非假设需求生成测试用例。",
            "测试步骤直接引用源评论编号与需求边界。",
        ],
    )

    yield stage_event("validation", STAGE_STATUS_RUNNING)
    traceability_validation = artifact_bundle.traceability_validation
    yield stage_event("validation", STAGE_STATUS_COMPLETE)
    yield report_event(
        "validation",
        STAGE_STATUS_COMPLETE,
        (
            "追溯校验通过"
            if traceability_validation["status"] == "passed"
            else "追溯校验未通过"
        ),
        [
            f"未通过发现：{len(traceability_validation['unsupportedFindingIds'])}",
            f"未通过需求：{len(traceability_validation['unsupportedRequirementIds'])}",
            f"未通过测试：{len(traceability_validation['unsupportedTestCaseIds'])}",
        ],
        errors=[
            *traceability_validation["unsupportedFindingIds"],
            *traceability_validation["unsupportedRequirementIds"],
            *traceability_validation["unsupportedTestCaseIds"],
        ],
    )

    workflow = workflow_from_parts(
        raw_reviews=raw_reviews,
        reviews=reviews,
        scope_reviews=scope_reviews,
        cleaning_summary=cleaning_result["summary"],
        analysis_summary=analysis["summary"],
        analysis_scope=analysis_scope,
        findings=findings,
        requirements=requirements,
        version_plan=version_plan,
        prd=prd,
        test_cases=test_cases,
        traceability_validation=traceability_validation,
    )

    yield {
        "type": "workflow",
        "workflow": workflow,
    }


def complete_review_workflow(
    raw_reviews: list[dict[str, object]],
    analysis_goal: str,
    analysis_override: Any | None = None,
) -> dict[str, object]:
    for event in complete_review_workflow_events(
        raw_reviews,
        analysis_goal,
        analysis_override,
    ):
        if event["type"] == "workflow":
            return event["workflow"]  # type: ignore[return-value]

    raise HTTPException(status_code=500, detail="工作流没有生成最终结果。")


def workflow_from_parts(
    raw_reviews: list[dict[str, object]],
    reviews: list[dict[str, object]],
    scope_reviews: list[dict[str, object]],
    cleaning_summary: dict[str, object],
    analysis_summary: dict[str, object],
    analysis_scope: dict[str, object],
    findings: list[dict[str, object]],
    requirements: list[dict[str, object]],
    version_plan: dict[str, object],
    prd: dict[str, object],
    test_cases: list[dict[str, object]],
    traceability_validation: dict[str, object],
) -> dict[str, object]:
    stage_reports = build_stage_reports(
        raw_reviews=raw_reviews,
        reviews=reviews,
        scope_reviews=scope_reviews,
        cleaning_summary=cleaning_summary,
        analysis_summary=analysis_summary,
        analysis_scope=analysis_scope,
        findings=findings,
        requirements=requirements,
        version_plan=version_plan,
        prd=prd,
        test_cases=test_cases,
        traceability_validation=traceability_validation,
    )

    return {
        "analysisScope": analysis_scope,
        "cleaningSummary": cleaning_summary,
        "reviews": reviews,
        "ratingSummary": summarize_ratings(reviews),
        "analysisSummary": analysis_summary,
        "stageReports": stage_reports,
        "findings": findings,
        "requirements": requirements,
        "versionPlan": version_plan,
        "prd": prd,
        "testCases": test_cases,
        "dataLimitations": data_limitations(reviews),
        "traceabilityValidation": traceability_validation,
    }


def stage_event(stage_name: str, status: str) -> dict[str, object]:
    return {
        "type": "stage",
        "stage": {"name": stage_name, "status": status},
        "stages": progress_stages(stage_name, status),
    }


def progress_stages(stage_name: str, status: str) -> list[dict[str, str]]:
    active_index = WORKFLOW_PROGRESS_SEQUENCE.index(stage_name)
    completed_names = set(WORKFLOW_PROGRESS_SEQUENCE[:active_index])
    stages: list[dict[str, str]] = []

    for name in WORKFLOW_STAGE_NAMES:
        if name in completed_names:
            stage_status = STAGE_STATUS_COMPLETE
        elif name == stage_name:
            stage_status = status
        else:
            stage_status = STAGE_STATUS_PENDING
        stages.append({"name": name, "status": stage_status})

    return stages


def report_event(
    name: str,
    status: str,
    summary: str,
    details: list[str] | None = None,
    revisions: list[str] | None = None,
    errors: list[str] | None = None,
) -> dict[str, object]:
    return {
        "type": "report",
        "report": {
            "name": name,
            "status": status,
            "summary": summary,
            "details": details or [],
            "revisions": revisions or [],
            "errors": errors or [],
        },
    }


def workflow_run_payload(
    run_id: str,
    source: dict[str, object],
    scope: dict[str, object],
    raw_reviews: list[dict[str, object]],
    workflow: dict[str, object],
    validation_messages: list[str],
) -> dict[str, object]:
    return validated_workflow_run({
        "runId": run_id,
        "source": source,
        "scope": scope,
        "stages": completed_stages(),
        "analysisScope": workflow["analysisScope"],
        "rawReviews": raw_reviews,
        "reviews": workflow["reviews"],
        "cleaningSummary": workflow["cleaningSummary"],
        "ratingSummary": workflow["ratingSummary"],
        "analysisSummary": workflow["analysisSummary"],
        "stageReports": workflow["stageReports"],
        "findings": workflow["findings"],
        "requirements": workflow["requirements"],
        "versionPlan": workflow["versionPlan"],
        "prd": workflow["prd"],
        "testCases": workflow["testCases"],
        "dataLimitations": workflow["dataLimitations"],
        "traceabilityValidation": workflow["traceabilityValidation"],
        "validationMessages": validation_messages,
    })


def parse_us_app_store_url(app_store_url: str) -> tuple[str, str]:
    parsed_url = urlparse(app_store_url)

    if parsed_url.scheme not in {"http", "https"} or parsed_url.netloc != "apps.apple.com":
        raise HTTPException(status_code=400, detail="请输入有效的 App Store 链接。")

    path_parts = [part for part in parsed_url.path.split("/") if part]
    storefront = path_parts[0].lower() if path_parts else ""
    if storefront != "us":
        raise HTTPException(status_code=400, detail="当前仅支持 U.S. App Store 链接。")

    match = re.search(r"id(\d+)", parsed_url.path)
    if not match:
        raise HTTPException(status_code=400, detail="App Store 链接缺少应用 ID。")

    return match.group(1), storefront


def fetch_app_store_reviews(app_id: str, storefront: str) -> list[dict[str, object]]:
    url = (
        f"https://itunes.apple.com/{storefront}/rss/customerreviews/"
        f"page=2/id={app_id}/sortBy=mostRecent/json"
    )
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "ReviewTrace/0.1"},
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (TimeoutError, urllib.error.URLError, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=502,
            detail="无法获取 App Store 评论，请稍后重试或使用导入评论。",
        ) from error

    return parse_app_store_review_feed(payload, app_id, storefront)


def parse_app_store_review_feed(
    payload: dict[str, object],
    app_id: str,
    storefront: str,
) -> list[dict[str, object]]:
    feed = payload.get("feed", {}) if isinstance(payload, dict) else {}
    entries = feed.get("entry", []) if isinstance(feed, dict) else []
    if isinstance(entries, dict):
        entries = [entries]

    reviews: list[dict[str, object]] = []
    for entry in entries:
        if not isinstance(entry, dict) or "im:rating" not in entry:
            continue

        reviews.append(
            {
                "id": feed_label(entry.get("id")) or f"app-store-{len(reviews) + 1:03d}",
                "rating": parse_rating(feed_label(entry.get("im:rating"))),
                "title": feed_label(entry.get("title")),
                "body": feed_label(entry.get("content")),
                "appVersion": feed_label(entry.get("im:version")),
                "source": "app-store",
                "appId": app_id,
                "storefront": storefront,
                "author": feed_label(
                    entry.get("author", {}).get("name")
                    if isinstance(entry.get("author"), dict)
                    else None
                ),
                "date": feed_label(entry.get("updated")),
                "locale": storefront,
                "rawMetadata": entry,
            }
        )

    return reviews


def feed_label(value: object) -> str:
    if isinstance(value, dict):
        return str(value.get("label") or "").strip()

    return str(value or "").strip()


class AnalysisProvider(Protocol):
    def analyze(
        self,
        reviews: list[dict[str, object]],
        analysis_goal: str,
    ) -> dict[str, object]:
        pass


class ReviewAnalysisEngine:
    def model_analysis(
        self,
        provider: str,
        model: str,
        model_output: str,
        reviews: list[dict[str, object]],
        analysis_goal: str,
    ) -> dict[str, object]:
        analysis = parse_model_analysis(
            model_output,
            reviews,
            analysis_goal,
            f"{provider}:{model}",
        )

        return {
            "summary": {
                "provider": provider,
                "model": model,
                "modelDriven": True,
            },
            "scope": analysis["scope"],
            "findings": analysis["findings"],
        }


class ModelAnalysisAdapter:
    def __init__(
        self,
        provider: str,
        model: str,
        unavailable_message: str,
        engine: ReviewAnalysisEngine | None = None,
    ) -> None:
        self.provider = provider
        self.model = model
        self.unavailable_message = unavailable_message
        self.engine = engine or ReviewAnalysisEngine()

    def analyze(
        self,
        reviews: list[dict[str, object]],
        analysis_goal: str,
    ) -> dict[str, object]:
        prompt = build_review_analysis_prompt(reviews, analysis_goal)
        try:
            model_output = self.call_model(prompt)
        except Exception as error:
            raise HTTPException(
                status_code=502,
                detail=self.unavailable_message,
            ) from error

        return self.engine.model_analysis(
            self.provider,
            self.model,
            model_output,
            reviews,
            analysis_goal,
        )

    def call_model(self, prompt: str) -> str:
        raise NotImplementedError


class OpenAIAnalysisAdapter(ModelAnalysisAdapter):
    def __init__(
        self,
        model: str,
        engine: ReviewAnalysisEngine | None = None,
    ) -> None:
        super().__init__(
            provider="openai",
            model=model,
            unavailable_message="模型服务不可用，请检查 API key 或网络。",
            engine=engine,
        )

    def call_model(self, prompt: str) -> str:
        return call_openai_responses_api(prompt, self.model)


class DeepSeekAnalysisAdapter(ModelAnalysisAdapter):
    def __init__(
        self,
        model: str,
        engine: ReviewAnalysisEngine | None = None,
    ) -> None:
        super().__init__(
            provider="deepseek",
            model=model,
            unavailable_message="DeepSeek 模型服务不可用，请检查 API key 或网络。",
            engine=engine,
        )

    def call_model(self, prompt: str) -> str:
        return call_deepseek_chat_api(prompt, self.model)


class EmptyAnalysisAdapter:
    def __init__(self, provider: str, model: str) -> None:
        self.provider = provider
        self.model = model

    def analyze(
        self,
        reviews: list[dict[str, object]],
        analysis_goal: str,
    ) -> dict[str, object]:
        return build_empty_analysis(reviews, analysis_goal, self.provider, self.model)


def configured_analysis_provider() -> AnalysisProvider:
    provider = os.getenv("MODEL_PROVIDER", "unconfigured").lower()
    model = configured_model_name(provider)

    if provider == "openai" and os.getenv("OPENAI_API_KEY"):
        return OpenAIAnalysisAdapter(model)

    if provider == "deepseek" and os.getenv("DEEPSEEK_API_KEY"):
        return DeepSeekAnalysisAdapter(model)

    return EmptyAnalysisAdapter(provider, model)


def analyze_reviews(
    reviews: list[dict[str, object]],
    analysis_goal: str,
) -> dict[str, object]:
    return configured_analysis_provider().analyze(reviews, analysis_goal)


def configured_model_name(provider: str) -> str:
    if os.getenv("MODEL_NAME"):
        return str(os.getenv("MODEL_NAME"))

    if provider == "deepseek":
        return "deepseek-v4-flash"

    if provider == "openai":
        return "gpt-5.6-sol"

    return "no-model"


def model_configuration() -> dict[str, object]:
    """Return safe, user-facing model configuration without exposing secrets."""

    provider = os.getenv("MODEL_PROVIDER", "unconfigured").lower()
    model = (
        "no-model"
        if provider not in {"deepseek", "openai"}
        else configured_model_name(provider)
    )
    key_name = {
        "deepseek": "DEEPSEEK_API_KEY",
        "openai": "OPENAI_API_KEY",
    }.get(provider)
    key_configured = bool(key_name and os.getenv(key_name))
    model_driven_available = provider in {"deepseek", "openai"} and key_configured

    if model_driven_available:
        message = f"已配置 {provider} 模型，将使用模型驱动分析。"
    elif key_name:
        message = f"未配置 {key_name}，当前将只返回空分析结果，不会伪造发现。"
    else:
        message = "当前未配置模型 provider，工作流会返回空分析结果。配置支持的模型 provider 和 API key 后可启用模型分析。"

    return {
        "provider": provider,
        "model": model,
        "keyConfigured": key_configured,
        "modelDrivenAvailable": model_driven_available,
        "fallbackAvailable": True,
        "message": message,
    }


def build_empty_analysis(
    reviews: list[dict[str, object]],
    analysis_goal: str = "",
    provider: str = "unconfigured",
    model: str = "no-model",
) -> dict[str, object]:
    return {
        "summary": {
            "provider": provider,
            "model": model,
            "modelDriven": False,
        },
        "scope": build_default_analysis_scope(analysis_goal or "空分析", reviews),
        "findings": [],
    }


class ScopeSelector:
    """Selects review scope and explains the decision behind one interface."""

    def select(
        self,
        reviews: list[dict[str, object]],
        analysis_goal: str,
    ) -> ScopeDecision:
        selected_reviews = select_scope_reviews(reviews, analysis_goal)
        analysis_scope = build_default_analysis_scope(
            analysis_goal,
            selected_reviews,
            reviews,
        )

        return ScopeDecision(
            selected_reviews=selected_reviews,
            analysis_scope=analysis_scope,
            report_details=self.report_details(analysis_scope),
            report_revisions=self.report_revisions(analysis_scope),
        )

    def normalize(
        self,
        model_scope: object,
        analysis_goal: str,
        selected_reviews: list[dict[str, object]],
        all_reviews: list[dict[str, object]],
    ) -> dict[str, object]:
        return normalize_analysis_scope(
            model_scope,
            analysis_goal,
            selected_reviews,
            all_reviews,
        )

    def report_details(self, analysis_scope: dict[str, object]) -> list[str]:
        return [
            f"范围评论：{', '.join(analysis_scope['scopeReviewIds']) or '无'}",
            *[f"规则：{rule}" for rule in analysis_scope["filteringRules"]],
        ]

    def report_revisions(self, analysis_scope: dict[str, object]) -> list[str]:
        return [
            *[f"不确定性：{note}" for note in analysis_scope["uncertaintyNotes"]],
        ]


def build_default_analysis_scope(
    analysis_goal: str,
    reviews: list[dict[str, object]],
    all_reviews: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    all_review_rows = all_reviews if all_reviews is not None else reviews
    ratings = [int(review["rating"]) for review in reviews if int(review["rating"]) > 0]
    versions = sorted(
        {
            str(review.get("appVersion") or "")
            for review in reviews
            if str(review.get("appVersion") or "").strip()
        }
    )
    low_rating_count = sum(1 for rating in ratings if rating <= 2)
    high_rating_count = sum(1 for rating in ratings if rating >= 4)
    unique_rating_count = len(set(ratings))
    signals = [
        f"样本量 {len(reviews)} 条，清洗后结果可直接追溯到原始评论。",
    ]
    if ratings:
        signals.append(
            "评分分布："
            + ", ".join(
                f"{rating} 星 {sum(1 for item in ratings if item == rating)} 条"
                for rating in sorted(set(ratings))
            )
        )
    if versions:
        signals.append(f"可见版本号：{', '.join(versions)}")
    if low_rating_count and high_rating_count:
        signals.append("同时存在低分和高分反馈，适合比较矛盾证据。")
    elif low_rating_count:
        signals.append("低评分反馈占比偏高，适合优先查找阻碍转化的环节。")
    elif high_rating_count:
        signals.append("高评分反馈占比偏高，适合保留有效体验并找出改进边界。")

    focus_areas: list[str] = []
    goal_text = analysis_goal.strip() or "综合评论证据"
    goal_lower = goal_text.lower()
    if any(term in goal_lower for term in ["订阅", "付费", "价格", "取消"]):
        focus_areas.append("付费和订阅路径")
    if any(term in goal_lower for term in ["训练", "锻炼", "课程", "动作"]):
        focus_areas.append("训练体验和课程可用性")
    if any(term in goal_lower for term in ["版本", "发布", "更新", "回归"]):
        focus_areas.append("版本差异和回归信号")
    if any(term in goal_lower for term in ["低评分", "差评", "一星", "二星"]):
        focus_areas.append("低评分反馈")
    if not focus_areas and low_rating_count:
        focus_areas.append("低评分反馈")
    if not focus_areas and unique_rating_count > 1:
        focus_areas.append("跨评分段对照")
    if not focus_areas:
        focus_areas.append("综合用户反馈")

    constraints = [
        "只使用已采集评论中的证据。",
        "证据不足时应标记为假设或降级为版本 2。",
    ]
    if len(reviews) < 10:
        constraints.append("样本量偏小，结果应视为方向性信号。")

    uncertainty_notes = [
        "评论样本可能只覆盖公开最新评论样本，而非全部历史评论。",
    ]
    if not reviews:
        uncertainty_notes.append("当前没有可分析评论。")
    elif len(reviews) < 10:
        uncertainty_notes.append("评论数量较少，适合做问题假设而不是强结论。")
    if low_rating_count and high_rating_count:
        uncertainty_notes.append("同一主题可能同时存在支持和反对证据。")

    scope_review_ids = [str(review["id"]) for review in reviews]
    all_review_ids = [str(review["id"]) for review in all_review_rows]

    return {
        "requestedGoal": goal_text,
        "focusSummary": goal_text,
        "focusAreas": focus_areas,
        "dataSignals": signals,
        "constraints": constraints,
        "uncertaintyNotes": uncertainty_notes,
        "scopeReviewIds": scope_review_ids,
        "selectionSummary": scope_selection_summary(
            analysis_goal,
            len(scope_review_ids),
            len(all_review_ids),
        ),
        "filteringRules": scope_filtering_rules(
            analysis_goal,
            len(scope_review_ids),
            len(all_review_ids),
        ),
        "excludedReviewIds": [
            review_id for review_id in all_review_ids if review_id not in scope_review_ids
        ],
    }


def scope_selection_summary(
    analysis_goal: str,
    selected_count: int,
    total_count: int,
) -> str:
    if total_count == 0:
        return "当前没有清洗后评论可纳入分析。"

    if selected_count == total_count:
        if total_count <= 5:
            return (
                f"清洗后只有 {total_count} 条评论，系统保留全部评论以避免过度过滤。"
            )
        if not analysis_goal_terms(analysis_goal):
            return (
                f"分析目标没有命中内置范围关键词，系统使用全部 {total_count} 条清洗后评论。"
            )
        return f"当前目标相关信号覆盖全部 {total_count} 条清洗后评论。"

    return (
        f"系统根据分析目标从 {total_count} 条清洗后评论中选入 {selected_count} 条，"
        f"排除 {total_count - selected_count} 条低相关评论。"
    )


def scope_filtering_rules(
    analysis_goal: str,
    selected_count: int,
    total_count: int,
) -> list[str]:
    rules = [
        "先移除标题和正文都为空的评论，并按标题与正文指纹去重。",
    ]
    goal_terms = analysis_goal_terms(analysis_goal)

    if total_count == 0:
        rules.append("没有评论通过清洗，因此不会生成无证据发现、需求或测试用例。")
        return rules

    if total_count <= 5:
        rules.append("评论数不超过 5 条时保留全部评论，避免样本过小导致误删证据。")
    elif goal_terms:
        rules.append(f"优先纳入命中目标关键词的评论：{', '.join(goal_terms)}。")
        rules.append("低评分、版本号和订阅/付费语境会作为附加相关性信号。")
    else:
        rules.append("目标未命中订阅、训练、版本或低评分等内置关键词时保留全部评论。")

    if 0 < selected_count < total_count:
        rules.append("范围收敛后仍会补入相反评分段的一条评论，用于保留潜在冲突证据。")

    return rules


def select_scope_reviews(
    reviews: list[dict[str, object]],
    analysis_goal: str,
) -> list[dict[str, object]]:
    if len(reviews) <= 5:
        return list(reviews)

    goal_terms = analysis_goal_terms(analysis_goal)
    if not goal_terms:
        return list(reviews)

    scored_reviews = [
        (
            review_scope_score(review, goal_terms, analysis_goal),
            index,
            review,
        )
        for index, review in enumerate(reviews)
    ]
    positive_reviews = [item for item in scored_reviews if item[0] > 0]
    if not positive_reviews:
        return list(reviews)

    target_count = min(len(reviews), max(5, len(reviews) // 2))
    selected_indexes = {
        index for _, index, _ in sorted(
            positive_reviews,
            key=lambda item: (-item[0], item[1]),
        )[:target_count]
    }

    selected_reviews = [
        review for index, review in enumerate(reviews) if index in selected_indexes
    ]
    selected_reviews = diversify_scope_reviews(selected_reviews, reviews)

    if len(selected_reviews) < 3:
        return list(reviews)

    return selected_reviews


def analysis_goal_terms(analysis_goal: str) -> list[str]:
    goal_lower = analysis_goal.lower()
    return [
        term
        for term in [
            "订阅",
            "付费",
            "价格",
            "取消",
            "训练",
            "锻炼",
            "课程",
            "动作",
            "版本",
            "发布",
            "更新",
            "回归",
            "低评分",
            "差评",
            "一星",
            "二星",
        ]
        if term in goal_lower
    ]


def review_scope_score(
    review: dict[str, object],
    goal_terms: list[str],
    analysis_goal: str,
) -> int:
    text = normalize_text_for_fingerprint(
        f"{review.get('title') or ''} {review.get('body') or ''}"
    )
    score = 0

    for term in goal_terms:
        if term in text:
            score += 3

    rating = int(review.get("rating") or 0)
    if any(term in analysis_goal for term in ["低评分", "差评", "一星", "二星"]):
        if rating and rating <= 2:
            score += 2

    if any(term in analysis_goal for term in ["版本", "发布", "更新", "回归"]):
        if str(review.get("appVersion") or "").strip():
            score += 1

    if any(term in analysis_goal for term in ["订阅", "付费", "价格", "取消"]):
        if rating and rating <= 2:
            score += 1

    return score


def diversify_scope_reviews(
    selected_reviews: list[dict[str, object]],
    all_reviews: list[dict[str, object]],
) -> list[dict[str, object]]:
    selected_ids = {str(review["id"]) for review in selected_reviews}
    has_low_rating = any(int(review["rating"]) <= 2 for review in selected_reviews)
    has_high_rating = any(int(review["rating"]) >= 4 for review in selected_reviews)

    if has_low_rating and not has_high_rating:
        for review in all_reviews:
            if str(review["id"]) not in selected_ids and int(review["rating"]) >= 4:
                selected_reviews.append(review)
                selected_ids.add(str(review["id"]))
                break

    if has_high_rating and not has_low_rating:
        for review in all_reviews:
            if str(review["id"]) not in selected_ids and int(review["rating"]) <= 2:
                selected_reviews.append(review)
                break

    return [
        review for review in all_reviews if str(review["id"]) in {
            str(item["id"]) for item in selected_reviews
        }
    ]


def normalize_analysis_scope(
    scope_payload: object,
    analysis_goal: str,
    reviews: list[dict[str, object]],
    all_reviews: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    default_scope = build_default_analysis_scope(analysis_goal, reviews, all_reviews)
    if not isinstance(scope_payload, dict):
        return default_scope

    focus_summary = str(
        scope_payload.get("focusSummary") or default_scope["focusSummary"]
    ).strip()
    all_review_rows = all_reviews if all_reviews is not None else reviews
    valid_scope_review_ids = {
        str(review["id"]) for review in reviews
    }
    scope_review_ids = [
        review_id
        for review_id in sanitize_string_list(
            scope_payload.get("scopeReviewIds"),
            default_scope["scopeReviewIds"],
        )
        if review_id in valid_scope_review_ids
    ] or list(default_scope["scopeReviewIds"])
    all_review_ids = [str(review["id"]) for review in all_review_rows]

    return {
        "requestedGoal": analysis_goal.strip() or default_scope["requestedGoal"],
        "focusSummary": focus_summary or default_scope["focusSummary"],
        "focusAreas": sanitize_string_list(
            scope_payload.get("focusAreas"),
            default_scope["focusAreas"],
        ),
        "dataSignals": sanitize_string_list(
            scope_payload.get("dataSignals"),
            default_scope["dataSignals"],
        ),
        "constraints": sanitize_string_list(
            scope_payload.get("constraints"),
            default_scope["constraints"],
        ),
        "uncertaintyNotes": sanitize_string_list(
            scope_payload.get("uncertaintyNotes"),
            default_scope["uncertaintyNotes"],
        ),
        "scopeReviewIds": scope_review_ids,
        "selectionSummary": scope_selection_summary(
            analysis_goal,
            len(scope_review_ids),
            len(all_review_ids),
        ),
        "filteringRules": scope_filtering_rules(
            analysis_goal,
            len(scope_review_ids),
            len(all_review_ids),
        ),
        "excludedReviewIds": [
            review_id for review_id in all_review_ids if review_id not in scope_review_ids
        ],
    }


def sanitize_string_list(
    values: object,
    fallback: list[str] | None = None,
) -> list[str]:
    if isinstance(values, list):
        cleaned = [str(value).strip() for value in values if str(value).strip()]
        if cleaned:
            return cleaned

    return list(fallback or [])


def build_review_analysis_prompt(
    reviews: list[dict[str, object]],
    analysis_goal: str,
) -> str:
    review_payload = [
        {
            "id": review["id"],
            "rating": review["rating"],
            "title": review["title"],
            "body": review["body"],
            "appVersion": review["appVersion"],
        }
        for review in reviews
    ]

    return "\n".join(
        [
            "你是严谨的 App Store 评论分析助手。",
            "请根据分析目标，从评论中先判断分析范围，再归纳主要用户问题。",
            "只能使用输入评论中存在的证据，不要编造 reviewId、样本数或结论。",
            "请只返回 JSON，不要返回 Markdown。",
            "JSON 结构：{\"scope\":{\"focusSummary\":\"...\",\"focusAreas\":[\"...\"],\"dataSignals\":[\"...\"],\"constraints\":[\"...\"],\"uncertaintyNotes\":[\"...\"],\"scopeReviewIds\":[\"...\"]},\"findings\":[{\"id\":\"...\",\"title\":\"...\",\"reviewIds\":[\"...\"],\"sampleCount\":1,\"confidence\":\"高/中/低\",\"conflictingEvidence\":[]}]}",
            f"分析目标：{analysis_goal or '无特定目标'}",
            "评论数据：",
            json.dumps(review_payload, ensure_ascii=False),
        ]
    )


def call_openai_responses_api(prompt: str, model: str) -> str:
    from openai import OpenAI

    client = OpenAI()
    response = client.responses.create(
        model=model,
        input=prompt,
    )
    return response.output_text


def call_deepseek_chat_api(prompt: str, model: str) -> str:
    from openai import OpenAI

    client = OpenAI(
        api_key=os.getenv("DEEPSEEK_API_KEY"),
        base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
    )
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "你是严谨的 App Store 评论分析助手，只返回合法 JSON。",
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        response_format={"type": "json_object"},
    )

    return response.choices[0].message.content or ""


def parse_model_analysis(
    model_output: str,
    reviews: list[dict[str, object]],
    analysis_goal: str,
    method: str,
) -> dict[str, object]:
    try:
        parsed = json.loads(model_output)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=502, detail="模型返回的 JSON 无法解析。") from error

    scope = normalize_analysis_scope(
        parsed.get("scope") if isinstance(parsed, dict) else None,
        analysis_goal,
        reviews,
    )
    findings = parse_model_findings(parsed, reviews, method)

    return {
        "scope": scope,
        "findings": findings,
    }


def parse_model_findings(
    parsed: dict[str, object] | str,
    reviews: list[dict[str, object]],
    method: str,
) -> list[dict[str, object]]:
    if isinstance(parsed, str):
        try:
            parsed = json.loads(parsed)
        except json.JSONDecodeError as error:
            raise HTTPException(status_code=502, detail="模型返回的 JSON 无法解析。") from error

    findings = parsed.get("findings", []) if isinstance(parsed, dict) else []
    if not isinstance(findings, list):
        raise HTTPException(status_code=502, detail="模型返回的 findings 必须是数组。")

    valid_review_ids = {str(review["id"]) for review in reviews}
    validated_findings: list[dict[str, object]] = []

    for index, finding in enumerate(findings, start=1):
        if not isinstance(finding, dict):
            continue

        review_ids = [
            str(review_id)
            for review_id in finding.get("reviewIds", [])
            if str(review_id) in valid_review_ids
        ]
        if not review_ids:
            continue

        validated_findings.append(
            {
                "id": str(finding.get("id") or f"finding-model-{index:03d}"),
                "title": str(finding.get("title") or "模型发现未命名问题。"),
                "reviewIds": review_ids,
                "sampleCount": int(finding.get("sampleCount") or len(review_ids)),
                "confidence": str(finding.get("confidence") or "中"),
                "method": method,
                "conflictingEvidence": finding.get("conflictingEvidence", []),
            }
        )

    return validated_findings


def enrich_findings_with_evidence(
    findings: list[dict[str, object]],
    reviews: list[dict[str, object]],
) -> list[dict[str, object]]:
    reviews_by_id = {str(review["id"]): review for review in reviews}
    enriched: list[dict[str, object]] = []

    for finding in findings:
        review_ids = [str(review_id) for review_id in finding.get("reviewIds", [])]
        evidence = [
            review_evidence(reviews_by_id[review_id])
            for review_id in review_ids
            if review_id in reviews_by_id
        ]
        conflicting = normalize_conflicting_evidence(
            finding.get("conflictingEvidence"),
            reviews_by_id,
        )
        finding_with_evidence = {
            **finding,
            "reviewIds": [item["reviewId"] for item in evidence],
            "sampleCount": len(evidence),
            "evidence": evidence,
            "conflictingEvidence": conflicting
            if conflicting
            else conflicting_evidence(review_ids, reviews_by_id),
        }
        enriched.append(finding_with_evidence)

    return enriched


def review_evidence(review: dict[str, object]) -> dict[str, str]:
    return {
        "reviewId": str(review["id"]),
        "excerpt": review_excerpt(review),
    }


def review_excerpt(review: dict[str, object]) -> str:
    title = str(review.get("title") or "").strip()
    body = str(review.get("body") or "").strip()
    excerpt = f"{title}：{body}" if title and body else title or body
    return excerpt[:180]


def conflicting_evidence(
    review_ids: list[str],
    reviews_by_id: dict[str, dict[str, object]],
) -> list[dict[str, str]]:
    selected_reviews = [
        reviews_by_id[review_id] for review_id in review_ids if review_id in reviews_by_id
    ]
    has_low_rating = any(int(review["rating"]) <= 2 for review in selected_reviews)
    has_high_rating = any(int(review["rating"]) >= 5 for review in selected_reviews)

    if not has_low_rating or not has_high_rating:
        return []

    return [
        review_evidence(review)
        for review in selected_reviews
        if int(review["rating"]) >= 5
    ]


def normalize_conflicting_evidence(
    conflicting_payload: object,
    reviews_by_id: dict[str, dict[str, object]],
) -> list[dict[str, str]]:
    if not isinstance(conflicting_payload, list):
        return []

    normalized: list[dict[str, str]] = []
    for item in conflicting_payload:
        review_id: str | None = None
        if isinstance(item, str):
            review_id = item
        elif isinstance(item, dict):
            review_id = str(item.get("reviewId") or item.get("id") or "").strip() or None

        if review_id and review_id in reviews_by_id:
            normalized.append(review_evidence(reviews_by_id[review_id]))

    return normalized


def data_limitations(reviews: list[dict[str, object]]) -> list[str]:
    limitations: list[str] = []

    if not reviews:
        limitations.append("没有获取到可分析评论，请检查链接或改用导入评论。")
    elif len(reviews) < 10:
        limitations.append("样本量较小，当前结论应视为方向性信号。")

    return limitations


class TraceableArtifactBuilder:
    """Builds the review-to-test artifact chain behind one interface."""

    def __init__(
        self,
        test_case_generator: Callable[
            [list[dict[str, object]]],
            list[dict[str, object]],
        ] | None = None,
    ) -> None:
        self.test_case_generator = test_case_generator or generate_test_cases

    def build(
        self,
        findings: list[dict[str, object]],
        analysis_scope: dict[str, object],
        reviews: list[dict[str, object]],
        analysis_goal: str,
    ) -> TraceableArtifactBundle:
        requirements = generate_requirements(findings, analysis_scope)
        version_plan = generate_version_plan(requirements, analysis_scope)
        prd = generate_prd(analysis_goal, analysis_scope, requirements, version_plan)
        test_cases = self.test_case_generator(requirements)
        traceability_validation = validate_traceability(
            findings,
            reviews,
            requirements,
            test_cases,
        )

        return TraceableArtifactBundle(
            requirements=requirements,
            version_plan=version_plan,
            prd=prd,
            test_cases=test_cases,
            traceability_validation=traceability_validation,
        )


def generate_requirements(
    findings: list[dict[str, object]],
    analysis_scope: dict[str, object],
) -> list[dict[str, object]]:
    requirements: list[dict[str, object]] = []

    for finding in findings:
        review_ids = [str(review_id) for review_id in finding.get("reviewIds", [])]
        if not review_ids:
            continue

        finding_id = str(finding["id"])
        priority = requirement_priority(finding)
        assumption = bool(finding.get("confidence") == "低")
        requirements.append(
            {
                "id": requirement_id_for_finding(finding_id),
                "title": (
                    f"围绕「{trim_sentence(str(finding['title']))}」"
                    f"并聚焦「{trim_sentence(str(analysis_scope['focusSummary']))}」制定可验证改进。"
                ),
                "priority": priority,
                "version": "v1" if priority == "P1" else "v2",
                "findingIds": [finding_id],
                "sourceReviewIds": review_ids,
                "boundaries": [
                    "仅覆盖当前评论证据直接支持的问题。",
                    "不扩展到评论中未出现的全新业务能力。",
                ],
                "assumption": assumption,
                "acceptanceCriteria": requirement_acceptance_criteria(
                    finding,
                    analysis_scope,
                ),
            }
        )

    return requirements


def requirement_priority(finding: dict[str, object]) -> str:
    sample_count = int(finding.get("sampleCount") or 0)
    confidence = str(finding.get("confidence") or "")

    if sample_count >= 2 and confidence in {"高", "中", "中等", "待模型分析"}:
        return "P1"

    return "P2"


def requirement_acceptance_criteria(
    finding: dict[str, object],
    analysis_scope: dict[str, object],
) -> list[str]:
    title = trim_sentence(str(finding.get("title") or ""))
    focus_summary = trim_sentence(str(analysis_scope.get("focusSummary") or ""))
    review_ids = ", ".join(str(review_id) for review_id in finding.get("reviewIds", []))

    if any(term in title for term in ["订阅", "付费", "价格", "取消"]):
        return [
            "用户在付费或订阅确认前能看到价格、包含内容和取消方式。",
            f"源评论 {review_ids} 中的订阅疑虑被逐条回应。",
            f"相关改进与当前范围「{focus_summary}」一致。",
        ]

    if any(term in title for term in ["训练", "锻炼", "课程", "动作"]):
        return [
            "用户能在开始训练前看懂当前课程或动作会如何执行。",
            f"源评论 {review_ids} 中关于训练可用性的疑问被直接解决。",
            f"改进只覆盖当前范围「{focus_summary}」中的训练体验问题。",
        ]

    if any(term in title for term in ["版本", "更新", "回归"]):
        return [
            "问题能在指定版本范围内复现并被修复说明。",
            f"源评论 {review_ids} 中提到的版本差异可以被追踪。",
            f"改进与当前范围「{focus_summary}」中的版本差异信号一致。",
        ]

    if any(term in title for term in ["低评分", "差评", "一星", "二星"]):
        return [
            "低评分用户指出的问题在交互或文案中有明确回应。",
            f"源评论 {review_ids} 中的负面反馈被逐条覆盖。",
            f"改进与当前范围「{focus_summary}」中的低评分信号一致。",
        ]

    return [
        f"与「{title}」相关的用户问题在产品中有明确回应。",
        f"源评论 {review_ids} 的关键疑问可被产品改进直接解释。",
        f"改进范围与当前分析范围「{focus_summary}」保持一致。",
    ]


def requirement_id_for_finding(finding_id: str) -> str:
    if finding_id.startswith("finding-"):
        return f"requirement-{finding_id.removeprefix('finding-')}"

    return f"requirement-{finding_id}"


def trim_sentence(value: str) -> str:
    return value.strip().rstrip("。.!！")


def generate_version_plan(
    requirements: list[dict[str, object]],
    analysis_scope: dict[str, object],
) -> dict[str, list[dict[str, object]]]:
    versions: list[dict[str, object]] = []
    first_version_requirements = [
        requirement for requirement in requirements if requirement["version"] == "v1"
    ]
    later_version_requirements = [
        requirement for requirement in requirements if requirement["version"] != "v1"
    ]

    if first_version_requirements:
        versions.append(
            version_plan_item(
                "v1",
                "版本 1：证据支撑的核心改进",
                f"优先交付与「{trim_sentence(str(analysis_scope['focusSummary']))}」直接相关且有明确评论证据的问题。",
                first_version_requirements,
            )
        )

    if later_version_requirements:
        versions.append(
            version_plan_item(
                "v2",
                "版本 2：补充验证后的增强项",
                "处理样本较少、置信度较弱或需要继续观察的问题。",
                later_version_requirements,
            )
        )

    return {"versions": versions}


def version_plan_item(
    version_id: str,
    name: str,
    goal: str,
    requirements: list[dict[str, object]],
) -> dict[str, object]:
    source_review_ids = sorted(
        {
            str(review_id)
            for requirement in requirements
            for review_id in requirement["sourceReviewIds"]
        }
    )

    return {
        "id": version_id,
        "name": name,
        "goal": goal,
        "requirementIds": [str(requirement["id"]) for requirement in requirements],
        "sourceReviewIds": source_review_ids,
    }


def generate_prd(
    analysis_goal: str,
    analysis_scope: dict[str, object],
    requirements: list[dict[str, object]],
    version_plan: dict[str, list[dict[str, object]]],
) -> dict[str, object]:
    goal = analysis_goal.strip() or "当前分析目标"
    focus_summary = trim_sentence(str(analysis_scope["focusSummary"]))
    objective = f"围绕「{goal}」回应已导入评论中的高证据问题。"
    if focus_summary and focus_summary != goal:
        objective = f"围绕「{goal}」并聚焦「{focus_summary}」回应已导入评论中的高证据问题。"

    return {
        "title": "ReviewTrace 产品需求文档草案",
        "objective": objective,
        "scopeSummary": analysis_scope,
        "versions": version_plan["versions"],
        "requirements": requirements,
        "successMetrics": [
            "每条需求都能追溯到至少一条原始评论。",
            "版本范围只包含当前证据支持的问题。",
            "分析范围、证据信号和不确定性都被显式记录。",
        ],
        "assumptions": [
            requirement
            for requirement in requirements
            if bool(requirement.get("assumption"))
        ],
    }


def build_stage_reports(
    raw_reviews: list[dict[str, object]],
    reviews: list[dict[str, object]],
    scope_reviews: list[dict[str, object]],
    cleaning_summary: dict[str, object],
    analysis_summary: dict[str, object],
    analysis_scope: dict[str, object],
    findings: list[dict[str, object]],
    requirements: list[dict[str, object]],
    version_plan: dict[str, object],
    prd: dict[str, object],
    test_cases: list[dict[str, object]],
    traceability_validation: dict[str, object],
) -> list[dict[str, object]]:
    return [
        {
            "name": "reviews",
            "status": STAGE_STATUS_COMPLETE,
            "summary": f"收集到 {len(raw_reviews)} 条原始评论，清洗后保留 {len(reviews)} 条。",
            "details": [
                f"评分统计：{render_rating_summary(reviews)}",
                f"原始评论数：{len(raw_reviews)}",
                f"保留评论数：{len(reviews)}",
            ],
            "revisions": [],
            "errors": [],
        },
        {
            "name": "cleaning",
            "status": STAGE_STATUS_COMPLETE,
            "summary": (
                f"去重 {cleaning_summary['duplicateCount']} 条，"
                f"移除空评论 {cleaning_summary['discardedEmptyCount']} 条。"
            ),
            "details": [
                f"输入：{cleaning_summary['inputCount']} 条",
                f"保留：{cleaning_summary['retainedCount']} 条",
            ],
            "revisions": [
                note
                for note in [
                    "已将标题和正文都为空的评论从分析集移除。",
                    "已按标题与正文归一化指纹去重。",
                ]
                if cleaning_summary["duplicateCount"] or cleaning_summary["discardedEmptyCount"]
            ],
            "errors": [],
        },
        {
            "name": "scope",
            "status": STAGE_STATUS_COMPLETE,
            "summary": str(analysis_scope["focusSummary"]),
            "details": [
                f"用户目标：{analysis_scope['requestedGoal']}",
                f"过滤说明：{analysis_scope['selectionSummary']}",
                *[f"过滤规则：{item}" for item in analysis_scope["filteringRules"]],
                *[f"聚焦：{item}" for item in analysis_scope["focusAreas"]],
                *[f"信号：{item}" for item in analysis_scope["dataSignals"]],
                f"范围样本：{len(scope_reviews)} 条（清洗后共 {len(reviews)} 条）",
                *[
                    f"范围评论：{review_id}"
                    for review_id in analysis_scope["scopeReviewIds"][:5]
                ],
            ],
            "revisions": [
                *[f"排除评论：{review_id}" for review_id in analysis_scope["excludedReviewIds"][:5]],
                *[f"约束：{item}" for item in analysis_scope["constraints"]],
                *[f"不确定性：{item}" for item in analysis_scope["uncertaintyNotes"]],
            ],
            "errors": [],
        },
        {
            "name": "analysis",
            "status": STAGE_STATUS_COMPLETE,
            "summary": (
                f"{analysis_summary['provider']} / {analysis_summary['model']} 生成 {len(findings)} 个发现。"
            ),
            "details": [
                "模型驱动" if analysis_summary["modelDriven"] else "未配置模型，未生成发现",
                *[f"发现：{finding['title']}" for finding in findings[:3]],
            ],
            "revisions": [
                "模型输出已按 reviewId 重新校验并剔除无效引用。",
                "冲突证据已按有效评论重新归集。",
            ],
            "errors": [],
        },
        {
            "name": "prd",
            "status": STAGE_STATUS_COMPLETE,
            "summary": f"生成 {len(requirements)} 条需求，拆分为 {len(version_plan['versions'])} 个版本。",
            "details": [
                f"PRD 目标：{prd['objective']}",
                f"假设数量：{len(prd['assumptions'])}",
            ],
            "revisions": [
                *[f"版本：{version['name']}" for version in version_plan["versions"]],
            ],
            "errors": [],
        },
        {
            "name": "tests",
            "status": STAGE_STATUS_COMPLETE,
            "summary": f"生成 {len(test_cases)} 个 QA 测试用例。",
            "details": [
                *[f"测试：{test_case['title']}" for test_case in test_cases[:3]],
            ],
            "revisions": [
                "只为非假设需求生成测试用例。",
                "测试步骤直接引用源评论编号与需求边界。",
            ],
            "errors": [],
        },
        {
            "name": "validation",
            "status": STAGE_STATUS_COMPLETE,
            "summary": (
                "追溯校验通过"
                if traceability_validation["status"] == "passed"
                else "追溯校验未通过"
            ),
            "details": [
                f"未通过发现：{len(traceability_validation['unsupportedFindingIds'])}",
                f"未通过需求：{len(traceability_validation['unsupportedRequirementIds'])}",
                f"未通过测试：{len(traceability_validation['unsupportedTestCaseIds'])}",
            ],
            "revisions": [
                "所有保留的结论都已绑定到原始评论或被标记为假设。",
            ],
            "errors": [
                *traceability_validation["unsupportedFindingIds"],
                *traceability_validation["unsupportedRequirementIds"],
                *traceability_validation["unsupportedTestCaseIds"],
            ],
        },
    ]


def render_rating_summary(reviews: list[dict[str, object]]) -> str:
    ratings = Counter(str(review["rating"]) for review in reviews if int(review["rating"]) > 0)
    if not ratings:
        return "无有效评分"

    return "，".join(f"{rating} 星 {count} 条" for rating, count in sorted(ratings.items()))


def generate_test_cases(requirements: list[dict[str, object]]) -> list[dict[str, object]]:
    return [
        {
            "id": test_case_id_for_requirement(str(requirement["id"])),
            "title": f"验证：{trim_sentence(str(requirement['title']))}",
            "requirementId": str(requirement["id"]),
            "sourceReviewIds": [
                str(review_id) for review_id in requirement["sourceReviewIds"]
            ],
            "steps": test_case_steps(requirement),
            "verificationPoints": list(requirement.get("acceptanceCriteria", [])),
            "expectedResult": (
                f"源评论 {', '.join(str(review_id) for review_id in requirement['sourceReviewIds'])} "
                f"指出的问题能被「{trim_sentence(str(requirement['title']))}」逐条回应，"
                "且测试结果能追溯到对应需求与验收条件。"
            ),
        }
        for requirement in requirements
        if not bool(requirement.get("assumption"))
    ]


def test_case_steps(requirement: dict[str, object]) -> list[str]:
    source_review_ids = ", ".join(
        str(review_id) for review_id in requirement["sourceReviewIds"]
    )
    boundaries = "；".join(str(boundary) for boundary in requirement["boundaries"])
    acceptance_criteria = "；".join(
        str(item) for item in requirement.get("acceptanceCriteria", [])
    )

    return [
        f"准备覆盖源评论 {source_review_ids} 所描述问题的用户情境。",
        f"执行需求对应流程：{trim_sentence(str(requirement['title']))}。",
        f"核对验收条件：{acceptance_criteria}",
        f"核对需求边界：{boundaries}",
        f"确认源评论 {source_review_ids} 的问题被直接回应，而不是只完成通用功能检查。",
    ]


def test_case_id_for_requirement(requirement_id: str) -> str:
    if requirement_id.startswith("requirement-"):
        return f"test-{requirement_id.removeprefix('requirement-')}"

    return f"test-{requirement_id}"


def validate_traceability(
    findings: list[dict[str, object]],
    reviews: list[dict[str, object]],
    requirements: list[dict[str, object]] | None = None,
    test_cases: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    valid_review_ids = {str(review["id"]) for review in reviews}
    review_ids_by_finding_id = {
        str(finding["id"]): {
            str(review_id) for review_id in finding.get("reviewIds", [])
        }
        for finding in findings
    }
    unsupported_finding_ids = [
        str(finding["id"])
        for finding in findings
        if not set(str(review_id) for review_id in finding.get("reviewIds", [])).issubset(
            valid_review_ids
        )
        or not finding.get("reviewIds")
    ]
    unsupported_requirement_ids = unsupported_requirements(
        requirements or [],
        valid_review_ids,
        review_ids_by_finding_id,
    )
    unsupported_test_case_ids = unsupported_test_cases(
        test_cases or [],
        requirements or [],
        valid_review_ids,
        set(unsupported_requirement_ids),
    )

    return {
        "status": "passed"
        if (
            not unsupported_finding_ids
            and not unsupported_requirement_ids
            and not unsupported_test_case_ids
        )
        else "failed",
        "unsupportedFindingIds": unsupported_finding_ids,
        "unsupportedRequirementIds": unsupported_requirement_ids,
        "unsupportedTestCaseIds": unsupported_test_case_ids,
    }


def unsupported_requirements(
    requirements: list[dict[str, object]],
    valid_review_ids: set[str],
    review_ids_by_finding_id: dict[str, set[str]],
) -> list[str]:
    unsupported_requirement_ids: list[str] = []

    for requirement in requirements:
        if bool(requirement.get("assumption")):
            continue

        finding_ids = [str(finding_id) for finding_id in requirement.get("findingIds", [])]
        source_review_ids = {
            str(review_id) for review_id in requirement.get("sourceReviewIds", [])
        }
        supported_review_ids = {
            review_id
            for finding_id in finding_ids
            for review_id in review_ids_by_finding_id.get(finding_id, set())
        }

        if (
            not finding_ids
            or not source_review_ids
            or not set(finding_ids).issubset(review_ids_by_finding_id.keys())
            or not source_review_ids.issubset(valid_review_ids)
            or not source_review_ids.issubset(supported_review_ids)
        ):
            unsupported_requirement_ids.append(str(requirement["id"]))

    return unsupported_requirement_ids


def unsupported_test_cases(
    test_cases: list[dict[str, object]],
    requirements: list[dict[str, object]],
    valid_review_ids: set[str],
    unsupported_requirement_ids: set[str],
) -> list[str]:
    unsupported_test_case_ids: list[str] = []
    review_ids_by_requirement_id = {
        str(requirement["id"]): {
            str(review_id) for review_id in requirement.get("sourceReviewIds", [])
        }
        for requirement in requirements
    }

    for test_case in test_cases:
        requirement_id = str(test_case.get("requirementId") or "")
        source_review_ids = {
            str(review_id) for review_id in test_case.get("sourceReviewIds", [])
        }
        supported_review_ids = review_ids_by_requirement_id.get(requirement_id, set())

        if (
            requirement_id not in review_ids_by_requirement_id
            or requirement_id in unsupported_requirement_ids
            or not source_review_ids
            or not source_review_ids.issubset(valid_review_ids)
            or not source_review_ids.issubset(supported_review_ids)
        ):
            unsupported_test_case_ids.append(str(test_case["id"]))

    return unsupported_test_case_ids


def completed_stages() -> list[dict[str, str]]:
    return [
        {"name": "reviews", "status": STAGE_STATUS_COMPLETE},
        {"name": "cleaning", "status": STAGE_STATUS_COMPLETE},
        {"name": "scope", "status": STAGE_STATUS_COMPLETE},
        {"name": "analysis", "status": STAGE_STATUS_COMPLETE},
        {"name": "prd", "status": STAGE_STATUS_COMPLETE},
        {"name": "tests", "status": STAGE_STATUS_COMPLETE},
        {"name": "validation", "status": STAGE_STATUS_COMPLETE},
    ]


def parse_imported_reviews(dataset_format: str, dataset_text: str) -> list[dict[str, object]]:
    if dataset_format == "json":
        return parse_json_reviews(dataset_text)

    if dataset_format == "csv":
        return parse_csv_reviews(dataset_text)

    raise HTTPException(status_code=400, detail="导入格式必须是 json 或 csv。")


def parse_json_reviews(dataset_text: str) -> list[dict[str, object]]:
    try:
        parsed = json.loads(dataset_text)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="JSON 导入数据格式不正确。") from error

    rows = parsed.get("reviews", parsed) if isinstance(parsed, dict) else parsed
    if not isinstance(rows, list):
        raise HTTPException(status_code=400, detail="JSON 导入数据必须是评论数组。")

    return normalize_review_rows(rows)


def parse_csv_reviews(dataset_text: str) -> list[dict[str, object]]:
    reader = csv.DictReader(io.StringIO(dataset_text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV 导入数据必须包含表头。")

    return normalize_review_rows(list(reader))


def normalize_review_rows(rows: list[Any]) -> list[dict[str, object]]:
    reviews: list[dict[str, object]] = []

    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            raise HTTPException(status_code=400, detail="每条评论必须是对象。")

        review_id = str(row.get("id") or row.get("reviewId") or f"import-review-{index:03d}")
        reviews.append(
            {
                "id": review_id,
                "rating": parse_rating(row.get("rating")),
                "title": str(row.get("title") or "").strip(),
                "body": str(row.get("body") or row.get("content") or "").strip(),
                "appVersion": str(row.get("appVersion") or row.get("version") or "").strip(),
                "source": str(row.get("source") or "import").strip(),
                "appId": str(row.get("appId") or row.get("appID") or "").strip(),
                "storefront": str(row.get("storefront") or "").strip(),
                "author": str(row.get("author") or "").strip(),
                "date": str(row.get("date") or row.get("updated") or "").strip(),
                "locale": str(row.get("locale") or "").strip(),
                "rawMetadata": row,
            }
        )

    return reviews


def parse_rating(value: object) -> int:
    try:
        rating = int(float(str(value)))
    except (TypeError, ValueError):
        return 0

    return max(0, min(rating, 5))


def clean_reviews(reviews: list[dict[str, object]]) -> dict[str, object]:
    retained: list[dict[str, object]] = []
    seen_fingerprints: set[str] = set()
    duplicate_count = 0
    discarded_empty_count = 0

    for review in reviews:
        if not has_review_content(review):
            discarded_empty_count += 1
            continue

        fingerprint = review_fingerprint(review)
        if fingerprint in seen_fingerprints:
            duplicate_count += 1
            continue

        seen_fingerprints.add(fingerprint)
        retained.append(review)

    return {
        "reviews": retained,
        "summary": {
            "inputCount": len(reviews),
            "retainedCount": len(retained),
            "duplicateCount": duplicate_count,
            "discardedEmptyCount": discarded_empty_count,
        },
    }


def has_review_content(review: dict[str, object]) -> bool:
    return bool(str(review.get("title") or "").strip() or str(review.get("body") or "").strip())


def review_fingerprint(review: dict[str, object]) -> str:
    title = normalize_text_for_fingerprint(str(review.get("title") or ""))
    body = normalize_text_for_fingerprint(str(review.get("body") or ""))
    return f"{title}\n{body}"


def normalize_text_for_fingerprint(value: str) -> str:
    return " ".join(value.strip().lower().split())


def summarize_ratings(reviews: list[dict[str, object]]) -> dict[str, object]:
    ratings = [int(review["rating"]) for review in reviews if int(review["rating"]) > 0]
    rating_counts = Counter(str(rating) for rating in ratings)
    average = round(sum(ratings) / len(ratings), 2) if ratings else 0

    return {
        "averageRating": average,
        "ratingCounts": dict(sorted(rating_counts.items())),
    }
