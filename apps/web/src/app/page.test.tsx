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
    expect(screen.getByRole("button", { name: /开始分析/i })).toBeInTheDocument();
    expect(screen.getByText("范围")).toBeInTheDocument();
    expect(screen.getByText("评论")).toBeInTheDocument();
    expect(screen.getByText("证据")).toBeInTheDocument();
    expect(screen.getByText("PRD")).toBeInTheDocument();
    expect(screen.getByText("测试")).toBeInTheDocument();
  });

  it("运行示例工作流并展示可追溯结果", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          runId: "fixture-run-001",
          source: { mode: "fixture", label: "缓存示例数据集" },
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
              method: "示例模型桩",
              conflictingEvidence: [],
            },
          ],
          requirements: [
            {
              id: "requirement-subscription-preview",
              title:
                "购买前展示订阅价值、包含功能、价格和取消路径。",
              priority: "P1",
              findingIds: ["finding-subscription-clarity"],
              assumption: false,
            },
          ],
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

    fireEvent.click(screen.getByRole("button", { name: /开始分析/i }));

    await waitFor(() => {
      expect(screen.getByText("fixture-run-001")).toBeInTheDocument();
    });
    expect(
      screen.getByText((content) =>
        content.includes(
          "订阅转化前，订阅价值和取消方式说明不够清楚。",
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("fixture-review-001")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/workflow/runs",
      expect.objectContaining({ method: "POST" }),
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
              method: "确定性导入摘要",
              conflictingEvidence: [],
            },
          ],
          requirements: [],
          testCases: [],
          validationMessages: [
            "导入数据已完成结构化、清洗和基础统计，后续语义分析会在模型阶段替换当前占位结果。",
          ],
        }),
      }),
    );

    render(<Home />);

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
      expect(screen.getByText("import-run-001")).toBeInTheDocument();
    });
    expect(screen.getByText("导入的 JSON 数据集")).toBeInTheDocument();
    expect(screen.getByText("训练计划太突然")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/workflow/runs",
      expect.objectContaining({
        body: expect.stringContaining('"sourceMode":"import"'),
        method: "POST",
      }),
    );
  });
});
