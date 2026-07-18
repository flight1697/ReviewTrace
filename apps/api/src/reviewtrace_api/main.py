import csv
import io
import json
from collections import Counter
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

    review_ids = ["fixture-review-001", "fixture-review-002"]
    reviews = [
        {
            "id": review_ids[0],
            "rating": 2,
            "title": "还没理解套餐内容，试用就结束了",
            "body": "我喜欢这些训练内容，但在我弄清楚包含哪些功能之前，订阅弹窗就出现了。",
            "appVersion": "24.8",
            "source": "fixture",
        },
        {
            "id": review_ids[1],
            "rating": 3,
            "title": "价格说明需要更清楚",
            "body": "这个 App 很有用，但价格和取消订阅的说明不太好找。",
            "appVersion": "24.8",
            "source": "fixture",
        },
    ]

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
        },
        "ratingSummary": summarize_ratings(reviews),
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
    reviews = retain_review_content(raw_reviews)
    review_ids = [review["id"] for review in reviews]

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
        "cleaningSummary": {
            "inputCount": len(raw_reviews),
            "retainedCount": len(reviews),
            "duplicateCount": 0,
        },
        "ratingSummary": summarize_ratings(reviews),
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
        "requirements": [],
        "testCases": [],
        "validationMessages": [
            "导入数据已完成结构化、清洗和基础统计，后续语义分析会在模型阶段替换当前占位结果。"
        ],
    }


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


def retain_review_content(reviews: list[dict[str, object]]) -> list[dict[str, object]]:
    return [
        review
        for review in reviews
        if str(review.get("title") or "").strip() or str(review.get("body") or "").strip()
    ]


def summarize_ratings(reviews: list[dict[str, object]]) -> dict[str, object]:
    ratings = [int(review["rating"]) for review in reviews if int(review["rating"]) > 0]
    rating_counts = Counter(str(rating) for rating in ratings)
    average = round(sum(ratings) / len(ratings), 2) if ratings else 0

    return {
        "averageRating": average,
        "ratingCounts": dict(sorted(rating_counts.items())),
    }
