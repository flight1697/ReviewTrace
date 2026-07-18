from fastapi import FastAPI
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


@app.post("/workflow/runs")
def run_workflow(request: WorkflowRunRequest) -> dict[str, object]:
    review_ids = ["fixture-review-001", "fixture-review-002"]

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
        "stages": [
            {"name": "scope", "status": "complete"},
            {"name": "reviews", "status": "complete"},
            {"name": "cleaning", "status": "complete"},
            {"name": "analysis", "status": "complete"},
            {"name": "prd", "status": "complete"},
            {"name": "tests", "status": "complete"},
            {"name": "validation", "status": "complete"},
        ],
        "reviews": [
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
        ],
        "cleaningSummary": {
            "inputCount": 2,
            "retainedCount": 2,
            "duplicateCount": 0,
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
