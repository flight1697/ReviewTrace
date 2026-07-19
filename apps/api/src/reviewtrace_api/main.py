import json

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from reviewtrace_api.config import load_local_environment
from reviewtrace_api.workflow import WorkflowRunRequest
from reviewtrace_api.workflow import WorkflowRunner
from reviewtrace_api.workflow import model_configuration


load_local_environment()

app = FastAPI(title="ReviewTrace API")
workflow_runner = WorkflowRunner()
workflow_runs: dict[str, dict[str, object]] = {}

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


@app.get("/config/model")
def model_config() -> dict[str, object]:
    return model_configuration()


@app.post("/workflow/runs")
def run_workflow(request: WorkflowRunRequest) -> dict[str, object]:
    return remember_workflow_run(workflow_runner.run(request))


@app.get("/workflow/runs")
def list_workflow_runs() -> dict[str, list[dict[str, object]]]:
    return {
        "runs": [
            workflow_run_summary(run)
            for run in reversed(list(workflow_runs.values()))
        ],
    }


@app.get("/workflow/runs/{run_id}")
def get_workflow_run(run_id: str) -> dict[str, object]:
    run = workflow_runs.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="未找到指定工作流运行。")

    return run


@app.post("/workflow/runs/stream")
def stream_workflow(request: WorkflowRunRequest) -> StreamingResponse:
    def event_lines():
        try:
            for event in workflow_runner.stream(request):
                if event.get("type") == "run":
                    remember_workflow_run(event["run"])  # type: ignore[arg-type]
                yield json.dumps(event, ensure_ascii=False) + "\n"
        except Exception as error:
            detail = getattr(error, "detail", "工作流请求失败")
            yield json.dumps(
                {
                    "type": "error",
                    "message": str(detail),
                },
                ensure_ascii=False,
            ) + "\n"

    return StreamingResponse(event_lines(), media_type="application/x-ndjson")


def remember_workflow_run(run: dict[str, object]) -> dict[str, object]:
    workflow_runs[str(run["runId"])] = run
    return run


def workflow_run_summary(run: dict[str, object]) -> dict[str, object]:
    return {
        "runId": run["runId"],
        "source": run["source"],
        "scope": run["scope"],
        "status": run["traceabilityValidation"]["status"],  # type: ignore[index]
        "reviewCount": len(run.get("reviews", [])),
        "findingCount": len(run.get("findings", [])),
        "requirementCount": len(run.get("requirements", [])),
        "testCaseCount": len(run.get("testCases", [])),
    }
