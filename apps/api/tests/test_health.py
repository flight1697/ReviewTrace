from fastapi.testclient import TestClient

from reviewtrace_api.main import app


def test_health_check_identifies_reviewtrace_api():
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "ReviewTrace API",
    }


def test_fixture_workflow_returns_traceable_artifacts():
    client = TestClient(app)

    response = client.post(
        "/workflow/runs",
        json={
            "appStoreUrl": "https://apps.apple.com/us/app/workout-for-women-home-gym/id839285684",
            "analysisGoal": "Focus on subscription conversion complaints",
            "sourceMode": "fixture",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"]["mode"] == "fixture"
    assert body["scope"]["analysisGoal"] == "Focus on subscription conversion complaints"
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
        "All findings, requirements, and test cases reference fixture evidence."
    ]
