"use client";

import { useEffect, useState } from "react";

export const defaultAppStoreLink =
  "https://apps.apple.com/us/app/workout-for-women-home-gym/id839285684";
export const defaultAnalysisGoal = "关注订阅转化相关投诉";

const apiUrl =
  process.env.NEXT_PUBLIC_REVIEWTRACE_API_URL ?? "http://localhost:8000";

export const initialStages = [
  ["评论", "等待中"],
  ["清洗", "等待中"],
  ["范围", "等待中"],
  ["分类结果", "等待中"],
  ["产品需求文档", "等待中"],
  ["测试", "等待中"],
  ["校验", "等待中"],
] as const;

const stageLabels: Record<string, string> = {
  analysis: "分类结果",
  cleaning: "清洗",
  prd: "产品需求文档",
  reviews: "评论",
  scope: "范围",
  tests: "测试",
  validation: "校验",
};

const statusLabels: Record<string, string> = {
  complete: "已完成",
  failed: "失败",
  pending: "等待中",
  running: "运行中",
};

export type WorkflowStage = {
  name: string;
  status: string;
};

export type Review = {
  id: string;
  rating: number;
  title: string;
  body: string;
  appVersion?: string;
  source?: string;
  appId?: string;
  storefront?: string;
  author?: string;
  date?: string;
  locale?: string;
  rawMetadata?: Record<string, unknown>;
};

export type Finding = {
  id: string;
  title: string;
  reviewIds: string[];
  sampleCount: number;
  confidence: string;
  method: string;
  evidence: {
    reviewId: string;
    excerpt: string;
  }[];
  conflictingEvidence: {
    reviewId: string;
    excerpt: string;
  }[];
};

export type AnalysisScope = {
  requestedGoal: string;
  focusSummary: string;
  focusAreas: string[];
  dataSignals: string[];
  constraints: string[];
  uncertaintyNotes: string[];
  scopeReviewIds?: string[];
  selectionSummary?: string;
  filteringRules?: string[];
  excludedReviewIds?: string[];
};

export type Requirement = {
  id: string;
  title: string;
  priority: string;
  version: string;
  findingIds: string[];
  sourceReviewIds: string[];
  boundaries: string[];
  assumption: boolean;
  acceptanceCriteria?: string[];
};

export type VersionPlan = {
  versions: {
    id: string;
    name: string;
    goal: string;
    requirementIds: string[];
    sourceReviewIds: string[];
  }[];
};

export type PrdDraft = {
  title: string;
  objective: string;
  scopeSummary: AnalysisScope;
  versions: VersionPlan["versions"];
  requirements: Requirement[];
  successMetrics: string[];
  assumptions: Requirement[];
};

export type TestCase = {
  id: string;
  title: string;
  requirementId: string;
  sourceReviewIds: string[];
  steps: string[];
  expectedResult: string;
  verificationPoints?: string[];
};

export type StageReport = {
  name: string;
  status: string;
  summary: string;
  details: string[];
  revisions: string[];
  errors: string[];
};

export type WorkflowRun = {
  runId: string;
  source: {
    mode: string;
    label: string;
  };
  scope: {
    appStoreUrl: string;
    analysisGoal: string;
    storefront: string;
  };
  stages: WorkflowStage[];
  rawReviews: Review[];
  reviews: Review[];
  cleaningSummary: {
    inputCount: number;
    retainedCount: number;
    duplicateCount: number;
    discardedEmptyCount: number;
  };
  ratingSummary: {
    averageRating: number;
    ratingCounts: Record<string, number>;
  };
  analysisSummary: {
    provider: string;
    model: string;
    modelDriven: boolean;
  };
  analysisScope?: AnalysisScope;
  stageReports?: StageReport[];
  findings: Finding[];
  requirements: Requirement[];
  versionPlan: VersionPlan;
  prd: PrdDraft;
  testCases: TestCase[];
  dataLimitations: string[];
  traceabilityValidation: {
    status: string;
    unsupportedFindingIds: string[];
    unsupportedRequirementIds: string[];
    unsupportedTestCaseIds: string[];
  };
  validationMessages: string[];
};

export type WorkflowRunSummary = {
  runId: string;
  source: WorkflowRun["source"];
  scope: WorkflowRun["scope"];
  status: string;
  reviewCount: number;
  findingCount: number;
  requirementCount: number;
  testCaseCount: number;
};

export type WorkflowRequestBody = Record<string, string>;
export type WorkflowStatus = "idle" | "running" | "failed";

export type WorkflowStreamEvent =
  | {
      type: "stage";
      stage: WorkflowStage;
      stages?: WorkflowStage[];
    }
  | {
      type: "report";
      report: StageReport;
    }
  | {
      type: "run";
      run: WorkflowRun;
    }
  | {
      type: "error";
      message: string;
    };

export type ModelStatus = {
  provider: string;
  model: string;
  keyConfigured: boolean;
  modelDrivenAvailable: boolean;
  fallbackAvailable: boolean;
  message: string;
};

const unavailableModelStatus: ModelStatus = {
  provider: "unknown",
  model: "unknown",
  keyConfigured: false,
  modelDrivenAvailable: false,
  fallbackAvailable: true,
  message: "模型配置状态暂时不可用，工作流仍会按后端配置运行。",
};

export function useModelStatus() {
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);

  useEffect(() => {
    requestModelStatus()
      .then(setModelStatus)
      .catch(() => setModelStatus(unavailableModelStatus));
  }, []);

  return modelStatus;
}

export function useWorkflowRun() {
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [status, setStatus] = useState<WorkflowStatus>("idle");
  const [error, setError] = useState("");
  const [progressStages, setProgressStages] = useState<WorkflowStage[]>([]);
  const [stageReports, setStageReports] = useState<StageReport[]>([]);

  async function requestWorkflow(body: WorkflowRequestBody) {
    setStatus("running");
    setError("");
    setRun(null);
    setProgressStages([]);
    setStageReports([]);

    try {
      setRun(
        await requestWorkflowRunStream(body, (event) => {
          if (event.type === "stage") {
            setProgressStages(event.stages ?? [event.stage]);
          }

          if (event.type === "report") {
            setStageReports((reports) =>
              upsertStageReport(reports, event.report),
            );
          }
        }),
      );
      setStatus("idle");
    } catch (caughtError) {
      setStatus("failed");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "工作流请求失败",
      );
    }
  }

  function failWorkflow(caughtError: unknown, fallbackMessage: string) {
    setRun(null);
    setProgressStages([]);
    setStageReports([]);
    setStatus("failed");
    setError(
      caughtError instanceof Error ? caughtError.message : fallbackMessage,
    );
  }

  return {
    error,
    failWorkflow,
    progressStages,
    requestWorkflow,
    run,
    stageReports,
    status,
  };
}

export async function requestWorkflowRun(
  body: WorkflowRequestBody,
): Promise<WorkflowRun> {
  const response = await fetch(`${apiUrl}/workflow/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await workflowErrorMessage(response));
  }

  return parseWorkflowRun(await response.json());
}

export async function requestWorkflowRunById(runId: string): Promise<WorkflowRun> {
  const response = await fetch(`${apiUrl}/workflow/runs/${encodeURIComponent(runId)}`);

  if (!response.ok) {
    throw new Error(await workflowErrorMessage(response));
  }

  return parseWorkflowRun(await response.json());
}

export async function requestWorkflowRunSummaries(): Promise<WorkflowRunSummary[]> {
  const response = await fetch(`${apiUrl}/workflow/runs`);

  if (!response.ok) {
    throw new Error(await workflowErrorMessage(response));
  }

  const body = (await response.json()) as { runs?: WorkflowRunSummary[] };
  return body.runs ?? [];
}

export async function requestWorkflowRunStream(
  body: WorkflowRequestBody,
  onEvent: (event: WorkflowStreamEvent) => void,
): Promise<WorkflowRun> {
  const response = await fetch(`${apiUrl}/workflow/runs/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await workflowErrorMessage(response));
  }

  if (!response.body) {
    return parseWorkflowRun(await response.json());
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalRun: WorkflowRun | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const event = parseWorkflowStreamEvent(line);
      if (!event) {
        continue;
      }

      if (event.type === "error") {
        throw new Error(event.message || "工作流请求失败");
      }

      onEvent(event);

      if (event.type === "run") {
        finalRun = parseWorkflowRun(event.run);
      }
    }

    if (done) {
      break;
    }
  }

  const finalEvent = parseWorkflowStreamEvent(buffer);
  if (finalEvent) {
    if (finalEvent.type === "error") {
      throw new Error(finalEvent.message || "工作流请求失败");
    }

    onEvent(finalEvent);

    if (finalEvent.type === "run") {
      finalRun = parseWorkflowRun(finalEvent.run);
    }
  }

  if (!finalRun) {
    throw new Error("工作流流式响应缺少最终报告");
  }

  return finalRun;
}

export async function requestModelStatus(): Promise<ModelStatus> {
  const response = await fetch(`${apiUrl}/config/model`);

  if (!response.ok) {
    throw new Error("模型配置状态获取失败");
  }

  const body = (await response.json()) as Partial<ModelStatus>;
  if (
    !body.provider ||
    !body.model ||
    !body.message ||
    typeof body.keyConfigured !== "boolean" ||
    typeof body.modelDrivenAvailable !== "boolean" ||
    typeof body.fallbackAvailable !== "boolean"
  ) {
    throw new Error("模型配置状态格式无效");
  }

  return body as ModelStatus;
}

export function visibleWorkflowStages(
  run: WorkflowRun | null,
  status: WorkflowStatus,
  progressStages: WorkflowStage[] = [],
) {
  if (run) {
    return run.stages.map((stage) => [
      stageLabels[stage.name] ?? stage.name,
      statusLabels[stage.status] ?? stage.status,
    ]);
  }

  if (progressStages.length) {
    return progressStages.map((stage) => [
      stageLabels[stage.name] ?? stage.name,
      statusLabels[stage.status] ?? stage.status,
    ]);
  }

  if (status === "running") {
    return initialStages.map(([name], index) => [
      name,
      index === 0 ? "运行中" : "等待中",
    ]);
  }

  if (status === "failed") {
    return initialStages.map(([name], index) => [
      name,
      index === 0 ? "失败" : "等待中",
    ]);
  }

  return initialStages;
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      resolve(String(reader.result ?? ""));
    });
    reader.addEventListener("error", () => {
      reject(new Error("读取导入文件失败"));
    });
    reader.readAsText(file);
  });
}

async function workflowErrorMessage(response: Response) {
  try {
    const errorBody = (await response.json()) as { detail?: string };
    return errorBody.detail || "工作流请求失败";
  } catch {
    return "工作流请求失败";
  }
}

function parseWorkflowStreamEvent(line: string): WorkflowStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const event = JSON.parse(trimmed) as WorkflowStreamEvent;
  if (event.type === "run") {
    return {
      ...event,
      run: parseWorkflowRun(event.run),
    };
  }

  return event;
}

export function parseWorkflowRun(body: unknown): WorkflowRun {
  if (!isRecord(body)) {
    throw new Error("工作流运行格式无效");
  }

  const requiredArrays = [
    "stages",
    "rawReviews",
    "reviews",
    "stageReports",
    "findings",
    "requirements",
    "testCases",
    "dataLimitations",
    "validationMessages",
  ];
  const requiredObjects = [
    "source",
    "scope",
    "cleaningSummary",
    "ratingSummary",
    "analysisSummary",
    "versionPlan",
    "prd",
    "traceabilityValidation",
  ];

  if (
    typeof body.runId !== "string" ||
    !requiredArrays.every((key) => Array.isArray(body[key])) ||
    !requiredObjects.every((key) => isRecord(body[key]))
  ) {
    throw new Error("工作流运行格式无效");
  }

  return body as WorkflowRun;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function upsertStageReport(
  reports: StageReport[],
  nextReport: StageReport,
): StageReport[] {
  const index = reports.findIndex((report) => report.name === nextReport.name);
  if (index === -1) {
    return [...reports, nextReport];
  }

  return reports.map((report, reportIndex) =>
    reportIndex === index ? nextReport : report,
  );
}
