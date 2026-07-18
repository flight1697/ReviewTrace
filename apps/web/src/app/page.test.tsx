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
});
