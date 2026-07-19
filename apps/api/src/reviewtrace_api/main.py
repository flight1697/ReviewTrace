from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from reviewtrace_api.config import load_local_environment
from reviewtrace_api.workflow import WorkflowRunRequest
from reviewtrace_api.workflow import WorkflowRunner


load_local_environment()

app = FastAPI(title="ReviewTrace API")
workflow_runner = WorkflowRunner()

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


@app.post("/workflow/runs")
def run_workflow(request: WorkflowRunRequest) -> dict[str, object]:
    return workflow_runner.run(request)
