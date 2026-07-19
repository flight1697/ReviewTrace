import csv
import io
import json
import os
import re
import urllib.error
import urllib.request
from collections.abc import Callable
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from typing import Protocol
from urllib.parse import urlparse

from fastapi import HTTPException
from pydantic import BaseModel, Field

from reviewtrace_api.artifacts import validated_workflow_run


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
            "fixture": FixtureReviewSourceAdapter(),
            "import": ImportedReviewSourceAdapter(),
        }

    def run(self, request: WorkflowRunRequest) -> dict[str, object]:
        return run_review_workflow(request, self.source_adapters)


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


class FixtureReviewSourceAdapter:
    def collect(self, request: WorkflowRunRequest) -> ReviewSourceBatch:
        return ReviewSourceBatch(
            run_id="fixture-run-001",
            source={
                "mode": request.source_mode,
                "label": "缓存示例数据集",
            },
            scope={
                "appStoreUrl": request.app_store_url,
                "analysisGoal": request.analysis_goal,
                "storefront": "us",
            },
            raw_reviews=load_fixture_reviews(),
            validation_messages=[
                "所有发现、需求和测试用例都已关联示例评论证据。"
            ],
            analysis_override=build_fixture_analysis,
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
                "导入数据已完成结构化、清洗和基础统计，后续语义分析会在模型阶段替换当前占位结果。"
            ],
        )


def run_review_workflow(
    request: WorkflowRunRequest,
    source_adapters: dict[str, ReviewSourceAdapter],
) -> dict[str, object]:
    source_adapter = source_adapters.get(request.source_mode)
    if not source_adapter:
        raise HTTPException(status_code=400, detail="sourceMode 必须是 live、fixture 或 import。")

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


def complete_review_workflow(
    raw_reviews: list[dict[str, object]],
    analysis_goal: str,
    analysis_override: Any | None = None,
) -> dict[str, object]:
    cleaning_result = clean_reviews(raw_reviews)
    reviews = cleaning_result["reviews"]
    analysis = (
        analysis_override(reviews)
        if analysis_override
        else analyze_reviews(reviews, analysis_goal)
    )
    findings = enrich_findings_with_evidence(analysis["findings"], reviews)
    artifacts = generate_product_artifacts(analysis_goal, findings, reviews)

    return {
        "cleaningSummary": cleaning_result["summary"],
        "reviews": reviews,
        "ratingSummary": summarize_ratings(reviews),
        "analysisSummary": analysis["summary"],
        "findings": artifacts["findings"],
        "requirements": artifacts["requirements"],
        "versionPlan": artifacts["versionPlan"],
        "prd": artifacts["prd"],
        "testCases": artifacts["testCases"],
        "dataLimitations": artifacts["dataLimitations"],
        "traceabilityValidation": artifacts["traceabilityValidation"],
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
        "rawReviews": raw_reviews,
        "reviews": workflow["reviews"],
        "cleaningSummary": workflow["cleaningSummary"],
        "ratingSummary": workflow["ratingSummary"],
        "analysisSummary": workflow["analysisSummary"],
        "findings": workflow["findings"],
        "requirements": workflow["requirements"],
        "versionPlan": workflow["versionPlan"],
        "prd": workflow["prd"],
        "testCases": workflow["testCases"],
        "dataLimitations": workflow["dataLimitations"],
        "traceabilityValidation": workflow["traceabilityValidation"],
        "validationMessages": validation_messages,
    })


def build_fixture_analysis(reviews: list[dict[str, object]]) -> dict[str, object]:
    review_ids = [str(review["id"]) for review in reviews]

    return {
        "summary": {
            "provider": "stub",
            "model": "fixture-model-stub",
            "modelDriven": False,
        },
        "findings": [
            {
                "id": "finding-subscription-clarity",
                "title": "订阅转化前，订阅价值和取消方式说明不够清楚。",
                "reviewIds": review_ids,
                "sampleCount": len(review_ids),
                "confidence": "中等",
                "method": "示例模型桩",
                "conflictingEvidence": [],
            }
        ],
    }


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


def analyze_reviews(
    reviews: list[dict[str, object]],
    analysis_goal: str,
) -> dict[str, object]:
    provider = os.getenv("MODEL_PROVIDER", "stub").lower()
    model = configured_model_name(provider)

    if provider == "openai" and os.getenv("OPENAI_API_KEY"):
        prompt = build_review_analysis_prompt(reviews, analysis_goal)
        try:
            model_output = call_openai_responses_api(prompt, model)
        except Exception as error:
            raise HTTPException(
                status_code=502,
                detail="模型服务不可用，请检查 API key、网络或改用确定性兜底。",
            ) from error
        findings = parse_model_findings(model_output, reviews, f"openai:{model}")

        return {
            "summary": {
                "provider": "openai",
                "model": model,
                "modelDriven": True,
            },
            "findings": findings,
        }

    if provider == "deepseek" and os.getenv("DEEPSEEK_API_KEY"):
        prompt = build_review_analysis_prompt(reviews, analysis_goal)
        try:
            model_output = call_deepseek_chat_api(prompt, model)
        except Exception as error:
            raise HTTPException(
                status_code=502,
                detail="DeepSeek 模型服务不可用，请检查 API key、网络或改用确定性兜底。",
            ) from error
        findings = parse_model_findings(model_output, reviews, f"deepseek:{model}")

        return {
            "summary": {
                "provider": "deepseek",
                "model": model,
                "modelDriven": True,
            },
            "findings": findings,
        }

    return build_stub_analysis(reviews)


def configured_model_name(provider: str) -> str:
    if os.getenv("MODEL_NAME"):
        return str(os.getenv("MODEL_NAME"))

    if provider == "deepseek":
        return "deepseek-v4-flash"

    return "gpt-5.6-sol"


def model_configuration() -> dict[str, object]:
    """Return safe, user-facing model configuration without exposing secrets."""

    provider = os.getenv("MODEL_PROVIDER", "stub").lower()
    model = (
        "deterministic-import-summary"
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
        message = f"未配置 {key_name}，当前将使用确定性兜底分析。"
    else:
        message = "当前使用确定性兜底分析。配置支持的模型 provider 和 API key 后可启用模型分析。"

    return {
        "provider": provider,
        "model": model,
        "keyConfigured": key_configured,
        "modelDrivenAvailable": model_driven_available,
        "fallbackAvailable": True,
        "message": message,
    }


def build_stub_analysis(reviews: list[dict[str, object]]) -> dict[str, object]:
    review_ids = [str(review["id"]) for review in reviews]

    return {
        "summary": {
            "provider": "stub",
            "model": "deterministic-import-summary",
            "modelDriven": False,
        },
        "findings": [
            {
                "id": "finding-imported-feedback",
                "title": f"导入评论中出现了 {len(reviews)} 条可分析反馈。",
                "reviewIds": review_ids,
                "sampleCount": len(reviews),
                "confidence": "待模型分析",
                "method": "确定性导入摘要",
                "conflictingEvidence": [],
            }
        ],
    }


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
            "请根据分析目标，从评论中归纳主要用户问题。",
            "只能使用输入评论中存在的证据，不要编造 reviewId、样本数或结论。",
            "请只返回 JSON，不要返回 Markdown。",
            "JSON 结构：{\"findings\":[{\"id\":\"...\",\"title\":\"...\",\"reviewIds\":[\"...\"],\"sampleCount\":1,\"confidence\":\"高/中/低\",\"conflictingEvidence\":[]}]}",
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


def parse_model_findings(
    model_output: str,
    reviews: list[dict[str, object]],
    method: str,
) -> list[dict[str, object]]:
    try:
        parsed = json.loads(model_output)
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

    return validated_findings or build_stub_analysis(reviews)["findings"]


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
        finding_with_evidence = {
            **finding,
            "reviewIds": [item["reviewId"] for item in evidence],
            "sampleCount": len(evidence),
            "evidence": evidence,
            "conflictingEvidence": finding.get("conflictingEvidence")
            or conflicting_evidence(review_ids, reviews_by_id),
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


def data_limitations(reviews: list[dict[str, object]]) -> list[str]:
    limitations: list[str] = []

    if not reviews:
        limitations.append("没有获取到可分析评论，请检查链接或改用导入评论。")
    elif len(reviews) < 10:
        limitations.append("样本量较小，当前结论应视为方向性信号。")

    return limitations


def generate_product_artifacts(
    analysis_goal: str,
    findings: list[dict[str, object]],
    reviews: list[dict[str, object]],
) -> dict[str, object]:
    requirements = generate_requirements(findings)
    test_cases = generate_test_cases(requirements)
    version_plan = generate_version_plan(requirements)

    return {
        "findings": findings,
        "requirements": requirements,
        "versionPlan": version_plan,
        "prd": generate_prd(analysis_goal, requirements, version_plan),
        "testCases": test_cases,
        "dataLimitations": data_limitations(reviews),
        "traceabilityValidation": validate_traceability(
            findings,
            reviews,
            requirements,
            test_cases,
        ),
    }


def generate_requirements(findings: list[dict[str, object]]) -> list[dict[str, object]]:
    requirements: list[dict[str, object]] = []

    for finding in findings:
        review_ids = [str(review_id) for review_id in finding.get("reviewIds", [])]
        if not review_ids:
            continue

        finding_id = str(finding["id"])
        priority = requirement_priority(finding)
        requirements.append(
            {
                "id": requirement_id_for_finding(finding_id),
                "title": f"围绕「{trim_sentence(str(finding['title']))}」制定可验证改进。",
                "priority": priority,
                "version": "v1" if priority == "P1" else "v2",
                "findingIds": [finding_id],
                "sourceReviewIds": review_ids,
                "boundaries": [
                    "仅覆盖当前评论证据直接支持的问题。",
                    "不扩展到评论中未出现的全新业务能力。",
                ],
                "assumption": False,
            }
        )

    return requirements


def requirement_priority(finding: dict[str, object]) -> str:
    sample_count = int(finding.get("sampleCount") or 0)
    confidence = str(finding.get("confidence") or "")

    if sample_count >= 2 and confidence in {"高", "中", "中等", "待模型分析"}:
        return "P1"

    return "P2"


def requirement_id_for_finding(finding_id: str) -> str:
    if finding_id.startswith("finding-"):
        return f"requirement-{finding_id.removeprefix('finding-')}"

    return f"requirement-{finding_id}"


def trim_sentence(value: str) -> str:
    return value.strip().rstrip("。.!！")


def generate_version_plan(
    requirements: list[dict[str, object]],
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
                "优先交付有明确评论证据和较高样本支撑的问题。",
                first_version_requirements,
            )
        )

    if later_version_requirements:
        versions.append(
            version_plan_item(
                "v2",
                "版本 2：补充验证后的增强项",
                "处理样本较少或置信度较弱、需要继续观察的问题。",
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
    requirements: list[dict[str, object]],
    version_plan: dict[str, list[dict[str, object]]],
) -> dict[str, object]:
    goal = analysis_goal.strip() or "当前分析目标"

    return {
        "title": "ReviewTrace 产品需求文档草案",
        "objective": f"围绕「{goal}」回应已导入评论中的高证据问题。",
        "versions": version_plan["versions"],
        "requirements": requirements,
        "successMetrics": [
            "每条需求都能追溯到至少一条原始评论。",
            "版本范围只包含当前证据支持的问题。",
        ],
        "assumptions": [
            requirement
            for requirement in requirements
            if bool(requirement.get("assumption"))
        ],
    }


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
            "expectedResult": (
                f"源评论 {', '.join(str(review_id) for review_id in requirement['sourceReviewIds'])} "
                f"指出的问题被「{trim_sentence(str(requirement['title']))}」直接解决，"
                "且测试结果能追溯到对应需求。"
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

    return [
        f"准备覆盖源评论 {source_review_ids} 所描述问题的用户情境。",
        f"执行需求对应流程：{trim_sentence(str(requirement['title']))}。",
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


def load_fixture_reviews() -> list[dict[str, object]]:
    fixture_path = Path(__file__).with_name("fixtures") / "sample_reviews.json"
    return parse_json_reviews(fixture_path.read_text(encoding="utf-8"))


def completed_stages() -> list[dict[str, str]]:
    return [
        {"name": "scope", "status": "complete"},
        {"name": "reviews", "status": "complete"},
        {"name": "cleaning", "status": "complete"},
        {"name": "analysis", "status": "complete"},
        {"name": "prd", "status": "complete"},
        {"name": "tests", "status": "complete"},
        {"name": "validation", "status": "complete"},
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
