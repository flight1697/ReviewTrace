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
        "service": "ReviewTrace API",
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
            "label": "Cached fixture dataset",
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
                "title": "Trial ended before I understood the plan",
                "body": "I liked the workouts, but the subscription prompt appeared before I knew what was included.",
                "appVersion": "24.8",
                "source": "fixture",
            },
            {
                "id": review_ids[1],
                "rating": 3,
                "title": "Needs clearer pricing",
                "body": "The app is useful, but pricing and cancellation details were hard to find.",
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
                "title": "Subscription value and cancellation details are not clear enough before conversion.",
                "reviewIds": review_ids,
                "sampleCount": 2,
                "confidence": "medium",
                "method": "fixture model stub",
                "conflictingEvidence": [],
            }
        ],
        "requirements": [
            {
                "id": "requirement-subscription-preview",
                "title": "Show subscription value, included features, price, and cancellation path before purchase.",
                "priority": "P1",
                "findingIds": ["finding-subscription-clarity"],
                "assumption": False,
            }
        ],
        "testCases": [
            {
                "id": "test-subscription-preview-content",
                "title": "User sees subscription details before starting purchase.",
                "requirementId": "requirement-subscription-preview",
                "sourceReviewIds": review_ids,
                "steps": [
                    "Open the subscription entry point.",
                    "Review the purchase preview.",
                    "Verify included features, price, and cancellation details are visible before purchase confirmation.",
                ],
                "expectedResult": "The preview explains the subscription clearly before the user commits.",
            }
        ],
        "validationMessages": [
            "All findings, requirements, and test cases reference fixture evidence."
        ],
    }
