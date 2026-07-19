import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Home from "./page";

describe("ReviewTrace 首页", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("渲染可运行的分析工作台", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "ReviewTrace" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("App Store 链接")).toBeInTheDocument();
    expect(screen.getByLabelText("分析目标")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /生成分析报告/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /缓存示例/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /导入文件/i })).toBeInTheDocument();
    expect(screen.getByText("范围")).toBeInTheDocument();
    expect(screen.getByText("评论")).toBeInTheDocument();
    expect(screen.getByText("证据")).toBeInTheDocument();
    expect(screen.getByText("产品需求文档")).toBeInTheDocument();
    expect(screen.getByText("测试")).toBeInTheDocument();
  });

  it("在模型 key 缺失时展示确定性兜底提示", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          provider: "deepseek",
          model: "deepseek-v4-flash",
          keyConfigured: false,
          modelDrivenAvailable: false,
          fallbackAvailable: true,
          message: "未配置 DEEPSEEK_API_KEY，当前将使用确定性兜底分析。",
        }),
      }),
    );

    render(<Home />);

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "模型配置状态" }),
      ).toHaveTextContent("未配置 DEEPSEEK_API_KEY");
    });
    expect(screen.getByText(/deepseek-v4-flash/)).toBeInTheDocument();
  });

  it("在模型状态接口不可用时展示可恢复提示", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("API offline")),
    );

    render(<Home />);

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "模型配置状态" }),
      ).toHaveTextContent("模型配置状态暂时不可用");
    });
    expect(screen.getByText(/unknown · unknown/)).toBeInTheDocument();
  });

  it("在模型 key 已配置时展示模型驱动状态", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          provider: "deepseek",
          model: "deepseek-v4-flash",
          keyConfigured: true,
          modelDrivenAvailable: true,
          fallbackAvailable: true,
          message: "已配置 deepseek 模型，将使用模型驱动分析。",
        }),
      }),
    );

    render(<Home />);

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "模型配置状态" }),
      ).toHaveTextContent("模型驱动分析已就绪");
    });
  });

  it("运行 App Store 工作流并展示可追溯结果", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          runId: "live-839285684",
          source: { mode: "live", label: "U.S. App Store 最新评论" },
          scope: {
            appStoreUrl:
              "https://apps.apple.com/us/app/workout-for-women-home-gym/id839285684",
            analysisGoal: "关注订阅转化相关投诉",
            storefront: "us",
          },
          stages: [
            { name: "scope", status: "complete" },
            { name: "reviews", status: "complete" },
            { name: "cleaning", status: "complete" },
            { name: "analysis", status: "complete" },
            { name: "prd", status: "complete" },
            { name: "tests", status: "complete" },
            { name: "validation", status: "complete" },
          ],
          reviews: [
            {
              id: "fixture-review-001",
              rating: 2,
              title: "还没理解套餐内容，试用就结束了",
              body: "我喜欢这些训练内容，但在我弄清楚包含哪些功能之前，订阅弹窗就出现了。",
              appVersion: "24.8",
              source: "fixture",
            },
          ],
          cleaningSummary: {
            inputCount: 1,
            retainedCount: 1,
            duplicateCount: 0,
            discardedEmptyCount: 0,
          },
          rawReviews: [
            {
              id: "fixture-review-001",
              rating: 2,
              title: "还没理解套餐内容，试用就结束了",
              body: "我喜欢这些训练内容，但在我弄清楚包含哪些功能之前，订阅弹窗就出现了。",
              appVersion: "24.8",
              source: "fixture",
            },
          ],
          ratingSummary: {
            averageRating: 2,
            ratingCounts: { "2": 1 },
          },
          analysisSummary: {
            provider: "stub",
            model: "fixture-model-stub",
            modelDriven: false,
          },
          findings: [
            {
              id: "finding-subscription-clarity",
              title:
                "订阅转化前，订阅价值和取消方式说明不够清楚。",
              reviewIds: ["fixture-review-001"],
              sampleCount: 1,
              confidence: "中等",
              evidence: [
                {
                  reviewId: "fixture-review-001",
                  excerpt: "还没理解套餐内容，试用就结束了：我喜欢这些训练内容，但在我弄清楚包含哪些功能之前，订阅弹窗就出现了。",
                },
              ],
              method: "示例模型桩",
              conflictingEvidence: [
                {
                  reviewId: "fixture-review-positive",
                  excerpt: "订阅说明很清楚：购买前已经看到了价格、包含功能和取消方式。",
                },
              ],
            },
          ],
          requirements: [
            {
              id: "requirement-subscription-preview",
              title:
                "购买前展示订阅价值、包含功能、价格和取消路径。",
              priority: "P1",
              version: "v1",
              findingIds: ["finding-subscription-clarity"],
              sourceReviewIds: ["fixture-review-001"],
              boundaries: ["仅覆盖当前评论证据直接支持的问题。"],
              assumption: false,
            },
          ],
          versionPlan: {
            versions: [
              {
                id: "v1",
                name: "版本 1：证据支撑的核心改进",
                goal: "优先交付有明确评论证据和较高样本支撑的问题。",
                requirementIds: ["requirement-subscription-preview"],
                sourceReviewIds: ["fixture-review-001"],
              },
            ],
          },
          prd: {
            title: "ReviewTrace 产品需求文档草案",
            objective:
              "围绕「关注订阅转化相关投诉」回应已导入评论中的高证据问题。",
            versions: [],
            requirements: [],
            successMetrics: ["每条需求都能追溯到至少一条原始评论。"],
            assumptions: [],
          },
          dataLimitations: ["样本量较小，当前结论应视为方向性信号。"],
          traceabilityValidation: {
            status: "passed",
            unsupportedFindingIds: [],
            unsupportedRequirementIds: [],
            unsupportedTestCaseIds: [],
          },
          testCases: [
            {
              id: "test-subscription-preview-content",
              title: "用户在发起购买前可以看到订阅详情。",
              requirementId: "requirement-subscription-preview",
              sourceReviewIds: ["fixture-review-001"],
              steps: ["打开订阅入口。"],
              expectedResult:
                "购买前预览能在用户确认前清楚解释订阅内容。",
            },
          ],
          validationMessages: [
            "所有发现、需求和测试用例都已关联示例评论证据。",
          ],
        }),
      }),
    );

    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: /生成分析报告/i }));

    await waitFor(() => {
      expect(screen.getByText("运行编号：live-839285684")).toBeInTheDocument();
    });
    expect(
      screen.getByText((content) =>
        content.includes(
          "订阅转化前，订阅价值和取消方式说明不够清楚。",
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("fixture-review-001").length).toBeGreaterThan(0);
    expect(screen.getByText("冲突证据")).toBeInTheDocument();
    expect(
      screen.getByText(/购买前已经看到了价格、包含功能和取消方式/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "版本计划" }));
    expect(screen.getByText("版本 1：证据支撑的核心改进")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "PRD 草案" }));
    expect(
      screen.getByText(/围绕「关注订阅转化相关投诉」/),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/workflow/runs",
      expect.objectContaining({
        body: expect.stringContaining('"sourceMode":"live"'),
        method: "POST",
      }),
    );
  });

  it("导入 JSON 文件并展示导入工作流结果", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          runId: "import-run-001",
          source: { mode: "import", label: "导入的 JSON 数据集" },
          scope: {
            appStoreUrl:
              "https://apps.apple.com/us/app/workout-for-women-home-gym/id839285684",
            analysisGoal: "关注低评分评论",
            storefront: "us",
          },
          stages: [
            { name: "scope", status: "complete" },
            { name: "reviews", status: "complete" },
            { name: "cleaning", status: "complete" },
            { name: "analysis", status: "complete" },
            { name: "prd", status: "complete" },
            { name: "tests", status: "complete" },
            { name: "validation", status: "complete" },
          ],
          rawReviews: [
            {
              id: "json-001",
              rating: 1,
              title: "训练计划太突然",
              body: "低评分用户觉得新手训练没有解释清楚。",
              appVersion: "1.2.0",
              source: "import",
            },
          ],
          reviews: [
            {
              id: "json-001",
              rating: 1,
              title: "训练计划太突然",
              body: "低评分用户觉得新手训练没有解释清楚。",
              appVersion: "1.2.0",
              source: "import",
            },
          ],
          cleaningSummary: {
            inputCount: 1,
            retainedCount: 1,
            duplicateCount: 0,
            discardedEmptyCount: 0,
          },
          ratingSummary: {
            averageRating: 1,
            ratingCounts: { "1": 1 },
          },
          analysisSummary: {
            provider: "stub",
            model: "deterministic-import-summary",
            modelDriven: false,
          },
          findings: [
            {
              id: "finding-imported-feedback",
              title: "导入评论中出现了 1 条可分析反馈。",
              reviewIds: ["json-001"],
              sampleCount: 1,
              confidence: "待模型分析",
              evidence: [
                {
                  reviewId: "json-001",
                  excerpt: "训练计划太突然：低评分用户觉得新手训练没有解释清楚。",
                },
              ],
              method: "确定性导入摘要",
              conflictingEvidence: [],
            },
          ],
          requirements: [
            {
              id: "requirement-imported-feedback",
              title: "围绕「导入评论中出现了 1 条可分析反馈」制定可验证改进。",
              priority: "P2",
              version: "v2",
              findingIds: ["finding-imported-feedback"],
              sourceReviewIds: ["json-001"],
              boundaries: ["仅覆盖当前评论证据直接支持的问题。"],
              assumption: false,
            },
          ],
          versionPlan: {
            versions: [
              {
                id: "v2",
                name: "版本 2：补充验证后的增强项",
                goal: "处理样本较少或置信度较弱、需要继续观察的问题。",
                requirementIds: ["requirement-imported-feedback"],
                sourceReviewIds: ["json-001"],
              },
            ],
          },
          prd: {
            title: "ReviewTrace 产品需求文档草案",
            objective: "围绕「关注低评分评论」回应已导入评论中的高证据问题。",
            versions: [],
            requirements: [],
            successMetrics: ["版本范围只包含当前证据支持的问题。"],
            assumptions: [],
          },
          dataLimitations: ["样本量较小，当前结论应视为方向性信号。"],
          traceabilityValidation: {
            status: "passed",
            unsupportedFindingIds: [],
            unsupportedRequirementIds: [],
            unsupportedTestCaseIds: [],
          },
          testCases: [
            {
              id: "test-imported-feedback",
              title: "验证：围绕「导入评论中出现了 1 条可分析反馈」制定可验证改进",
              requirementId: "requirement-imported-feedback",
              sourceReviewIds: ["json-001"],
              steps: [
                "准备覆盖源评论 json-001 所描述问题的用户情境。",
                "执行需求对应流程：围绕「导入评论中出现了 1 条可分析反馈」制定可验证改进。",
                "对照源评论确认该问题被直接回应，而不是只完成通用功能检查。",
              ],
              expectedResult:
                "源评论指出的问题被可验证地解决，且测试结果能追溯到对应需求。",
            },
          ],
          validationMessages: [
            "导入数据已完成结构化、清洗和基础统计，后续语义分析会在模型阶段替换当前占位结果。",
          ],
        }),
      }),
    );

    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: /导入文件/i }));

    const file = new File(
      [
        JSON.stringify({
          reviews: [
            {
              id: "json-001",
              rating: 1,
              title: "训练计划太突然",
              body: "低评分用户觉得新手训练没有解释清楚。",
            },
          ],
        }),
      ],
      "reviews.json",
      { type: "application/json" },
    );

    fireEvent.change(screen.getByLabelText("导入评论文件"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByText("运行编号：import-run-001")).toBeInTheDocument();
    });
    expect(screen.getByText("导入的 JSON 数据集")).toBeInTheDocument();
    expect(screen.getByText("训练计划太突然")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "版本计划" }));
    expect(screen.getByText("版本 2：补充验证后的增强项")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "PRD 草案" }));
    expect(screen.getByText(/产品需求文档草案/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "QA 测试用例" }));
    expect(
      screen.getByText("准备覆盖源评论 json-001 所描述问题的用户情境。"),
    ).toBeInTheDocument();
    expect(screen.getByText(/源评论指出的问题被可验证地解决/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "追溯校验" }));
    expect(screen.getAllByText(/追溯校验：通过/).length).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/workflow/runs",
      expect.objectContaining({
        body: expect.stringContaining('"sourceMode":"import"'),
        method: "POST",
      }),
    );
  });

  it("展示后端返回的可恢复错误信息", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          detail: "当前仅支持 U.S. App Store 链接。",
        }),
      }),
    );

    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: /生成分析报告/i }));

    await waitFor(() => {
      expect(
        screen.getByText("当前仅支持 U.S. App Store 链接。"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("region", { name: "工作流阶段" }),
    ).toHaveTextContent("失败");
    expect(
      screen.getByRole("region", { name: "空状态" }),
    ).toBeInTheDocument();
  });
});
