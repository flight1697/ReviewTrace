export const defaultAppStoreLink =
  "https://apps.apple.com/us/app/workout-for-women-home-gym/id839285684";
export const defaultAnalysisGoal = "关注订阅转化相关投诉";

const apiUrl =
  process.env.NEXT_PUBLIC_REVIEWTRACE_API_URL ?? "http://localhost:8000";

export const initialStages = [
  ["范围", "等待中"],
  ["评论", "等待中"],
  ["清洗", "等待中"],
  ["证据", "等待中"],
  ["产品需求文档", "等待中"],
  ["测试", "等待中"],
  ["校验", "等待中"],
] as const;

const stageLabels: Record<string, string> = {
  analysis: "证据",
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
};

export type Finding = {
  id: string;
  title: string;
  reviewIds: string[];
  sampleCount: number;
  confidence: string;
  evidence: {
    reviewId: string;
    excerpt: string;
  }[];
  conflictingEvidence: {
    reviewId: string;
    excerpt: string;
  }[];
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

export type WorkflowRequestBody = Record<string, string>;
export type WorkflowStatus = "idle" | "running" | "failed";

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

  return (await response.json()) as WorkflowRun;
}

export function visibleWorkflowStages(
  run: WorkflowRun | null,
  status: WorkflowStatus,
) {
  if (run) {
    return run.stages.map((stage) => [
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
