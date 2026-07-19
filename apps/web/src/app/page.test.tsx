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
      screen.getByRole("heading", { name: "Start an evidence-backed analysis" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start analysis/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /App Store link/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Import JSON \/ CSV/i })).toBeInTheDocument();
    expect(screen.getByLabelText("App Store 链接")).toBeInTheDocument();
    expect(screen.getByLabelText("分析目标")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download schema example/i })).toHaveAttribute(
      "download",
      "reviewtrace-schema-example.json",
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "App preview" }),
      ).toBeInTheDocument();
    });
  });

  it("支持 App Store 与导入模式切换", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: /Import JSON \/ CSV/i }));

    expect(screen.getByText("Drag JSON / CSV here")).toBeInTheDocument();
    expect(screen.getByText("Selected file")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /App Store link/i }));

    expect(screen.getByRole("button", { name: /Start analysis/i })).toBeInTheDocument();
  });

  it("切换到 Reviews 与 Findings 页面后仍然能看见核心数据", () => {
    render(<Home />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "ReviewsRaw and clean review corpus",
      }),
    );

    expect(screen.getByRole("heading", { name: "Raw and clean reviews" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "REV-00421" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "REV-00818" })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Theme map/i,
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Dynamic themes and evidence-backed findings",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /THM-006/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FND-003/ })).toBeInTheDocument();
  });

  it("切换到 PRD、测试和追溯页面能看到交付物", () => {
    render(<Home />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "PRD v1Structured requirements and document draft",
      }),
    );
    expect(screen.getByRole("heading", { name: "PRD v1 Draft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /REQ-004/ })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Test suiteTraceable test suite" }),
    );
    expect(screen.getByRole("heading", { name: "Traceable test suite" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /TC-012/ })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Trace matrixTraceability matrix and graph" }),
    );
    expect(
      screen.getByRole("heading", { name: "Review → Finding → Requirement → Test case" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /VAL-001/ })).toBeInTheDocument();
  });
});
