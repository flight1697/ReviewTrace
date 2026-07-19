"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
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
  const {
    error,
    failWorkflow,
    progressStages,
    requestWorkflow,
    run,
    stageReports,
    status,
  } = useWorkflowRun();
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

  async function runFixtureWorkflow() {
    setSourceMode("fixture");
    await requestWorkflow({
      appStoreUrl: appStoreLink,
      analysisGoal,
      sourceMode: "fixture",
    });
  }

  function showImportControls() {
    setSourceMode("import");
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

  const visibleStages = visibleWorkflowStages(run, status, progressStages);
  const visibleStageReports = run?.stageReports ?? stageReports;
  const isRunning = status === "running";
  const hasWorkflowActivity =
    Boolean(run) || progressStages.length > 0 || status !== "idle";
  const activeStage = visibleStages.find(
    ([, stageStatus]) => stageStatus === "运行中",
  );
  const failedStage = visibleStages.find(
    ([, stageStatus]) => stageStatus === "失败",
  );
  const completedStages = visibleStages.filter(
    ([, stageStatus]) => stageStatus === "已完成",
  );
  const spotlightStage =
    activeStage ??
    failedStage ??
    completedStages.at(-1) ??
    (hasWorkflowActivity ? visibleStages[0] : undefined);
  const progressTitle = isRunning
    ? "工作流正在流式返回阶段进度"
    : run
      ? "工作流已完成，进度可回溯"
      : status === "failed"
        ? "工作流已停止，请查看错误信息"
        : "等待启动工作流";
  const progressBadgeText = spotlightStage
    ? `当前：${spotlightStage[0]} · ${spotlightStage[1]}`
    : "状态：待启动";

  return (
    <main className="shell shell--dashboard">
      <span className="ambient-orb ambient-orb-one" aria-hidden="true" />
      <span className="ambient-orb ambient-orb-two" aria-hidden="true" />

      <section className="hero hero--dashboard" aria-label="ReviewTrace 产品介绍">
        <div className="hero-copy">
          <div className="eyebrow">
            <Activity size={18} aria-hidden="true" />
            评论证据链分析工作台
          </div>
          <h1>ReviewTrace</h1>
          <p>
            把 App Store 评论变成结构清晰、可追溯、能直接行动的产品分析报告。
          </p>
          <div className="hero-tags" aria-label="当前能力">
            <span>评论采集</span>
            <span>证据发现</span>
            <span>PRD 草案</span>
            <span>QA 覆盖</span>
          </div>
        </div>

        <div className="hero-spotlight">
          <ModelStatusNotice status={modelStatus ?? null} />
          <div className="hero-metrics" aria-label="工作流能力概览">
            <MetricCard
              icon={<Database />}
              label="当前阶段"
              value={spotlightStage?.[0] ?? "待命"}
            />
            <MetricCard
              icon={<Target />}
              label="数据源"
              value={sourceLabel(sourceMode)}
            />
            <MetricCard
              icon={<ClipboardCheck />}
              label="交付链路"
              value="PRD → 测试 → 追溯"
            />
          </div>
        </div>
      </section>

      <section className="control-dock card-surface" aria-label="任务配置">
        <div className="section-heading">
          <div>
            <p className="kicker">任务配置</p>
            <h2>告诉 ReviewTrace 要分析什么</h2>
          </div>
          <span className="soft-badge">中文报告优先</span>
        </div>

        <form className="task-form task-form--dashboard">
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

          <div className="source-picker source-picker--dashboard" aria-label="数据源选择">
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

          <div className="submit-row submit-row--dashboard">
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

            <p className="helper-text helper-text--dashboard">
              在线采集依赖 Apple 公开 RSS；如果返回空数据，可切换缓存示例或导入评论。
            </p>

            {sourceMode === "import" ? <ImportSampleDownloads /> : null}
          </div>
        </form>
      </section>

      <section className="progress-board card-surface" aria-label="执行进度">
        <div className="section-heading">
          <div>
            <p className="kicker">执行进度</p>
            <h2>{progressTitle}</h2>
          </div>
          <span className="status-badge progress-badge">
            {progressBadgeText}
          </span>
        </div>

        <div className="workflow-rail" role="list" aria-label="工作流阶段">
          {visibleStages.map(([name, stageStatus], index) => (
            <article className="workflow-step" data-status={stageStatus} key={name} role="listitem">
              <span className="workflow-marker">
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
            </article>
          ))}
        </div>

        {visibleStageReports.length ? (
          <div className="progress-story">
            <div className="progress-story__header">
              <div>
                <p className="kicker">阶段小结</p>
                <h3>每一步都保留了可查看的中间结果与修订记录</h3>
              </div>
              <span className="run-id">{isRunning ? "实时流式更新中" : "完整结果已回放"}</span>
            </div>
            <div className="report-grid report-grid--story">
              {visibleStageReports.map((report) => (
                <article className="report-card report-card--story" key={report.name}>
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
          </div>
        ) : null}

        {error ? (
          <section className="notice error" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <span>{error}</span>
          </section>
        ) : null}
      </section>

      {run ? (
        <WorkflowDashboard
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          onRunFixture={runFixtureWorkflow}
          onShowImport={showImportControls}
          run={run}
        />
      ) : (
        <EmptyWorkbench />
      )}
    </main>
  );
}

function ImportSampleDownloads() {
  return (
    <div className="sample-downloads" aria-label="导入样例下载">
      <a
        download="reviewtrace-sample-reviews.json"
        href={sampleDatasetHref("json")}
      >
        <Download size={16} aria-hidden="true" />
        下载 JSON 样例
      </a>
      <a
        download="reviewtrace-sample-reviews.csv"
        href={sampleDatasetHref("csv")}
      >
        <Download size={16} aria-hidden="true" />
        下载 CSV 样例
      </a>
      <span>字段包含 id、rating、title、body、appVersion，可直接导入试跑。</span>
    </div>
  );
}

function ModelStatusNotice({
  status,
}: {
  status: NonNullable<ReturnType<typeof useModelStatus>> | null;
}) {
  if (!status) {
    return (
      <div className="model-status fallback" role="status" aria-label="模型配置状态">
        <div>
          <strong>正在读取模型配置</strong>
          <span>稍后会显示 provider、模型名称和可用状态。</span>
        </div>
        <span className="model-chip">加载中</span>
      </div>
    );
  }

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

function sourceLabel(mode: SourceMode) {
  if (mode === "live") {
    return "在线采集";
  }

  if (mode === "fixture") {
    return "缓存示例";
  }

  return "导入文件";
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

function LiveEmptyNotice({
  onRunFixture,
  onShowImport,
}: {
  onRunFixture: () => void;
  onShowImport: () => void;
}) {
  return (
    <section
      aria-label="live 源空数据提示"
      className="notice warning empty-live-notice"
      role="alert"
    >
      <AlertTriangle size={20} aria-hidden="true" />
      <div>
        <strong>Apple RSS 暂时没有返回可分析评论</strong>
        <p>
          ReviewTrace 已停止生成发现、需求和测试用例，避免伪造无证据结论。你可以
          改用缓存示例，或导入 JSON / CSV 评论继续分析。
        </p>
        <div className="recovery-actions">
          <button onClick={onRunFixture} type="button">
            改用缓存示例
          </button>
          <button onClick={onShowImport} type="button">
            导入 JSON / CSV 评论
          </button>
          <span>稍后重新采集 live 源</span>
        </div>
      </div>
    </section>
  );
}

function WorkflowDashboard({
  activeTab,
  onChangeTab,
  onRunFixture,
  onShowImport,
  run,
}: {
  activeTab: ArtifactTab;
  onChangeTab: (tab: ArtifactTab) => void;
  onRunFixture: () => void;
  onShowImport: () => void;
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
    <section className="dashboard dashboard--workspace" aria-label="分析工作区">
      <div className="workspace-banner">
        <div>
          <p className="kicker">分析结果</p>
          <h2>本次运行已生成可追溯交付物</h2>
          <p className="workspace-banner__text">
            左侧看结论，中间看证据，右侧看交付物；同一条评论链路从上到下都能回到原始来源。
          </p>
        </div>
        <div className="workspace-banner__meta">
          <span
            className={
              run.traceabilityValidation.status === "passed"
                ? "status-badge success"
                : "status-badge warning"
            }
          >
            追溯{run.traceabilityValidation.status === "passed" ? "通过" : "未通过"}
          </span>
          <span className="run-id">运行编号：{run.runId}</span>
          {isLiveEmptyRun(run) ? (
            <LiveEmptyNotice
              onRunFixture={onRunFixture}
              onShowImport={onShowImport}
            />
          ) : null}
        </div>
      </div>

      <dl className="summary-grid summary-grid--dashboard">
        {summaryCards.map((card) => (
          <div className="summary-card summary-card--dashboard" key={card.label}>
            <dt>{card.label}</dt>
            <dd>{card.value}</dd>
            <span>{card.hint}</span>
          </div>
        ))}
      </dl>

      <div className="workspace-grid">
        <section className="workspace-column workspace-column--insights" aria-label="核心洞察">
          <div className="column-heading">
            <div>
              <p className="kicker">核心洞察</p>
              <h3>从评论证据提炼出的主要产品信号</h3>
            </div>
          </div>

          <div className="insight-list">
            {run.findings.length ? (
              run.findings.map((finding) => (
                <FindingCard finding={finding} key={finding.id} />
              ))
            ) : (
              <article className="empty-result-card">
                <AlertTriangle size={18} aria-hidden="true" />
                <div>
                  <strong>当前没有生成产品发现</strong>
                  <p>系统没有足够评论证据，因此没有继续生成需求或 QA 用例。</p>
                </div>
              </article>
            )}
          </div>
        </section>

        <section className="workspace-column workspace-column--evidence" aria-label="证据与范围">
          <div className="column-heading">
            <div>
              <p className="kicker">证据与范围</p>
              <h3>清楚说明为什么这些评论被纳入，哪些被排除</h3>
            </div>
          </div>

          <article className="scope-panel scope-panel--dashboard">
            <div className="scope-hero">
              <h4>{scopeSummary.focusSummary}</h4>
              <span className="pill muted">
                {scopeSummary.scopeReviewIds?.length ?? 0} 条范围评论
              </span>
            </div>
            <p>用户目标：{scopeSummary.requestedGoal}</p>
            <p>
              过滤说明：
              {scopeSummary.selectionSummary ||
                "系统会根据分析目标、评分、版本和评论内容选择当前分析范围。"}
            </p>
            <div className="chip-row" aria-label="分析主题">
              {scopeSummary.focusAreas.map((item) => (
                <span className="pill" key={item}>
                  {item}
                </span>
              ))}
            </div>
            <div className="scope-columns scope-columns--dashboard">
              <div>
                <strong>证据信号</strong>
                {scopeSummary.dataSignals.map((signal) => (
                  <p key={signal}>{signal}</p>
                ))}
              </div>
              <div>
                <strong>过滤规则</strong>
                {(scopeSummary.filteringRules ?? []).map((rule) => (
                  <p key={rule}>规则：{rule}</p>
                ))}
                {scopeSummary.constraints.map((constraint) => (
                  <p key={constraint}>{constraint}</p>
                ))}
                {scopeSummary.uncertaintyNotes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            </div>
            <div className="scope-footer">
              <span>范围评论：{(scopeSummary.scopeReviewIds ?? []).join(", ") || "全部保留评论"}</span>
              <span>排除评论：{(scopeSummary.excludedReviewIds ?? []).join(", ") || "无"}</span>
            </div>
          </article>

          <article className="review-signal-card">
            <div className="card-topline">
              <strong>数据质量与验证</strong>
              <span className="pill muted">透明记录</span>
            </div>
            <div className="review-signal-grid">
              <div>
                <span>原始评论</span>
                <strong>{run.rawReviews.length}</strong>
              </div>
              <div>
                <span>清洗后</span>
                <strong>{run.reviews.length}</strong>
              </div>
              <div>
                <span>数据限制</span>
                <strong>{run.dataLimitations.length}</strong>
              </div>
            </div>
            <div className="report-block">
              <strong>验证消息</strong>
              {run.validationMessages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          </article>
        </section>

        <section className="workspace-column workspace-column--deliverables" aria-label="分析交付物">
          <div className="column-heading">
            <div>
              <p className="kicker">分析交付物</p>
              <h3>PRD、需求、测试和校验在这里统一查看</h3>
            </div>
          </div>

          <div className="tabs tabs--workspace" role="tablist" aria-label="交付物类型">
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

          <div className="tab-panel tab-panel--workspace" role="tabpanel">
            {renderArtifactTab(activeTab, run)}
          </div>
        </section>
      </div>
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
        {run.rawReviews.length === 0 ? (
          <article className="compact-card warning-card">
            <h4>没有原始评论</h4>
            <p>live 源没有返回可读取的评论，系统不会伪造后续分析证据。</p>
          </article>
        ) : null}
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
        {run.reviews.length === 0 ? (
          <article className="compact-card warning-card">
            <h4>没有清洗后评论</h4>
            <p>请导入评论文件，或稍后重新尝试在线采集。</p>
          </article>
        ) : null}
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
          <p>
            过滤说明：
            {scopeSummary.selectionSummary ||
              "系统会根据分析目标和评论信号选择语义分析范围。"}
          </p>
          {(scopeSummary.filteringRules ?? []).map((rule) => (
            <p key={rule}>规则：{rule}</p>
          ))}
          <div className="chip-row">
            {scopeSummary.focusAreas.map((item) => (
              <span className="pill" key={item}>
                {item}
              </span>
            ))}
          </div>
        </article>
        {run.findings.length ? (
          run.findings.map((finding) => (
            <article className="compact-card" key={finding.id}>
              <div className="card-topline">
                <strong>{finding.title}</strong>
                <span className="pill muted">{finding.confidence}</span>
              </div>
              <p>样本 {finding.sampleCount} 条 · 方法：{finding.method}</p>
              <p>证据：{finding.reviewIds.join(", ")}</p>
              <p>冲突证据：{finding.conflictingEvidence.length}</p>
            </article>
          ))
        ) : (
          <article className="compact-card warning-card">
            <h4>没有分类结果</h4>
            <p>当前范围内没有评论证据，因此没有生成用户问题分类。</p>
          </article>
        )}
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
      selectionSummary: "",
      filteringRules: [],
      excludedReviewIds: [],
    }
  );
}

function isLiveEmptyRun(run: WorkflowRun) {
  return (
    run.source.mode === "live" &&
    run.rawReviews.length === 0 &&
    run.reviews.length === 0
  );
}

function sampleDatasetHref(format: "json" | "csv") {
  const jsonSample = {
    reviews: [
      {
        id: "sample-001",
        rating: 2,
        title: "订阅说明不清楚",
        body: "价格、包含内容和取消方式需要在购买前解释得更明确。",
        appVersion: "2.0.0",
        date: "2026-07-01T00:00:00Z",
        locale: "zh-CN",
        source: "import",
      },
      {
        id: "sample-002",
        rating: 5,
        title: "训练内容很方便",
        body: "居家训练课程安排清楚，动作提示也容易跟上。",
        appVersion: "2.0.0",
        date: "2026-07-02T00:00:00Z",
        locale: "zh-CN",
        source: "import",
      },
    ],
  };

  if (format === "json") {
    return `data:application/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(jsonSample, null, 2),
    )}`;
  }

  return `data:text/csv;charset=utf-8,${encodeURIComponent(
    [
      "id,rating,title,body,appVersion,date,locale,source",
      "sample-001,2,订阅说明不清楚,价格和取消方式需要更明确,2.0.0,2026-07-01T00:00:00Z,zh-CN,import",
      "sample-002,5,训练内容很方便,居家训练课程安排清楚,2.0.0,2026-07-02T00:00:00Z,zh-CN,import",
    ].join("\n"),
  )}`;
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
