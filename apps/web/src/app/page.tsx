"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileText,
  Loader2,
  Play,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { useState } from "react";

import {
  defaultAnalysisGoal,
  defaultAppStoreLink,
  readFileText,
  useWorkflowRun,
  visibleWorkflowStages,
  type AnalysisScope,
  type Finding,
  useModelStatus,
  type WorkflowRun,
} from "./workflow";

type SourceMode = "live" | "fixture" | "import";
type ArtifactTab =
  | "rawReviews"
  | "reviews"
  | "analysis"
  | "requirements"
  | "versionPlan"
  | "prd"
  | "testCases"
  | "validation";

const sourceOptions: {
  description: string;
  label: string;
  mode: SourceMode;
}[] = [
  {
    description: "实时读取公开评论",
    label: "在线采集",
    mode: "live",
  },
  {
    description: "离线演示完整链路",
    label: "缓存示例",
    mode: "fixture",
  },
  {
    description: "上传 JSON / CSV",
    label: "导入文件",
    mode: "import",
  },
];

const artifactTabs: { id: ArtifactTab; label: string }[] = [
  { id: "rawReviews", label: "原始审查" },
  { id: "reviews", label: "清理后评论" },
  { id: "analysis", label: "分类结果" },
  { id: "requirements", label: "产品需求" },
  { id: "versionPlan", label: "版本计划" },
  { id: "prd", label: "PRD 草案" },
  { id: "testCases", label: "QA 测试用例" },
  { id: "validation", label: "追溯校验" },
];

export default function Home() {
  const [appStoreLink, setAppStoreLink] = useState(defaultAppStoreLink);
  const [analysisGoal, setAnalysisGoal] = useState(defaultAnalysisGoal);
  const [sourceMode, setSourceMode] = useState<SourceMode>("live");
  const [activeTab, setActiveTab] = useState<ArtifactTab>("reviews");
  const { error, failWorkflow, requestWorkflow, run, status } = useWorkflowRun();
  const modelStatus = useModelStatus();

  async function runConfiguredWorkflow() {
    if (sourceMode === "import") {
      return;
    }

    await requestWorkflow({
      appStoreUrl: appStoreLink,
      analysisGoal,
      sourceMode,
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
      failWorkflow(caughtError, "读取导入文件失败");
    }
  }

  const visibleStages = visibleWorkflowStages(run, status);
  const isRunning = status === "running";

  return (
    <main className="shell">
      <section className="hero" aria-label="ReviewTrace 产品介绍">
        <div className="eyebrow">
          <Activity size={18} aria-hidden="true" />
          评论证据链分析工作台
        </div>
        <div className="hero-grid">
          <div className="hero-copy">
            <h1>ReviewTrace</h1>
            <p>
              从 App Store 评论中提取有证据支撑的产品洞察、需求、版本计划和
              QA 测试用例。
            </p>
            <div className="hero-tags" aria-label="当前能力">
              <span>评论采集</span>
              <span>证据发现</span>
              <span>PRD 草案</span>
              <span>QA 覆盖</span>
            </div>
          </div>

          <div className="hero-metrics" aria-label="工作流能力概览">
            <MetricCard icon={<Database />} label="数据源" value="3 种" />
            <MetricCard icon={<Target />} label="追溯链路" value="端到端" />
            <MetricCard icon={<ClipboardCheck />} label="交付物" value="6 类" />
          </div>
        </div>
      </section>

      <section className="workbench" aria-label="ReviewTrace 工作台">
        <section className="task-card" aria-label="任务配置">
          <div className="section-heading">
            <div>
              <p className="kicker">任务配置</p>
              <h2>告诉 ReviewTrace 要分析什么</h2>
            </div>
            <span className="soft-badge">中文报告优先</span>
          </div>

          {modelStatus ? <ModelStatusNotice status={modelStatus} /> : null}

          <form className="task-form">
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

            <div className="source-picker" aria-label="数据源选择">
              {sourceOptions.map((option) => (
                <button
                  aria-pressed={sourceMode === option.mode}
                  className="source-option"
                  data-selected={sourceMode === option.mode}
                  key={option.mode}
                  onClick={() => setSourceMode(option.mode)}
                  type="button"
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>

            <div className="submit-row">
              {sourceMode === "import" ? (
                <label className="primary file-trigger">
                  <Upload size={18} aria-hidden="true" />
                  {isRunning ? "导入分析中" : "选择文件并生成报告"}
                  <input
                    aria-label="导入评论文件"
                    accept=".json,.csv,application/json,text/csv"
                    disabled={isRunning}
                    onChange={importReviews}
                    type="file"
                  />
                </label>
              ) : (
                <button
                  className="primary"
                  disabled={isRunning}
                  onClick={runConfiguredWorkflow}
                  type="button"
                >
                  {isRunning ? (
                    <Loader2 className="spin" size={18} aria-hidden="true" />
                  ) : (
                    <Play size={18} aria-hidden="true" />
                  )}
                  {sourceMode === "fixture" ? "运行缓存示例" : "生成分析报告"}
                </button>
              )}
              <p className="helper-text">
                在线采集依赖 Apple 公开 RSS；如果返回空数据，可切换缓存示例或导入评论。
              </p>
            </div>
          </form>
        </section>

        <section className="timeline-card" aria-label="工作流阶段">
          {visibleStages.map(([name, stageStatus], index) => (
            <div className="timeline-step" data-status={stageStatus} key={name}>
              <span className="timeline-marker">
                {stageStatus === "已完成" ? (
                  <CheckCircle2 size={16} aria-hidden="true" />
                ) : stageStatus === "运行中" ? (
                  <Loader2 className="spin" size={16} aria-hidden="true" />
                ) : stageStatus === "失败" ? (
                  <AlertTriangle size={16} aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <div>
                <strong>{name}</strong>
                <span>{stageStatus}</span>
              </div>
            </div>
          ))}
        </section>

        {run?.stageReports?.length ? (
          <section className="progress-panel" aria-label="阶段小结">
            <div className="section-heading">
              <div>
                <p className="kicker">阶段小结</p>
                <h3>每一步都保留了可查看的中间结果与修订记录</h3>
              </div>
            </div>
            <div className="report-grid">
              {run.stageReports.map((report) => (
                <article className="report-card" key={report.name}>
                  <div className="card-topline">
                    <strong>{stageReportLabel(report.name)}</strong>
                    <span className="pill muted">
                      {stageReportStatusLabel(report.status)}
                    </span>
                  </div>
                  <p className="report-summary">{report.summary}</p>
                  {report.details.length ? (
                    <ul>
                      {report.details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  ) : null}
                  {report.revisions.length ? (
                    <div className="report-block">
                      <strong>修订</strong>
                      {report.revisions.map((revision) => (
                        <p key={revision}>{revision}</p>
                      ))}
                    </div>
                  ) : null}
                  {report.errors.length ? (
                    <div className="report-block error">
                      <strong>错误</strong>
                      {report.errors.map((errorItem) => (
                        <p key={errorItem}>{errorItem}</p>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {error ? (
          <section className="notice error" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <span>{error}</span>
          </section>
        ) : null}

        {run ? (
          <WorkflowDashboard
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            run={run}
          />
        ) : (
          <EmptyWorkbench />
        )}
      </section>
    </main>
  );
}

function ModelStatusNotice({
  status,
}: {
  status: NonNullable<ReturnType<typeof useModelStatus>>;
}) {
  return (
    <div
      className={`model-status ${status.modelDrivenAvailable ? "ready" : "fallback"}`}
      role="status"
      aria-label="模型配置状态"
    >
      <div>
        <strong>
          {status.modelDrivenAvailable ? "模型驱动分析已就绪" : "当前使用确定性兜底"}
        </strong>
        <span>{status.message}</span>
      </div>
      <span className="model-chip">
        {status.provider} · {status.model}
      </span>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className="metric-card">
      <span aria-hidden="true">{icon}</span>
      <div>
        <p className="metric-label">{label}</p>
        <p className="metric-value">{value}</p>
      </div>
    </article>
  );
}

function WorkflowDashboard({
  activeTab,
  onChangeTab,
  run,
}: {
  activeTab: ArtifactTab;
  onChangeTab: (tab: ArtifactTab) => void;
  run: WorkflowRun;
}) {
  const summaryCards = [
    {
      label: "原始评论",
      value: run.rawReviews.length,
      hint: `保留 ${run.cleaningSummary.retainedCount} 条`,
    },
    {
      label: "平均评分",
      value: run.ratingSummary.averageRating,
      hint: "基于清洗后评论",
    },
    {
      label: "产品发现",
      value: run.findings.length,
      hint: run.analysisSummary.modelDriven ? "模型驱动" : "确定性兜底",
    },
    {
      label: "需求数量",
      value: run.requirements.length,
      hint: "全部关联证据",
    },
    {
      label: "QA 用例",
      value: run.testCases.length,
      hint: "覆盖需求链路",
    },
    {
      label: "追溯校验",
      value: run.traceabilityValidation.status === "passed" ? "通过" : "未通过",
      hint: run.source.label,
    },
  ];
  const scopeSummary = scopeSummaryForRun(run);

  return (
    <section className="dashboard" aria-label="分析结果">
      <div className="section-heading">
        <div>
          <p className="kicker">分析结果</p>
          <h2>本次运行已生成可追溯交付物</h2>
        </div>
        <span
          className={
            run.traceabilityValidation.status === "passed"
              ? "status-badge success"
              : "status-badge warning"
          }
        >
          追溯{run.traceabilityValidation.status === "passed" ? "通过" : "未通过"}
        </span>
      </div>

      <dl className="summary-grid">
        {summaryCards.map((card) => (
          <div className="summary-card" key={card.label}>
            <dt>{card.label}</dt>
            <dd>{card.value}</dd>
            <span>{card.hint}</span>
          </div>
        ))}
      </dl>

      <section className="scope-panel" aria-label="分析范围">
        <div className="section-heading">
          <div>
            <p className="kicker">分析范围</p>
            <h3>系统已根据目标和可用评论收敛当前关注点</h3>
          </div>
        </div>
        <article className="compact-card scope-card">
          <h4>{scopeSummary.focusSummary}</h4>
          <p>用户目标：{scopeSummary.requestedGoal}</p>
          <p>
            范围评论：{(scopeSummary.scopeReviewIds ?? []).join(", ") || "全部保留评论"}
          </p>
          <div className="chip-row" aria-label="分析主题">
            {scopeSummary.focusAreas.map((item) => (
              <span className="pill" key={item}>
                {item}
              </span>
            ))}
          </div>
          <div className="scope-columns">
            <div>
              <strong>证据信号</strong>
              {scopeSummary.dataSignals.map((signal) => (
                <p key={signal}>{signal}</p>
              ))}
            </div>
            <div>
              <strong>约束与不确定性</strong>
              {scopeSummary.constraints.map((constraint) => (
                <p key={constraint}>{constraint}</p>
              ))}
              {scopeSummary.uncertaintyNotes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="insight-panel" aria-label="核心洞察">
        <div className="insight-header">
          <div>
            <p className="kicker">核心洞察</p>
            <h3>从评论证据提炼出的主要产品信号</h3>
          </div>
          <span className="run-id">运行编号：{run.runId}</span>
        </div>

        <div className="insight-list">
          {run.findings.map((finding) => (
            <FindingCard finding={finding} key={finding.id} />
          ))}
        </div>
      </section>

      <section className="artifact-panel" aria-label="分析交付物">
        <div className="tabs" role="tablist" aria-label="交付物类型">
          {artifactTabs.map((tab) => (
            <button
              aria-selected={activeTab === tab.id}
              className="tab-button"
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="tab-panel" role="tabpanel">
          {renderArtifactTab(activeTab, run)}
        </div>
      </section>
    </section>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <article className="finding-card">
      <div className="finding-title-row">
        <h4>{finding.title}</h4>
        <span>{finding.confidence}</span>
      </div>
      <p className="evidence-line">
        样本 {finding.sampleCount} 条 · 证据：{finding.reviewIds.join(", ")}
      </p>
      <div className="quote-list">
        {finding.evidence.map((item) => (
          <blockquote key={item.reviewId}>
            <strong>{item.reviewId}</strong>
            <span>{item.excerpt}</span>
          </blockquote>
        ))}
      </div>
      {finding.conflictingEvidence.length ? (
        <div className="conflict-box">
          <strong>冲突证据</strong>
          {finding.conflictingEvidence.map((item) => (
            <p key={item.reviewId}>
              {item.reviewId}：{item.excerpt}
            </p>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function renderArtifactTab(tab: ArtifactTab, run: WorkflowRun) {
  if (tab === "rawReviews") {
    return (
      <div className="artifact-list">
        {run.rawReviews.map((review) => (
          <article className="compact-card" key={review.id}>
            <div>
              <span className="pill">{review.rating} 星</span>
              <h4>{review.title}</h4>
            </div>
            <p>{review.body}</p>
            <small>{review.id}</small>
          </article>
        ))}
      </div>
    );
  }

  if (tab === "reviews") {
    return (
      <div className="artifact-list">
        <article className="compact-card">
          <h4>清理后的评论集</h4>
          <p>
            已去重并移除空评论，共保留 {run.reviews.length} 条，可用于后续发现与追溯。
          </p>
          <small>
            去重 {run.cleaningSummary.duplicateCount} 条 · 移除空评论{" "}
            {run.cleaningSummary.discardedEmptyCount} 条
          </small>
        </article>
        {run.reviews.map((review) => (
          <article className="compact-card" key={review.id}>
            <div>
              <span className="pill">{review.rating} 星</span>
              <h4>{review.title}</h4>
            </div>
            <p>{review.body}</p>
            <small>{review.id}</small>
          </article>
        ))}
      </div>
    );
  }

  if (tab === "analysis") {
    const scopeSummary = scopeSummaryForRun(run);

    return (
      <div className="artifact-list">
        <article className="compact-card">
          <div className="card-topline">
            <Sparkles size={18} aria-hidden="true" />
            <span>
              {run.analysisSummary.provider} / {run.analysisSummary.model}
            </span>
          </div>
          <h4>
            {run.analysisSummary.modelDriven ? "模型驱动分类" : "确定性兜底分类"}
          </h4>
          <p>分类范围：{scopeSummary.focusSummary}</p>
          <p>
            范围评论：{(scopeSummary.scopeReviewIds ?? []).join(", ") || "全部保留评论"}
          </p>
          <div className="chip-row">
            {scopeSummary.focusAreas.map((item) => (
              <span className="pill" key={item}>
                {item}
              </span>
            ))}
          </div>
        </article>
        {run.findings.map((finding) => (
          <article className="compact-card" key={finding.id}>
            <div className="card-topline">
              <strong>{finding.title}</strong>
              <span className="pill muted">{finding.confidence}</span>
            </div>
            <p>样本 {finding.sampleCount} 条 · 方法：{finding.method}</p>
            <p>证据：{finding.reviewIds.join(", ")}</p>
            <p>冲突证据：{finding.conflictingEvidence.length}</p>
          </article>
        ))}
      </div>
    );
  }

  if (tab === "requirements") {
    return (
      <div className="artifact-list">
        {run.requirements.map((requirement) => (
          <article className="compact-card" key={requirement.id}>
            <div className="card-topline">
              <span className="pill">{requirement.priority}</span>
              <span className="pill muted">{requirement.version}</span>
            </div>
            <h4>{requirement.title}</h4>
            <p>来源评论：{requirement.sourceReviewIds.join(", ")}</p>
            <p>边界：{requirement.boundaries.join("；")}</p>
            <div className="report-block">
              <strong>验收条件</strong>
              {(requirement.acceptanceCriteria ?? []).map((criterion) => (
                <p key={criterion}>{criterion}</p>
              ))}
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (tab === "versionPlan") {
    return (
      <div className="artifact-list">
        {run.versionPlan.versions.map((version) => (
          <article className="compact-card" key={version.id}>
            <h4>{version.name}</h4>
            <p>{version.goal}</p>
            <small>需求：{version.requirementIds.join(", ")}</small>
          </article>
        ))}
      </div>
    );
  }

  if (tab === "prd") {
    const scopeSummary = scopeSummaryForRun(run);

    return (
      <div className="artifact-list">
        <article className="compact-card">
          <div className="card-topline">
            <FileText size={18} aria-hidden="true" />
            <span>{run.prd.title}</span>
          </div>
          <h4>{run.prd.objective}</h4>
          <p>范围：{scopeSummary.focusSummary}</p>
          <div className="chip-row">
            {scopeSummary.focusAreas.map((item) => (
              <span className="pill" key={item}>
                {item}
              </span>
            ))}
          </div>
          {scopeSummary.constraints.map((item) => (
            <p key={item}>约束：{item}</p>
          ))}
          {scopeSummary.uncertaintyNotes.map((item) => (
            <p key={item}>不确定性：{item}</p>
          ))}
        </article>
        <article className="compact-card">
          <h4>版本与需求</h4>
          {run.prd.versions.map((version) => (
            <p key={version.id}>
              {version.name}：{version.goal}
            </p>
          ))}
          {run.prd.requirements.map((requirement) => (
            <p key={requirement.id}>
              {requirement.priority} · {requirement.title}
            </p>
          ))}
        </article>
        <article className="compact-card">
          <h4>成功指标与假设</h4>
          {run.prd.successMetrics.map((metric) => (
            <p key={metric}>成功指标：{metric}</p>
          ))}
          {run.prd.assumptions.length ? (
            <>
              <strong>假设</strong>
              {run.prd.assumptions.map((assumption) => (
                <p key={assumption.id}>{assumption.title}</p>
              ))}
            </>
          ) : (
            <p>当前没有需要单独标记的假设。</p>
          )}
        </article>
      </div>
    );
  }

  if (tab === "testCases") {
    return (
      <div className="artifact-list">
        {run.testCases.map((testCase) => (
          <article className="compact-card" key={testCase.id}>
            <h4>{testCase.title}</h4>
            <p>需求：{testCase.requirementId}</p>
            <p>来源评论：{testCase.sourceReviewIds.join(", ")}</p>
            {(testCase.verificationPoints ?? []).length ? (
              <div className="report-block">
                <strong>验证点</strong>
                {(testCase.verificationPoints ?? []).map((point) => (
                  <p key={point}>{point}</p>
                ))}
              </div>
            ) : null}
            <ol>
              {testCase.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p>期望结果：{testCase.expectedResult}</p>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="artifact-list">
      <article className="compact-card">
        <h4>
          追溯校验：
          {run.traceabilityValidation.status === "passed" ? "通过" : "未通过"}
        </h4>
        {run.dataLimitations.map((limitation) => (
          <p key={limitation}>数据限制：{limitation}</p>
        ))}
        {run.validationMessages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </article>
    </div>
  );
}

function scopeSummaryForRun(run: WorkflowRun): AnalysisScope {
  return (
    run.analysisScope ??
    run.prd.scopeSummary ?? {
      requestedGoal: run.scope.analysisGoal || "当前分析目标",
      focusSummary: run.scope.analysisGoal || "当前分析目标",
      focusAreas: ["综合用户反馈"],
      dataSignals: ["等待后端返回结构化分析范围。"],
      constraints: ["只使用当前评论证据。"],
      uncertaintyNotes: [],
      scopeReviewIds: [],
    }
  );
}

function stageReportLabel(name: string) {
  const labels: Record<string, string> = {
    analysis: "分类结果",
    cleaning: "清洗",
    prd: "产品需求文档",
    rawReviews: "原始审查",
    reviews: "评论收集",
    scope: "范围",
    tests: "测试",
    validation: "校验",
  };

  return labels[name] ?? name;
}

function stageReportStatusLabel(status: string) {
  const labels: Record<string, string> = {
    complete: "已完成",
    failed: "失败",
    pending: "等待中",
    running: "运行中",
  };

  return labels[status] ?? status;
}

function EmptyWorkbench() {
  return (
    <section className="empty-state" aria-label="空状态">
      <div className="empty-visual">
        <Sparkles size={26} aria-hidden="true" />
      </div>
      <div>
        <p className="kicker">等待运行</p>
        <h2>生成后会在这里展示完整分析报告</h2>
        <p>
          结果会按“评论证据 → 产品发现 → 需求 → 测试用例 → 追溯校验”的顺序组织，
          方便你做手动验收或课堂展示。
        </p>
      </div>
      <div className="empty-grid">
        <article>
          <BarChart3 size={18} aria-hidden="true" />
          <strong>结果概览</strong>
          <span>评论数、评分、发现数和校验状态。</span>
        </article>
        <article>
          <Target size={18} aria-hidden="true" />
          <strong>核心洞察</strong>
          <span>每个发现都显示评论证据。</span>
        </article>
        <article>
          <ClipboardCheck size={18} aria-hidden="true" />
          <strong>QA 覆盖</strong>
          <span>测试用例直接关联需求和评论。</span>
        </article>
      </div>
    </section>
  );
}
