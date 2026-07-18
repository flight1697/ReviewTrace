"use client";

import { Activity, Play, Upload } from "lucide-react";
import { useState } from "react";

const stages = [
  ["Scope", "Waiting"],
  ["Reviews", "Waiting"],
  ["Evidence", "Waiting"],
  ["PRD", "Waiting"],
  ["Tests", "Waiting"],
] as const;

type WorkflowStage = {
  name: string;
  status: string;
};

type Review = {
  id: string;
  rating: number;
  title: string;
  body: string;
};

type Finding = {
  id: string;
  title: string;
  reviewIds: string[];
  sampleCount: number;
  confidence: string;
};

type Requirement = {
  id: string;
  title: string;
  priority: string;
  findingIds: string[];
};

type TestCase = {
  id: string;
  title: string;
  requirementId: string;
  sourceReviewIds: string[];
};

type WorkflowRun = {
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
  reviews: Review[];
  cleaningSummary: {
    inputCount: number;
    retainedCount: number;
    duplicateCount: number;
  };
  findings: Finding[];
  requirements: Requirement[];
  testCases: TestCase[];
  validationMessages: string[];
};

const defaultAppStoreLink =
  "https://apps.apple.com/us/app/workout-for-women-home-gym/id839285684";
const defaultAnalysisGoal = "Focus on subscription conversion complaints";
const apiUrl =
  process.env.NEXT_PUBLIC_REVIEWTRACE_API_URL ?? "http://localhost:8000";
const stageLabels: Record<string, string> = {
  analysis: "Evidence",
  cleaning: "Cleaning",
  prd: "PRD",
  reviews: "Reviews",
  scope: "Scope",
  tests: "Tests",
  validation: "Validation",
};

export default function Home() {
  const [appStoreLink, setAppStoreLink] = useState(defaultAppStoreLink);
  const [analysisGoal, setAnalysisGoal] = useState(defaultAnalysisGoal);
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "failed">("idle");
  const [error, setError] = useState("");

  async function runFixtureWorkflow() {
    setStatus("running");
    setError("");

    try {
      const response = await fetch(`${apiUrl}/workflow/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appStoreUrl: appStoreLink,
          analysisGoal,
          sourceMode: "fixture",
        }),
      });

      if (!response.ok) {
        throw new Error("Workflow request failed");
      }

      setRun((await response.json()) as WorkflowRun);
      setStatus("idle");
    } catch (caughtError) {
      setStatus("failed");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Workflow request failed",
      );
    }
  }

  const visibleStages = run
    ? run.stages.map((stage) => [
        stageLabels[stage.name] ?? stage.name,
        stage.status,
      ])
    : stages;

  return (
    <main className="shell">
      <section className="workspace" aria-label="ReviewTrace workspace">
        <div className="panel">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <Activity size={22} />
            </div>
            <div>
              <h1>ReviewTrace</h1>
              <p className="subtitle">
                Turn App Store reviews into traceable product decisions.
              </p>
            </div>
          </div>

          <form className="form">
            <label className="field">
              <span>App Store link</span>
              <input
                name="appStoreLink"
                placeholder="https://apps.apple.com/us/app/.../id839285684"
                type="url"
                value={appStoreLink}
                onChange={(event) => setAppStoreLink(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Analysis goal</span>
              <textarea
                name="analysisGoal"
                placeholder="Focus on subscription conversion, low-rating reviews, workout usability..."
                value={analysisGoal}
                onChange={(event) => setAnalysisGoal(event.target.value)}
              />
            </label>

            <div className="actions">
              <button
                className="primary"
                disabled={status === "running"}
                onClick={runFixtureWorkflow}
                type="button"
              >
                <Play size={18} aria-hidden="true" />
                {status === "running" ? "Running" : "Start analysis"}
              </button>
              <button className="secondary" type="button">
                <Upload size={18} aria-hidden="true" />
                Import reviews
              </button>
            </div>
          </form>
        </div>

        <div className="dashboard">
          <div className="stage-list" aria-label="Workflow stages">
            {visibleStages.map(([name, stageStatus]) => (
              <div className="stage" key={name}>
                <strong>{name}</strong>
                <span>{stageStatus}</span>
              </div>
            ))}
          </div>

          <section className="artifact" aria-label="Analysis deliverables">
            <div>
              <h2>Analysis workspace</h2>
              <p className="subtitle">
                Raw reviews, cleaned data, findings, requirements, and test cases
                will appear here as the workflow runs.
              </p>
            </div>

            {error ? <p className="error">{error}</p> : null}

            {run ? (
              <div className="run-output">
                <dl className="run-meta">
                  <div>
                    <dt>Run</dt>
                    <dd>{run.runId}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{run.source.label}</dd>
                  </div>
                  <div>
                    <dt>Reviews retained</dt>
                    <dd>
                      {run.cleaningSummary.retainedCount} /{" "}
                      {run.cleaningSummary.inputCount}
                    </dd>
                  </div>
                </dl>

                <div className="artifact-grid">
                  <article className="artifact-item">
                    <h3>Review evidence</h3>
                    {run.reviews.map((review) => (
                      <p key={review.id}>
                        <strong>{review.id}</strong>: {review.title} (
                        {review.rating} stars)
                      </p>
                    ))}
                  </article>
                  <article className="artifact-item">
                    <h3>Finding</h3>
                    {run.findings.map((finding) => (
                      <p key={finding.id}>
                        {finding.title} Evidence: {finding.reviewIds.join(", ")}
                      </p>
                    ))}
                  </article>
                  <article className="artifact-item">
                    <h3>Requirement</h3>
                    {run.requirements.map((requirement) => (
                      <p key={requirement.id}>
                        {requirement.priority}: {requirement.title}
                      </p>
                    ))}
                  </article>
                  <article className="artifact-item">
                    <h3>QA coverage</h3>
                    {run.testCases.map((testCase) => (
                      <p key={testCase.id}>
                        {testCase.title} Requirement: {testCase.requirementId}
                      </p>
                    ))}
                  </article>
                </div>

                <div className="validation">
                  {run.validationMessages.map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                </div>
              </div>
            ) : (
              <div className="artifact-grid">
                <article className="artifact-item">
                  <h3>Review evidence</h3>
                  <p>Source reviews and normalized fields.</p>
                </article>
                <article className="artifact-item">
                  <h3>Product plan</h3>
                  <p>Findings, version scope, and PRD requirements.</p>
                </article>
                <article className="artifact-item">
                  <h3>Traceability</h3>
                  <p>Review-to-finding-to-requirement links.</p>
                </article>
                <article className="artifact-item">
                  <h3>QA coverage</h3>
                  <p>Test cases linked to source evidence.</p>
                </article>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
