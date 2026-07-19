"use client";

import { Activity, Play, Upload } from "lucide-react";
import type { ChangeEvent } from "react";
import { useState } from "react";

import {
  defaultAnalysisGoal,
  defaultAppStoreLink,
  readFileText,
  requestWorkflowRun,
  type WorkflowRun,
  type WorkflowStatus,
  visibleWorkflowStages,
} from "./workflow";

export default function Home() {
  const [appStoreLink, setAppStoreLink] = useState(defaultAppStoreLink);
  const [analysisGoal, setAnalysisGoal] = useState(defaultAnalysisGoal);
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [status, setStatus] = useState<WorkflowStatus>("idle");
  const [error, setError] = useState("");

  async function requestWorkflow(body: Record<string, string>) {
    setStatus("running");
    setError("");

    try {
      setRun(await requestWorkflowRun(body));
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

  async function runLiveWorkflow() {
    await requestWorkflow({
      appStoreUrl: appStoreLink,
      analysisGoal,
      sourceMode: "live",
    });
  }

  async function runFixtureWorkflow() {
    await requestWorkflow({
      appStoreUrl: appStoreLink,
      analysisGoal,
      sourceMode: "fixture",
    });
  }

  async function importReviews(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const datasetFormat = file.name.toLowerCase().endsWith(".csv")
      ? "csv"
      : "json";

    try {
      await requestWorkflow({
        appStoreUrl: appStoreLink,
        analysisGoal,
        datasetFormat,
        datasetText: await readFileText(file),
        sourceMode: "import",
      });
    } catch (caughtError) {
      setStatus("failed");
      setError(
        caughtError instanceof Error ? caughtError.message : "读取导入文件失败",
      );
    }
  }

  const visibleStages = visibleWorkflowStages(run, status);

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
                onClick={runLiveWorkflow}
                type="button"
              >
                <Play size={18} aria-hidden="true" />
                {status === "running" ? "分析中" : "开始分析"}
              </button>
              <button
                className="secondary"
                disabled={status === "running"}
                onClick={runFixtureWorkflow}
                type="button"
              >
                使用缓存示例
              </button>
              <label className="secondary file-trigger">
                <Upload size={18} aria-hidden="true" />
                导入评论
                <input
                  aria-label="导入评论文件"
                  accept=".json,.csv,application/json,text/csv"
                  onChange={importReviews}
                  type="file"
                />
              </label>
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
                  <div>
                    <dt>平均评分</dt>
                    <dd>{run.ratingSummary.averageRating}</dd>
                  </div>
                  <div>
                    <dt>重复评论</dt>
                    <dd>{run.cleaningSummary.duplicateCount}</dd>
                  </div>
                  <div>
                    <dt>空评论</dt>
                    <dd>{run.cleaningSummary.discardedEmptyCount}</dd>
                  </div>
                  <div>
                    <dt>分析方式</dt>
                    <dd>
                      {run.analysisSummary.modelDriven ? "模型驱动" : "确定性兜底"}
                    </dd>
                  </div>
                  <div>
                    <dt>模型</dt>
                    <dd>{run.analysisSummary.model}</dd>
                  </div>
                </dl>

                <div className="artifact-grid">
                  <article className="artifact-item">
                    <h3>评论证据</h3>
                    {run.reviews.map((review) => (
                      <p key={review.id}>
                        <strong>{review.id}</strong>：<span>{review.title}</span>
                        （{review.rating} 星）
                      </p>
                    ))}
                  </article>
                  <article className="artifact-item">
                    <h3>发现</h3>
                    {run.findings.map((finding) => (
                      <div className="finding-detail" key={finding.id}>
                        <p>
                          {finding.title} 证据：{finding.reviewIds.join(", ")}
                        </p>
                        {finding.evidence.map((item) => (
                          <p key={item.reviewId}>
                            <strong>{item.reviewId}</strong>：{item.excerpt}
                          </p>
                        ))}
                        {finding.conflictingEvidence.length ? (
                          <div className="conflicting-evidence">
                            <p>冲突证据：</p>
                            {finding.conflictingEvidence.map((item) => (
                              <p key={item.reviewId}>
                                <strong>{item.reviewId}</strong>：
                                {item.excerpt}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </article>
                  <article className="artifact-item">
                    <h3>需求</h3>
                    {run.requirements.map((requirement) => (
                      <div className="finding-detail" key={requirement.id}>
                        <p>
                          {requirement.priority} / {requirement.version}：
                          {requirement.title}
                        </p>
                        <p>来源评论：{requirement.sourceReviewIds.join(", ")}</p>
                        <p>边界：{requirement.boundaries.join("；")}</p>
                      </div>
                    ))}
                  </article>
                  <article className="artifact-item">
                    <h3>版本计划</h3>
                    {run.versionPlan.versions.map((version) => (
                      <div className="finding-detail" key={version.id}>
                        <p>{version.name}</p>
                        <p>{version.goal}</p>
                        <p>需求：{version.requirementIds.join(", ")}</p>
                      </div>
                    ))}
                  </article>
                  <article className="artifact-item">
                    <h3>产品需求文档草案</h3>
                    <p>{run.prd.objective}</p>
                    {run.prd.successMetrics.map((metric) => (
                      <p key={metric}>成功指标：{metric}</p>
                    ))}
                  </article>
                  <article className="artifact-item">
                    <h3>QA 覆盖</h3>
                    {run.testCases.map((testCase) => (
                      <div className="finding-detail" key={testCase.id}>
                        <p>
                          {testCase.title} 需求：{testCase.requirementId}
                        </p>
                        <p>来源评论：{testCase.sourceReviewIds.join(", ")}</p>
                        <ol>
                          {testCase.steps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                        <p>期望结果：{testCase.expectedResult}</p>
                      </div>
                    ))}
                  </article>
                </div>

                <div className="validation">
                  <p>
                    追溯校验：{run.traceabilityValidation.status === "passed"
                      ? "通过"
                      : "未通过"}
                  </p>
                  {run.dataLimitations.map((limitation) => (
                    <p key={limitation}>数据限制：{limitation}</p>
                  ))}
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
