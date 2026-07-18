import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Home from "./page";

describe("ReviewTrace home", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the runnable analysis workspace", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "ReviewTrace" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("App Store link")).toBeInTheDocument();
    expect(screen.getByLabelText("Analysis goal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start analysis/i })).toBeInTheDocument();
    expect(screen.getByText("Scope")).toBeInTheDocument();
    expect(screen.getByText("Reviews")).toBeInTheDocument();
    expect(screen.getByText("Evidence")).toBeInTheDocument();
    expect(screen.getByText("PRD")).toBeInTheDocument();
    expect(screen.getByText("Tests")).toBeInTheDocument();
  });

  it("runs the fixture workflow and displays traceable output", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          runId: "fixture-run-001",
          source: { mode: "fixture", label: "Cached fixture dataset" },
          scope: {
            appStoreUrl:
              "https://apps.apple.com/us/app/workout-for-women-home-gym/id839285684",
            analysisGoal: "Focus on subscription conversion complaints",
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
              title: "Trial ended before I understood the plan",
              body: "I liked the workouts, but the subscription prompt appeared before I knew what was included.",
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
                "Subscription value and cancellation details are not clear enough before conversion.",
              reviewIds: ["fixture-review-001"],
              sampleCount: 1,
              confidence: "medium",
              method: "fixture model stub",
              conflictingEvidence: [],
            },
          ],
          requirements: [
            {
              id: "requirement-subscription-preview",
              title:
                "Show subscription value, included features, price, and cancellation path before purchase.",
              priority: "P1",
              findingIds: ["finding-subscription-clarity"],
              assumption: false,
            },
          ],
          testCases: [
            {
              id: "test-subscription-preview-content",
              title: "User sees subscription details before starting purchase.",
              requirementId: "requirement-subscription-preview",
              sourceReviewIds: ["fixture-review-001"],
              steps: ["Open the subscription entry point."],
              expectedResult:
                "The preview explains the subscription clearly before the user commits.",
            },
          ],
          validationMessages: [
            "All findings, requirements, and test cases reference fixture evidence.",
          ],
        }),
      }),
    );

    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: /Start analysis/i }));

    await waitFor(() => {
      expect(screen.getByText("fixture-run-001")).toBeInTheDocument();
    });
    expect(
      screen.getByText((content) =>
        content.includes(
          "Subscription value and cancellation details are not clear enough before conversion.",
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
