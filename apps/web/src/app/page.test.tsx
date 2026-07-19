import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Home from "./page";

const modelStatusResponse = {
  provider: "deepseek",
  model: "deepseek-v4-flash",
  keyConfigured: true,
  modelDrivenAvailable: true,
  fallbackAvailable: true,
  message: "模型已就绪。",
};

describe("ReviewTrace 工作台", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => modelStatusResponse,
      }),
    );
  });

  afterEach(() => {
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
});
