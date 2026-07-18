"use client";

import { Activity, Play, Upload } from "lucide-react";
import { useState } from "react";

const stages = [
  ["范围", "等待中"],
  ["评论", "等待中"],
  ["证据", "等待中"],
  ["PRD", "等待中"],
  ["测试", "等待中"],
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
const defaultAnalysisGoal = "关注订阅转化相关投诉";
const apiUrl =
  process.env.NEXT_PUBLIC_REVIEWTRACE_API_URL ?? "http://localhost:8000";
const stageLabels: Record<string, string> = {
  analysis: "证据",
  cleaning: "清洗",
  prd: "PRD",
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
        throw new Error("工作流请求失败");
      }

      setRun((await response.json()) as WorkflowRun);
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

  const visibleStages = run
    ? run.stages.map((stage) => [
        stageLabels[stage.name] ?? stage.name,
        statusLabels[stage.status] ?? stage.status,
      ])
    : stages;

  return (
    <main className="shell">
      <section className="workspace" aria-label="ReviewTrace 工作台">
        <div className="panel">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <Activity size={22} />
            </div>
            <div>
              <h1>ReviewTrace</h1>
              <p className="subtitle">
                将 App Store 评论转化为可追溯的产品决策。
              </p>
            </div>
          </div>

          <form className="form">
            <label className="field">
              <span>App Store 链接</span>
              <input
                name="appStoreLink"
                placeholder="https://apps.apple.com/us/app/.../id839285684"
                type="url"
                value={appStoreLink}
                onChange={(event) => setAppStoreLink(event.target.value)}
              />
            </label>

            <label className="field">
              <span>分析目标</span>
              <textarea
                name="analysisGoal"
                placeholder="例如：关注订阅转化、低评分评论、训练可用性..."
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
                {status === "running" ? "分析中" : "开始分析"}
              </button>
              <button className="secondary" type="button">
                <Upload size={18} aria-hidden="true" />
                导入评论
              </button>
            </div>
          </form>
        </div>

        <div className="dashboard">
          <div className="stage-list" aria-label="工作流阶段">
            {visibleStages.map(([name, stageStatus]) => (
              <div className="stage" key={name}>
                <strong>{name}</strong>
                <span>{stageStatus}</span>
              </div>
            ))}
          </div>

          <section className="artifact" aria-label="分析交付物">
            <div>
              <h2>分析工作台</h2>
              <p className="subtitle">
                工作流运行后，这里会展示原始评论、清洗数据、发现、需求和测试用例。
              </p>
            </div>

            {error ? <p className="error">{error}</p> : null}

            {run ? (
              <div className="run-output">
                <dl className="run-meta">
                  <div>
                    <dt>运行编号</dt>
                    <dd>{run.runId}</dd>
                  </div>
                  <div>
                    <dt>数据源</dt>
                    <dd>{run.source.label}</dd>
                  </div>
                  <div>
                    <dt>保留评论</dt>
                    <dd>
                      {run.cleaningSummary.retainedCount} /{" "}
                      {run.cleaningSummary.inputCount}
                    </dd>
                  </div>
                </dl>

                <div className="artifact-grid">
                  <article className="artifact-item">
                    <h3>评论证据</h3>
                    {run.reviews.map((review) => (
                      <p key={review.id}>
                        <strong>{review.id}</strong>：{review.title}（
                        {review.rating} 星）
                      </p>
                    ))}
                  </article>
                  <article className="artifact-item">
                    <h3>发现</h3>
                    {run.findings.map((finding) => (
                      <p key={finding.id}>
                        {finding.title} 证据：{finding.reviewIds.join(", ")}
                      </p>
                    ))}
                  </article>
                  <article className="artifact-item">
                    <h3>需求</h3>
                    {run.requirements.map((requirement) => (
                      <p key={requirement.id}>
                        {requirement.priority}: {requirement.title}
                      </p>
                    ))}
                  </article>
                  <article className="artifact-item">
                    <h3>QA 覆盖</h3>
                    {run.testCases.map((testCase) => (
                      <p key={testCase.id}>
                        {testCase.title} 需求：{testCase.requirementId}
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
                  <h3>评论证据</h3>
                  <p>原始评论和标准化字段。</p>
                </article>
                <article className="artifact-item">
                  <h3>产品计划</h3>
                  <p>发现、版本范围和 PRD 需求。</p>
                </article>
                <article className="artifact-item">
                  <h3>追溯链</h3>
                  <p>评论到发现再到需求的关联关系。</p>
                </article>
                <article className="artifact-item">
                  <h3>QA 覆盖</h3>
                  <p>与原始证据关联的测试用例。</p>
                </article>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
