import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Home from "./page";
import { buildWorkbenchModel } from "./workbench-view-model";
import { parseWorkflowRun } from "./workflow";

const modelStatusResponse = {
  provider: "deepseek",
  model: "deepseek-v4-flash",
  keyConfigured: true,
  modelDrivenAvailable: true,
  fallbackAvailable: true,
  message: "模型已就绪。",
};

const workflowRunResponse = {
  runId: "import-run-001",
  source: {
    mode: "import",
    label: "导入的 JSON 数据集",
  },
  scope: {
    appStoreUrl: "https://apps.apple.com/us/app/example/id123456789",
    analysisGoal: "关注订阅说明",
    storefront: "us",
  },
  stages: [
    { name: "reviews", status: "complete" },
    { name: "cleaning", status: "complete" },
    { name: "scope", status: "complete" },
    { name: "analysis", status: "complete" },
    { name: "prd", status: "complete" },
    { name: "tests", status: "complete" },
    { name: "validation", status: "complete" },
  ],
  rawReviews: [
    {
      id: "json-001",
      rating: 2,
      title: "订阅说明不清楚",
      body: "购买前没有看懂价格和取消方式。",
      appVersion: "1.0.0",
      source: "import",
      date: "2026-07-20",
      locale: "zh-CN",
    },
  ],
  reviews: [
    {
      id: "json-001",
      rating: 2,
      title: "订阅说明不清楚",
      body: "购买前没有看懂价格和取消方式。",
      appVersion: "1.0.0",
      source: "import",
      date: "2026-07-20",
      locale: "zh-CN",
    },
  ],
  cleaningSummary: {
    inputCount: 1,
    retainedCount: 1,
    duplicateCount: 0,
    discardedEmptyCount: 0,
  },
  ratingSummary: {
    averageRating: 2,
    ratingCounts: { "2": 1 },
  },
  analysisSummary: {
    provider: "stub",
    model: "deterministic-import-summary",
    modelDriven: false,
  },
  analysisScope: {
    requestedGoal: "关注订阅说明",
    focusSummary: "订阅说明需要在购买前更清楚地解释。",
    focusAreas: ["订阅说明"],
    dataSignals: ["低评分评论明确提到价格和取消方式"],
    constraints: ["仅覆盖导入数据"],
    uncertaintyNotes: [],
    scopeReviewIds: ["json-001"],
    selectionSummary: "清洗后只有 1 条评论，系统保留全部评论以避免过度过滤。",
    filteringRules: ["保留全部评论"],
    excludedReviewIds: [],
  },
  stageReports: [
    {
      name: "reviews",
      status: "complete",
      summary: "收集到 1 条原始评论，清洗后保留 1 条。",
      details: ["原始评论数：1", "保留评论数：1"],
      revisions: [],
      errors: [],
    },
  ],
  findings: [
    {
      id: "finding-subscription-copy",
      title: "订阅说明需要在购买前更清楚地解释。",
      reviewIds: ["json-001"],
      sampleCount: 1,
      confidence: "高",
      method: "stub:deterministic-import-summary",
      evidence: [
        {
          reviewId: "json-001",
          excerpt: "订阅说明不清楚：购买前没有看懂价格和取消方式。",
        },
      ],
      conflictingEvidence: [],
    },
  ],
  requirements: [
    {
      id: "requirement-subscription-copy",
      title: "购买前展示价格、套餐内容和取消方式。",
      priority: "P0",
      version: "v1",
      findingIds: ["finding-subscription-copy"],
      sourceReviewIds: ["json-001"],
      boundaries: ["不改动支付供应商流程"],
      assumption: false,
      acceptanceCriteria: ["订阅确认前显式展示价格和取消方式。"],
    },
  ],
  versionPlan: {
    versions: [
      {
        id: "v1",
        name: "版本 1：证据支撑的核心改进",
        goal: "优先交付订阅说明修复。",
        requirementIds: ["requirement-subscription-copy"],
        sourceReviewIds: ["json-001"],
      },
    ],
  },
  prd: {
    title: "ReviewTrace 产品需求文档草案",
    objective: "围绕「关注订阅说明」回应已导入评论中的高证据问题。",
    scopeSummary: {
      requestedGoal: "关注订阅说明",
      focusSummary: "订阅说明需要在购买前更清楚地解释。",
      focusAreas: ["订阅说明"],
      dataSignals: ["低评分评论明确提到价格和取消方式"],
      constraints: ["仅覆盖导入数据"],
      uncertaintyNotes: [],
      scopeReviewIds: ["json-001"],
      selectionSummary: "清洗后只有 1 条评论，系统保留全部评论以避免过度过滤。",
      filteringRules: ["保留全部评论"],
      excludedReviewIds: [],
    },
    versions: [
      {
        id: "v1",
        name: "版本 1：证据支撑的核心改进",
        goal: "优先交付订阅说明修复。",
        requirementIds: ["requirement-subscription-copy"],
        sourceReviewIds: ["json-001"],
      },
    ],
    requirements: [
      {
        id: "requirement-subscription-copy",
        title: "购买前展示价格、套餐内容和取消方式。",
        priority: "P0",
        version: "v1",
        findingIds: ["finding-subscription-copy"],
        sourceReviewIds: ["json-001"],
        boundaries: ["不改动支付供应商流程"],
        assumption: false,
        acceptanceCriteria: ["订阅确认前显式展示价格和取消方式。"],
      },
    ],
    successMetrics: ["每条需求都能追溯到至少一条原始评论。"],
    assumptions: [],
  },
  testCases: [
    {
      id: "test-subscription-copy",
      title: "验证：购买前展示价格、套餐内容和取消方式。",
      requirementId: "requirement-subscription-copy",
      sourceReviewIds: ["json-001"],
      steps: ["打开订阅确认页。", "核对价格、套餐内容和取消方式。"],
      expectedResult: "源评论 json-001 指出的问题被直接回应。",
      verificationPoints: ["订阅确认前显式展示价格和取消方式。"],
    },
  ],
  dataLimitations: [],
  traceabilityValidation: {
    status: "passed",
    unsupportedFindingIds: [],
    unsupportedRequirementIds: [],
    unsupportedTestCaseIds: [],
  },
  validationMessages: ["导入数据已完成结构化。"],
};

describe("ReviewTrace 工作台", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => modelStatusResponse,
      }),
    );
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("渲染深色导航、顶部上下文和新分析页", async () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "ReviewTrace" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "开始一次证据支撑的分析" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /开始分析/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /App Store 链接/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /导入 JSON \/ CSV/ })).toBeInTheDocument();
    expect(screen.getByLabelText("App Store 链接")).toBeInTheDocument();
    expect(screen.getByLabelText("分析目标")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /下载字段示例/ })).toHaveAttribute(
      "download",
      "reviewtrace-schema-example.json",
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "应用预览" }),
      ).toBeInTheDocument();
    });
  });

  it("支持 App Store 与导入模式切换", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: /导入 JSON \/ CSV/ }));

    expect(screen.getByText("将 JSON / CSV 拖到这里")).toBeInTheDocument();
    expect(screen.getByText("已选文件")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /App Store 链接/ }));

    expect(screen.getByRole("button", { name: /开始分析/ })).toBeInTheDocument();
  });

  it("未启动真实运行时不会显示固定的实时百分比", () => {
    render(<Home />);

    expect(screen.queryByText("46%")).not.toBeInTheDocument();
  });

  it("评论页支持真实搜索、评分和重复项筛选", () => {
    render(<Home />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "评论原始与清洗后的评论语料",
      }),
    );

    fireEvent.change(screen.getByLabelText("搜索评论"), {
      target: { value: "REV-01007" },
    });
    expect(screen.getByRole("button", { name: "REV-01007" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "REV-00421" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("搜索评论"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("重复项筛选"), {
      target: { value: "only" },
    });
    expect(screen.getByRole("button", { name: "REV-00818" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "REV-00421" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("评分筛选"), {
      target: { value: "high" },
    });
    expect(screen.getByText("没有符合筛选条件的评论。")).toBeInTheDocument();
  });

  it("保存草稿、折叠侧栏和 PRD 目录都有实际状态反馈", () => {
    render(<Home />);

    fireEvent.change(screen.getByLabelText("分析目标"), {
      target: { value: "只关注取消订阅路径" },
    });
    fireEvent.click(screen.getByRole("button", { name: /保存草稿/ }));
    expect(window.localStorage.getItem("reviewtrace-draft")).toContain(
      "只关注取消订阅路径",
    );
    expect(screen.getByText(/草稿已保存/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "折叠导航" }));
    const expandNavButton = screen.getByRole("button", { name: "展开导航" });
    expect(expandNavButton).toBeInTheDocument();
    fireEvent.click(expandNavButton);

    fireEvent.click(screen.getByRole("button", { name: "收起检查器" }));
    expect(screen.getByRole("button", { name: /检查器/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "PRD v1结构化需求与文档草案" }));
    const versionsButton = screen.getByRole("button", { name: "版本计划" });
    fireEvent.click(versionsButton);
    expect(versionsButton).toHaveClass("is-active");
  });

  it("切换到 Reviews 与 Findings 页面后仍然能看见核心数据", () => {
    render(<Home />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "评论原始与清洗后的评论语料",
      }),
    );

    expect(screen.getByRole("heading", { name: "原始评论与清洗评论" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "REV-00421" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "REV-00818" })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /主题图谱/,
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "动态主题与证据支撑的发现",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /THM-006/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FND-003/ })).toBeInTheDocument();
  });

  it("切换到 PRD、测试和追溯页面能看到交付物", () => {
    render(<Home />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "PRD v1结构化需求与文档草案",
      }),
    );
    expect(screen.getByRole("heading", { name: "PRD v1 草案" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /REQ-004/ })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "测试套件可追溯测试套件" }),
    );
    expect(screen.getByRole("heading", { name: "可追溯测试套件" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /TC-012/ })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "追溯矩阵追溯矩阵与关系图" }),
    );
    expect(
      screen.getByRole("heading", { name: "评论 → 发现 → 需求 → 测试用例" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /VAL-001/ })).toBeInTheDocument();
  });

  it("启动真实运行后各交付物页面使用后端运行数据", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);

      if (url.endsWith("/config/model")) {
        return {
          ok: true,
          json: async () => modelStatusResponse,
        } as Response;
      }

      if (url.endsWith("/workflow/runs/stream")) {
        return {
          ok: true,
          json: async () => workflowRunResponse,
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: /开始分析/ }));

    await waitFor(() => {
      expect(screen.getByText("import-run-001")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "评论原始与清洗后的评论语料",
      }),
    );
    expect(screen.getByRole("button", { name: "json-001" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "REV-00421" })).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /主题图谱/,
      }),
    );
    expect(screen.getAllByRole("button", { name: /finding-subscription-copy/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /FND-003/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "PRD v1结构化需求与文档草案" }));
    expect(
      screen.getByRole("button", { name: /requirement-subscription-copy/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "测试套件可追溯测试套件" }));
    expect(screen.getByRole("button", { name: /test-subscription-copy/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "追溯矩阵追溯矩阵与关系图" }));
    expect(screen.getByRole("button", { name: /发现与评论链路已完成追溯/ })).toBeInTheDocument();
  });

  it("通过单一 WorkflowRun 契约入口解析后端运行结果", () => {
    expect(parseWorkflowRun(workflowRunResponse).runId).toBe("import-run-001");
    expect(() =>
      parseWorkflowRun({
        ...workflowRunResponse,
        testCases: undefined,
      }),
    ).toThrow("工作流运行格式无效");
  });

  it("通过工作台展示模型入口构建交付物数据", () => {
    const model = buildWorkbenchModel(parseWorkflowRun(workflowRunResponse));

    expect(model.rawReviewRows[0]).toMatchObject({
      id: "json-001",
      source: "导入",
      theme: "订阅说明需要在购买前更清楚地解释。",
    });
    expect(model.findingCards[0].id).toBe("finding-subscription-copy");
    expect(model.requirementCards[0].id).toBe("requirement-subscription-copy");
    expect(model.testCaseCards[0].id).toBe("test-subscription-copy");
    expect(model.validationIssues[0].status).toBe("有效");
    expect(model.summaryMetrics.find((metric) => metric.label === "模型发现")?.value).toBe("1");
  });
});
