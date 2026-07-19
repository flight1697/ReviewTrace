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
  type Finding,
  useModelStatus,
  type WorkflowRun,
} from "./workflow";

type SourceMode = "live" | "fixture" | "import";
type ArtifactTab =
  | "reviews"
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
  { id: "reviews", label: "评论证据" },
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
      value: run.cleaningSummary.inputCount,
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
  if (tab === "reviews") {
    return (
      <div className="artifact-list">
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
    return (
      <article className="compact-card">
        <div className="card-topline">
          <FileText size={18} aria-hidden="true" />
          <span>{run.prd.title}</span>
        </div>
        <h4>{run.prd.objective}</h4>
        {run.prd.successMetrics.map((metric) => (
          <p key={metric}>成功指标：{metric}</p>
        ))}
      </article>
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
