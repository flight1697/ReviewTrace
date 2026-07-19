import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from reviewtrace_api.config import load_local_environment
from reviewtrace_api.workflow import WorkflowRunRequest
from reviewtrace_api.workflow import WorkflowRunner
from reviewtrace_api.workflow import model_configuration


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


@app.get("/config/model")
def model_config() -> dict[str, object]:
    return model_configuration()


@app.post("/workflow/runs")
def run_workflow(request: WorkflowRunRequest) -> dict[str, object]:
    return workflow_runner.run(request)


@app.post("/workflow/runs/stream")
def stream_workflow(request: WorkflowRunRequest) -> StreamingResponse:
    def event_lines():
        try:
            for event in workflow_runner.stream(request):
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
