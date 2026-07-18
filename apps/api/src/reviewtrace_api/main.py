import csv
import io
import json
import os
from collections import Counter
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


app = FastAPI(title="ReviewTrace API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "ReviewTrace 后端服务",
    }


class WorkflowRunRequest(BaseModel):
    app_store_url: str = Field(alias="appStoreUrl")
    analysis_goal: str = Field(default="", alias="analysisGoal")
    source_mode: str = Field(default="fixture", alias="sourceMode")
    dataset_format: str | None = Field(default=None, alias="datasetFormat")
    dataset_text: str | None = Field(default=None, alias="datasetText")


@app.post("/workflow/runs")
def run_workflow(request: WorkflowRunRequest) -> dict[str, object]:
    if request.source_mode == "import":
        return run_import_workflow(request)

    reviews = load_fixture_reviews()
    review_ids = [str(review["id"]) for review in reviews]

    return {
        "runId": "fixture-run-001",
        "source": {
            "mode": request.source_mode,
            "label": "缓存示例数据集",
        },
        "scope": {
            "appStoreUrl": request.app_store_url,
            "analysisGoal": request.analysis_goal,
            "storefront": "us",
        },
        "stages": completed_stages(),
        "rawReviews": reviews,
        "reviews": reviews,
        "cleaningSummary": {
            "inputCount": 2,
            "retainedCount": 2,
            "duplicateCount": 0,
            "discardedEmptyCount": 0,
        },
        "ratingSummary": summarize_ratings(reviews),
        "analysisSummary": {
            "provider": "stub",
            "model": "fixture-model-stub",
            "modelDriven": False,
        },
        "findings": [
            {
                "id": "finding-subscription-clarity",
                "title": "订阅转化前，订阅价值和取消方式说明不够清楚。",
                "reviewIds": review_ids,
                "sampleCount": 2,
                "confidence": "中等",
                "method": "示例模型桩",
                "conflictingEvidence": [],
            }
        ],
        "requirements": [
            {
                "id": "requirement-subscription-preview",
                "title": "购买前展示订阅价值、包含功能、价格和取消路径。",
                "priority": "P1",
                "findingIds": ["finding-subscription-clarity"],
                "assumption": False,
            }
        ],
        "testCases": [
            {
                "id": "test-subscription-preview-content",
                "title": "用户在发起购买前可以看到订阅详情。",
                "requirementId": "requirement-subscription-preview",
                "sourceReviewIds": review_ids,
                "steps": [
                    "打开订阅入口。",
                    "查看购买前预览。",
                    "确认在购买确认前可以看到包含功能、价格和取消订阅说明。",
                ],
                "expectedResult": "购买前预览能在用户确认前清楚解释订阅内容。",
            }
        ],
        "validationMessages": [
            "所有发现、需求和测试用例都已关联示例评论证据。"
        ],
    }


def run_import_workflow(request: WorkflowRunRequest) -> dict[str, object]:
    dataset_format = (request.dataset_format or "").lower()
    dataset_text = request.dataset_text or ""

    if not dataset_text.strip():
        raise HTTPException(status_code=400, detail="导入数据不能为空。")

    raw_reviews = parse_imported_reviews(dataset_format, dataset_text)
    cleaning_result = clean_reviews(raw_reviews)
    reviews = cleaning_result["reviews"]
    review_ids = [review["id"] for review in reviews]
    analysis = analyze_reviews(reviews, request.analysis_goal)

    return {
        "runId": "import-run-001",
        "source": {
            "mode": "import",
            "label": f"导入的 {dataset_format.upper()} 数据集",
        },
        "scope": {
            "appStoreUrl": request.app_store_url,
            "analysisGoal": request.analysis_goal,
            "storefront": "us",
        },
        "stages": completed_stages(),
        "rawReviews": raw_reviews,
        "reviews": reviews,
        "cleaningSummary": cleaning_result["summary"],
        "ratingSummary": summarize_ratings(reviews),
        "analysisSummary": analysis["summary"],
        "findings": analysis["findings"],
        "requirements": [],
        "testCases": [],
        "validationMessages": [
            "导入数据已完成结构化、清洗和基础统计，后续语义分析会在模型阶段替换当前占位结果。"
        ],
    }


def analyze_reviews(
    reviews: list[dict[str, object]],
    analysis_goal: str,
) -> dict[str, object]:
    provider = os.getenv("MODEL_PROVIDER", "stub").lower()
    model = os.getenv("MODEL_NAME", "gpt-5.6-sol")

    if provider == "openai" and os.getenv("OPENAI_API_KEY"):
        prompt = build_review_analysis_prompt(reviews, analysis_goal)
        model_output = call_openai_responses_api(prompt, model)
        findings = parse_model_findings(model_output, reviews, f"openai:{model}")

        return {
            "summary": {
                "provider": "openai",
                "model": model,
                "modelDriven": True,
            },
            "findings": findings,
        }

    return build_stub_analysis(reviews)


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
