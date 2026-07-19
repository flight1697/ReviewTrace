"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDashed,
  ClipboardCheck,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  Filter,
  FolderOpen,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Layers3,
  ListChecks,
  Loader2,
  Menu,
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  TestTube2,
  TriangleAlert,
  Upload,
  Workflow,
  XCircle,
} from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  defaultAnalysisGoal,
  defaultAppStoreLink,
  readFileText,
  useModelStatus,
  useWorkflowRun,
  visibleWorkflowStages,
} from "./workflow";
import {
  demoApp,
  demoAppPreview,
  demoFindingCards,
  demoGoalChips,
  demoOverview,
  demoRequirements,
  demoReviewRows,
  demoScopeLimits,
  demoStages,
  demoSummaryMetrics,
  demoTestCases,
  demoThemeCards,
  demoValidationIssues,
  schemaExampleCsv,
  schemaExampleJson,
  type DemoInspectorKind,
  type DemoReviewRow,
  type DemoView,
} from "./reviewtrace-demo";

type SourceMode = "live" | "fixture" | "import";
type ReviewTab = "raw" | "clean";
type FindingsTab = "themes" | "findings";
type ValidateTab = "matrix" | "graph";
type InspectorSelection =
  | { kind: "run_health" }
  | { kind: "app_preview" }
  | { kind: "review"; id: string }
  | { kind: "theme"; id: string }
  | { kind: "finding"; id: string }
  | { kind: "requirement"; id: string }
  | { kind: "test_case"; id: string }
  | { kind: "validation_issue"; id: string }
  | { kind: "overview" };

const views: Array<{
  description: string;
  id: DemoView;
  icon: ReactNode;
  label: string;
}> = [
  { id: "new", label: "新分析", description: "开始一次基于证据的分析", icon: <LayoutDashboard size={16} /> },
  { id: "run", label: "运行工作台", description: "查看阶段运行与追溯细节", icon: <Workflow size={16} /> },
  { id: "reviews", label: "评论", description: "原始与清洗后的评论语料", icon: <FolderOpen size={16} /> },
  { id: "findings", label: "主题与发现", description: "动态主题与证据支撑的发现", icon: <Sparkles size={16} /> },
  { id: "prd", label: "PRD", description: "结构化需求与文档草案", icon: <BookOpen size={16} /> },
  { id: "tests", label: "测试用例", description: "可追溯测试套件", icon: <TestTube2 size={16} /> },
  { id: "validate", label: "验证", description: "追溯矩阵与关系图", icon: <GitBranch size={16} /> },
  { id: "overview", label: "总览", description: "决策摘要与交付物", icon: <Gauge size={16} /> },
];

const stageNav = [
  { id: "scope", label: "1 范围", view: "run" as DemoView },
  { id: "collect", label: "2 收集", view: "run" as DemoView },
  { id: "clean", label: "3 清洗", view: "run" as DemoView },
  { id: "analyze", label: "4 分析", view: "run" as DemoView },
  { id: "evidence", label: "5 证据", view: "findings" as DemoView },
  { id: "prd", label: "6 PRD", view: "prd" as DemoView },
  { id: "tests", label: "7 测试用例", view: "tests" as DemoView },
  { id: "validate", label: "8 验证", view: "validate" as DemoView },
];

const artifactNav = [
  { id: "reviews", label: "原始评论", view: "reviews" as DemoView },
  { id: "findings", label: "主题图谱", view: "findings" as DemoView },
  { id: "prd", label: "PRD v1", view: "prd" as DemoView },
  { id: "tests", label: "测试套件", view: "tests" as DemoView },
  { id: "validate", label: "追溯矩阵", view: "validate" as DemoView },
  { id: "overview", label: "交付物", view: "overview" as DemoView },
];

const defaultInspectorMap: Record<DemoView, InspectorSelection> = {
  new: { kind: "app_preview" },
  run: { kind: "run_health" },
  reviews: { kind: "review", id: demoReviewRows[0].id },
  findings: { kind: "finding", id: demoFindingCards[0].id },
  prd: { kind: "requirement", id: demoRequirements[0].id },
  tests: { kind: "test_case", id: demoTestCases[0].id },
  validate: { kind: "validation_issue", id: demoValidationIssues[0].id },
  overview: { kind: "overview" },
};

function stageLabel(status: string) {
  if (status === "complete") return "已完成";
  if (status === "running") return "运行中";
  if (status === "warning") return "警告";
  return "等待中";
}

function stageIcon(status: string) {
  if (status === "complete") return <CheckCircle2 size={14} />;
  if (status === "running") return <Loader2 className="rt-spin" size={14} />;
  if (status === "warning") return <TriangleAlert size={14} />;
  return <CircleDashed size={14} />;
}

function inspectorKindLabel(kind: DemoInspectorKind | "run_health") {
  if (kind === "run_health") return "运行健康";
  if (kind === "app_preview") return "应用预览";
  if (kind === "review") return "评论";
  if (kind === "theme") return "主题";
  if (kind === "finding") return "发现";
  if (kind === "requirement") return "需求";
  if (kind === "test_case") return "测试用例";
  if (kind === "validation_issue") return "验证";
  return "总览";
}

function validationStatusClass(status: string) {
  if (status === "有效") return "valid";
  if (status === "警告") return "warning";
  return "broken";
}

export default function ReviewTraceWorkbench() {
  const [activeView, setActiveView] = useState<DemoView>("new");
  const [activeInspector, setActiveInspector] = useState<InspectorSelection>(
    defaultInspectorMap.new,
  );
  const [sourceMode, setSourceMode] = useState<SourceMode>("live");
  const [appStoreLink, setAppStoreLink] = useState(defaultAppStoreLink);
  const [analysisGoal, setAnalysisGoal] = useState(defaultAnalysisGoal);
  const [importFileName, setImportFileName] = useState("");
  const [importText, setImportText] = useState("");
  const [reviewTab, setReviewTab] = useState<ReviewTab>("raw");
  const [findingsTab, setFindingsTab] = useState<FindingsTab>("themes");
  const [validateTab, setValidateTab] = useState<ValidateTab>("matrix");
  const [requestedStart, setRequestedStart] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [inspectorHint, setInspectorHint] = useState("示例");

  const { error, failWorkflow, progressStages, requestWorkflow, run, stageReports, status } =
    useWorkflowRun();
  const modelStatus = useModelStatus();

  const liveStages = useMemo(
    () => visibleWorkflowStages(run, status, progressStages),
    [progressStages, run, status],
  );

  const currentStages =
    run != null
      ? liveStages
      : demoStages.map((stage) => [stage.label, stageLabel(stage.status)]);

  const currentRunStatus =
    status === "running" ? "运行中" : run ? "已验证" : status === "failed" ? "需要关注" : "演示就绪";

  const currentSource =
    run?.source.label ??
    (sourceMode === "import"
      ? "已导入 CSV"
      : sourceMode === "fixture"
        ? "缓存示例"
        : "App Store API");

  const currentRunId = run?.runId ?? demoApp.runId;
  const currentProvider =
    modelStatus?.provider && modelStatus?.model
      ? `${modelStatus.provider} · ${modelStatus.model}`
      : demoApp.provider;

  useEffect(() => {
    setValidationAttempted(false);
  }, [appStoreLink]);

  useEffect(() => {
    if (run && requestedStart) {
      setActiveView("run");
      setActiveInspector(defaultInspectorMap.run);
      setRequestedStart(false);
      setInspectorHint("实时");
    }
  }, [requestedStart, run]);

  function goToView(view: DemoView) {
    setActiveView(view);
    setActiveInspector(defaultInspectorMap[view]);
    setInspectorHint("示例");
  }

  async function handleStartAnalysis() {
    setValidationAttempted(true);
    const normalizedImportFileName = importFileName || "reviewtrace-import.json";

    if (sourceMode !== "import") {
      try {
        new URL(appStoreLink);
      } catch {
        return;
      }
    }

    if (sourceMode === "import" && !importText.trim()) {
      return;
    }

    setRequestedStart(true);
    try {
      if (sourceMode === "import") {
        await requestWorkflow({
          appStoreUrl: appStoreLink,
          analysisGoal,
          datasetFormat: normalizedImportFileName.toLowerCase().endsWith(".csv")
            ? "csv"
            : "json",
          datasetText: importText,
          sourceMode: "import",
        });
      } else {
        await requestWorkflow({
          appStoreUrl: appStoreLink,
          analysisGoal,
          sourceMode,
        });
      }
    } catch (caughtError) {
      failWorkflow(caughtError, "启动分析失败");
      setRequestedStart(false);
      setActiveView("new");
      setActiveInspector(defaultInspectorMap.new);
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setImportFileName(file.name);
    setImportText(await readFileText(file));
    setSourceMode("import");
    setActiveView("new");
    setActiveInspector({ kind: "app_preview" });
    setInspectorHint("导入");
  }

  function handleDropFile(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    void (async () => {
      setImportFileName(file.name);
      setImportText(await readFileText(file));
      setSourceMode("import");
      setActiveView("new");
      setActiveInspector({ kind: "app_preview" });
      setInspectorHint("导入");
    })();
  }

  const appStoreError = useMemo(() => {
    if (!validationAttempted && sourceMode !== "import") {
      return "";
    }

    if (sourceMode === "import") {
      return "";
    }

    try {
      const url = new URL(appStoreLink);
      if (url.hostname !== "apps.apple.com") {
        return "请输入美国 App Store 链接。";
      }
      if (!url.pathname.includes("/us/app/")) {
        return "请使用美国区 App Store 链接。";
      }
      return "";
    } catch {
      return "请输入完整的 App Store URL。";
    }
  }, [appStoreLink, sourceMode, validationAttempted]);

  function renderNewAnalysis() {
    return (
      <div className="rt-page rt-page--new">
        <div className="rt-page__lead">
          <div>
            <p className="rt-kicker">新分析</p>
            <h1>开始一次证据支撑的分析</h1>
            <p className="rt-lead">
              输入 App Store 链接或评论数据集，再补充一个分析目标，让系统围绕你真正要做的决策展开。
            </p>
          </div>
          <div className="rt-lead__status">
            <span className="rt-badge rt-badge--success">示例 / 缓存 / 实时</span>
            <span className="rt-subtle">不同地区商店与限流情况会影响评论可用性。</span>
          </div>
        </div>

        <div className="rt-segmented">
          <button
            className={`rt-segmented__button ${sourceMode !== "import" ? "is-active" : ""}`}
            type="button"
            onClick={() => setSourceMode("live")}
          >
            App Store 链接
          </button>
          <button
            className={`rt-segmented__button ${sourceMode === "import" ? "is-active" : ""}`}
            type="button"
            onClick={() => setSourceMode("import")}
          >
            导入 JSON / CSV
          </button>
        </div>

        <div className="rt-grid rt-grid--two">
          <section className={`rt-card rt-card--surface ${sourceMode === "import" ? "rt-card--dimmed" : ""}`}>
            <div className="rt-section-head">
              <div>
                <p className="rt-kicker">A. App Store 链接</p>
                <h2>粘贴可用的 App Store 商店链接</h2>
              </div>
              <span className="rt-pill">已预填演示链接</span>
            </div>
            <div className="rt-field rt-field--link">
              <span className="rt-field__icon">
                <Target size={18} />
              </span>
              <input
                aria-label="App Store 链接"
                className="rt-input rt-input--large"
                value={appStoreLink}
                onChange={(event) => setAppStoreLink(event.target.value)}
                placeholder="https://apps.apple.com/us/app/workout-for-women-home-gym/id839285684"
              />
            </div>
            {appStoreError ? <p className="rt-inline-error">{appStoreError}</p> : null}

            <button
              className="rt-preview"
              type="button"
              onClick={() => setActiveInspector({ kind: "app_preview" })}
            >
              <div className="rt-preview__icon">
                <AppIcon />
              </div>
              <div className="rt-preview__body">
                <strong>{demoAppPreview.name}</strong>
                <span>
                  {demoAppPreview.developer} · {demoAppPreview.category} · {demoAppPreview.version}
                </span>
                <div className="rt-preview__meta">
                  <span>{demoAppPreview.rating} ★</span>
                  <span>{demoAppPreview.reviews} 条评论</span>
                  <span>{demoAppPreview.storefront}</span>
                  <span>{demoAppPreview.sourceLabel}</span>
                </div>
              </div>
            </button>
            <p className="rt-note">{demoAppPreview.note}</p>
          </section>

          <section className={`rt-card rt-card--surface ${sourceMode === "import" ? "" : "rt-card--dimmed"}`}>
            <div className="rt-section-head">
              <div>
                <p className="rt-kicker">B. 导入 JSON / CSV</p>
                <h2>拖入评论数据集或上传文件</h2>
              </div>
              <a className="rt-link" href={`data:text/plain;charset=utf-8,${encodeURIComponent(schemaExampleJson)}`} download="reviewtrace-schema-example.json">
                下载字段示例
              </a>
            </div>

            <div
              className={`rt-dropzone ${sourceMode === "import" ? "is-active" : ""}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDropFile}
            >
              <Upload size={22} />
              <strong>将 JSON / CSV 拖到这里</strong>
              <span>支持 review_id、rating、text、date、locale、version。</span>
              <label className="rt-button rt-button--ghost">
                选择文件
                <input
                  aria-label="导入评论文件"
                  accept=".json,.csv,application/json,text/csv"
                  type="file"
                  onChange={handleImportFile}
                />
              </label>
            </div>

            <div className="rt-import-grid">
              <div>
                <span className="rt-mini-label">已选文件</span>
                <strong>{importFileName || "未选择文件"}</strong>
              </div>
              <div>
                <span className="rt-mini-label">预览行数</span>
                <strong>{importText ? "5 行" : "0 行"}</strong>
              </div>
              <div>
                <span className="rt-mini-label">数据来源</span>
                <strong>{sourceMode === "import" ? "已导入" : "示例"}</strong>
              </div>
            </div>

            <div className="rt-code-sample">
              <div className="rt-code-sample__head">
                <span>字段映射</span>
                <span>前 5 行预览</span>
              </div>
              <pre>{schemaExampleCsv}</pre>
            </div>
          </section>
        </div>

        <section className="rt-card rt-card--surface">
          <div className="rt-section-head">
            <div>
              <p className="rt-kicker">分析目标</p>
              <h2>补充目标，让分析围绕正确决策展开</h2>
            </div>
            <span className="rt-pill">建议 4–6 行</span>
          </div>
          <textarea
            aria-label="分析目标"
            className="rt-textarea rt-textarea--goal"
            value={analysisGoal}
            onChange={(event) => setAnalysisGoal(event.target.value)}
            placeholder="聚焦订阅转化、训练可用性、7.2 版本与低评分评论。请突出冲突反馈，避免依赖少于 3 条独立评论的结论。"
          />
          <div className="rt-chip-row">
            {demoGoalChips.map((chip) => (
              <button
                key={chip}
                className="rt-chip"
                type="button"
                onClick={() => setAnalysisGoal((value) => `${value ? `${value}\n` : ""}${chip}`)}
              >
                {chip}
              </button>
            ))}
          </div>
        </section>

        <section className="rt-card rt-card--surface rt-card--limits">
          <div className="rt-section-head">
            <div>
              <p className="rt-kicker">范围与限制</p>
              <h2>对评分、版本、语言和阈值提供透明控制</h2>
            </div>
            <span className="rt-pill">可折叠</span>
          </div>
          <div className="rt-limit-grid">
            {demoScopeLimits.map((item) => (
              <div key={item} className="rt-limit-item">
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="rt-inline-metrics">
            <div><strong>模型选择器</strong><span>GPT-5 · OpenAI</span></div>
            <div><strong>规则</strong><span>确定性 + LLM 阶段</span></div>
            <div><strong>兜底</strong><span>采集失败时包含缓存示例</span></div>
          </div>
        </section>

        <footer className="rt-action-bar">
          <div>
            <span className="rt-mini-label">预估流程</span>
            <strong>8 个阶段 · 实时数据集约 3 分钟</strong>
          </div>
          <div className="rt-action-bar__buttons">
            <button className="rt-button rt-button--secondary" type="button">
              保存草稿
            </button>
            <button
              className="rt-button rt-button--primary"
              type="button"
              onClick={handleStartAnalysis}
              disabled={status === "running"}
            >
              {status === "running" ? <Loader2 className="rt-spin" size={16} /> : <Play size={16} />}
              开始分析
            </button>
          </div>
        </footer>
        {error ? <p className="rt-global-error">{error}</p> : null}
      </div>
    );
  }

  function renderRunWorkspace() {
    const progressCopy = run
      ? "4 of 8 stages complete · 02:18 elapsed. The flow stays honest about limits, retries, and what still needs evidence."
      : "演示工作台 · 展示 8 个阶段中的 4 个。开始分析后即可查看实时运行与证据。";

    return (
      <div className="rt-page">
        <div className="rt-page__lead">
          <div>
            <p className="rt-kicker">运行工作台</p>
            <h1>{run ? "查看实时运行" : "单页追溯式执行视图"}</h1>
            <p className="rt-lead">{progressCopy}</p>
          </div>
          <div className="rt-lead__status">
            <span className={`rt-badge ${status === "running" ? "rt-badge--running" : run ? "rt-badge--success" : "rt-badge--warning"}`}>
              {currentRunStatus}
            </span>
            <span className="rt-subtle">运行 ID {currentRunId}</span>
          </div>
        </div>

        <div className="rt-inline-metrics rt-inline-metrics--clickable">
          {run != null ? demoSummaryMetrics.map((metric) => (
            <button key={metric.label} className="rt-metric" type="button" onClick={() => setActiveInspector({ kind: "run_health" })}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.hint}</small>
            </button>
          )) : demoSummaryMetrics.map((metric) => (
            <button key={metric.label} className="rt-metric" type="button" onClick={() => setActiveInspector({ kind: "run_health" })}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.hint}</small>
            </button>
          ))}
        </div>

        <section className="rt-card rt-card--surface">
          <div className="rt-section-head">
            <div>
              <p className="rt-kicker">追溯时间线</p>
              <h2>可展开行展示方法类型、输入、输出、token 与警告</h2>
            </div>
            <span className="rt-pill">确定性 / 模型生成</span>
          </div>
          <div className="rt-trace-list">
            {currentStages.map(([name, stageStatus], index) => {
              const demoStage = demoStages[index];
              return (
                <details key={name} className={`rt-trace-row ${demoStage?.status === "running" ? "is-running" : ""}`} open={index < 2}>
                  <summary className="rt-trace-row__summary" onClick={() => setActiveInspector({ kind: "run_health" })}>
                    <span className={`rt-status-dot rt-status-dot--${demoStage?.status ?? "pending"}`}>{stageIcon(demoStage?.status ?? "pending")}</span>
                    <span className="rt-trace-row__main">
                      <strong>{name}</strong>
                      <span>{demoStage?.method ?? "确定性"} · {demoStage?.summary ?? "等待中"}</span>
                    </span>
                    <span className="rt-trace-row__meta">
                      <small>{stageStatus}</small>
                      <small>{demoStage?.duration ?? "—"}</small>
                    </span>
                    <span className="rt-trace-row__meta rt-trace-row__meta--narrow">
                      <small>{demoStage?.input ?? "—"}</small>
                      <small>{demoStage?.output ?? "—"}</small>
                      <small>{demoStage?.tokens ?? "—"} token</small>
                    </span>
                  </summary>
                  <div className="rt-trace-row__body">
                    <div>
                      <span className="rt-mini-label">摘要</span>
                      <p>{demoStage?.summary}</p>
                    </div>
                    <div className="rt-trace-grid">
                      <div><strong>输入</strong><span>{demoStage?.input}</span></div>
                      <div><strong>输出</strong><span>{demoStage?.output}</span></div>
                      <div><strong>警告</strong><span>{demoStage?.badge}</span></div>
                      <div><strong>Token</strong><span>{demoStage?.tokens}</span></div>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        <section className="rt-card rt-card--surface">
          <div className="rt-section-head">
            <div>
              <p className="rt-kicker">阶段报告</p>
              <h2>每条报告都保留修订、失败与说明</h2>
            </div>
            <span className="rt-pill">{stageReports.length || demoStages.length} 条报告</span>
          </div>
          <div className="rt-report-grid">
            {(stageReports.length ? stageReports : demoStages.slice(0, 4).map((stage, index) => ({
              name: stage.id,
              status: stage.status,
              summary: stage.summary,
              details: [stage.input, stage.output],
              revisions: index === 1 ? ["实时数据被限流；已使用缓存示例兜底。"] : ["确定性步骤。"] ,
              errors: stage.status === "warning" ? ["需要关注"] : [],
            }))).map((report) => (
              <article key={report.name} className="rt-report-card">
                <div className="rt-report-card__head">
                  <strong>{report.name}</strong>
                  <span className={`rt-badge rt-badge--${report.status === "complete" ? "success" : report.status === "running" ? "running" : "warning"}`}>
                    {stageLabel(report.status)}
                  </span>
                </div>
                <p>{report.summary}</p>
                <ul>
                  {report.details?.slice(0, 2).map((item) => <li key={item}>{item}</li>)}
                </ul>
                <div className="rt-mini-stack">
                  {report.revisions?.map((item) => <span key={item}>{item}</span>)}
                  {report.errors?.map((item) => <span key={item} className="rt-warning">{item}</span>)}
                </div>
              </article>
            ))}
          </div>
        </section>

        {status === "failed" ? (
          <section className="rt-card rt-card--surface rt-card--error">
            <AlertTriangle size={18} />
            <div>
              <strong>阶段失败，但流程会如实展示。</strong>
              <p>{error}</p>
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  function renderReviews() {
    const rows = reviewTab === "raw" ? demoReviewRows : demoReviewRows.filter((row) => !row.duplicateOf);
    return (
      <div className="rt-page">
        <div className="rt-page__lead">
          <div>
              <p className="rt-kicker">评论语料</p>
              <h1>原始评论与清洗评论</h1>
              <p className="rt-lead">1,284 条原始 → 1,182 条清洗后。可搜索、筛选并在右侧检查器中打开任一行。</p>
          </div>
          <div className="rt-tabs">
            <button className={`rt-tab ${reviewTab === "raw" ? "is-active" : ""}`} type="button" onClick={() => setReviewTab("raw")}>原始评论</button>
            <button className={`rt-tab ${reviewTab === "clean" ? "is-active" : ""}`} type="button" onClick={() => setReviewTab("clean")}>清洗数据集</button>
          </div>
        </div>

        <div className="rt-filter-bar">
          <button className="rt-chip rt-chip--soft" type="button"><Search size={14} /> 搜索</button>
          <button className="rt-chip rt-chip--soft" type="button"><Filter size={14} /> 评分</button>
          <button className="rt-chip rt-chip--soft" type="button"><CalendarRange size={14} /> 日期</button>
          <button className="rt-chip rt-chip--soft" type="button"><Layers3 size={14} /> 版本</button>
          <button className="rt-chip rt-chip--soft" type="button"><ClipboardCheck size={14} /> 重复项</button>
        </div>

        <section className="rt-card rt-card--surface">
          <table className="rt-table">
            <thead>
              <tr>
                <th>评论 ID</th>
                <th>评分</th>
                <th>日期</th>
                <th>版本</th>
                <th>地区</th>
                <th>摘录</th>
                <th>主题</th>
                <th>情绪</th>
                <th>证据用途</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="rt-table-row">
                  <td>
                    <button className="rt-link-button" type="button" onClick={() => setActiveInspector({ kind: "review", id: row.id })}>
                      {row.id}
                    </button>
                  </td>
                  <td><span className={`rt-rating rt-rating--${row.rating <= 2 ? "low" : row.rating === 3 ? "mid" : "high"}`}>{row.rating}★</span></td>
                  <td>{row.date}</td>
                  <td>{row.version}</td>
                  <td>{row.locale}</td>
                  <td>{row.excerpt}</td>
                  <td>{row.theme}</td>
                  <td>{row.sentiment}</td>
                  <td>{row.evidenceUsed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rt-card rt-card--surface">
          <div className="rt-section-head">
            <div>
              <p className="rt-kicker">所选评论</p>
              <h2>来源链、数据标签和重复状态保持可见</h2>
            </div>
            <span className="rt-pill">点击任一行</span>
          </div>
          <div className="rt-review-detail">
            {renderReviewSummary(rows[0])}
          </div>
        </section>
      </div>
    );
  }

  function renderFindings() {
    const activeTheme = demoThemeCards[0];
    return (
      <div className="rt-page">
        <div className="rt-page__lead">
          <div>
            <p className="rt-kicker">主题与发现</p>
            <h1>动态主题与证据支撑的发现</h1>
            <p className="rt-lead">主题不是固定关键词。发现会展示统计、归纳、冲突证据与假设。</p>
          </div>
          <div className="rt-tabs">
            <button className={`rt-tab ${findingsTab === "themes" ? "is-active" : ""}`} type="button" onClick={() => setFindingsTab("themes")}>主题</button>
            <button className={`rt-tab ${findingsTab === "findings" ? "is-active" : ""}`} type="button" onClick={() => setFindingsTab("findings")}>发现</button>
          </div>
        </div>

        <div className="rt-grid rt-grid--findings">
          <section className="rt-card rt-card--surface">
            <div className="rt-section-head">
              <div>
                <p className="rt-kicker">主题</p>
                <h2>主题卡展示支持度、置信度、趋势和冲突</h2>
              </div>
              <span className="rt-pill">高 / 中 / 低</span>
            </div>
            <div className="rt-theme-list">
              {demoThemeCards.map((theme) => (
                <button
                  key={theme.id}
                  className="rt-theme-card"
                  type="button"
                  onClick={() => setActiveInspector({ kind: "theme", id: theme.id })}
                >
                  <div className="rt-theme-card__head">
                    <div className="rt-theme-card__title">
                      <span className="rt-pill">{theme.id}</span>
                      <strong>{theme.name}</strong>
                    </div>
                    <span className="rt-pill">{theme.confidence}</span>
                  </div>
                  <p>{theme.summary}</p>
                  <div className="rt-theme-card__meta">
                    <span>{theme.reviews} 条评论 · {theme.share}</span>
                    <span>{theme.avgRating} 平均评分 · {theme.trend}</span>
                    <span>{theme.conflicts} conflicts</span>
                  </div>
                  <div className="rt-sparkline" aria-hidden="true">
                    {theme.spark.map((value, index) => (
                      <span key={index} style={{ height: `${value * 10}px` }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="rt-card rt-card--surface">
            <div className="rt-section-head">
              <div>
                <p className="rt-kicker">发现</p>
                <h2>发现卡片分开展示统计、归纳、冲突与假设</h2>
              </div>
              <span className="rt-pill">提升为需求</span>
            </div>
            <div className="rt-finding-list">
              {demoFindingCards.map((finding) => (
                <button
                  key={finding.id}
                  className={`rt-finding-card ${finding.assumption ? "is-assumption" : ""}`}
                  type="button"
                  onClick={() => setActiveInspector({ kind: "finding", id: finding.id })}
                >
                  <div className="rt-finding-card__head">
                    <span className="rt-pill">{finding.id}</span>
                    <span className="rt-badge rt-badge--info">{finding.severity}</span>
                  </div>
                  <strong>{finding.title}</strong>
                  <p>{finding.stats}</p>
                  <div className="rt-finding-card__body">
                    <span><Database size={14} /> {finding.sampleCount} samples</span>
                    <span><Sparkles size={14} /> {finding.synthesis}</span>
                    <span><AlertTriangle size={14} /> {finding.contradictingEvidence.length} contradiction groups</span>
                    <span><ShieldAlert size={14} /> {finding.limitation}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        <section className="rt-card rt-card--surface">
          <div className="rt-section-head">
            <div>
              <p className="rt-kicker">主题趋势</p>
              <h2>点击数据点可回到评论语料</h2>
            </div>
              <span className="rt-pill">代表性摘录</span>
          </div>
          <div className="rt-theme-trend">
            <div className="rt-trend-chart">
              {activeTheme.spark.map((value, index) => (
                <span key={index} style={{ height: `${value * 16}px` }} />
              ))}
            </div>
            <div className="rt-trend-copy">
              <strong>{activeTheme.name}</strong>
              <p>{activeTheme.summary}</p>
              <ul>
                {demoReviewRows.slice(0, 3).map((row) => (
                  <li key={row.id}>
                    <button type="button" className="rt-link-button" onClick={() => setActiveInspector({ kind: "review", id: row.id })}>
                      {row.id}
                    </button>
                    <span>{row.excerpt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderPrd() {
    return (
      <div className="rt-page">
        <div className="rt-page__lead">
          <div>
            <p className="rt-kicker">PRD 编辑器</p>
            <h1>PRD v1 草案</h1>
            <p className="rt-lead">由已验证发现生成，并保持可追溯到评论。</p>
          </div>
          <div className="rt-lead__status">
            <span className="rt-badge rt-badge--success">证据覆盖率 91%</span>
            <div className="rt-inline-actions">
              <button className="rt-button rt-button--ghost" type="button"><FileDown size={16} /> 导出 Markdown</button>
              <button className="rt-button rt-button--ghost" type="button"><Download size={16} /> 导出 JSON</button>
            </div>
          </div>
        </div>

        <div className="rt-grid rt-grid--prd">
          <aside className="rt-card rt-card--surface">
            <div className="rt-section-head">
              <div>
                <p className="rt-kicker">目录</p>
                <h2>文档章节</h2>
              </div>
            </div>
            <nav className="rt-outline">
              {["总览", "问题陈述", "目标", "非目标", "用户与场景", "需求", "版本计划", "风险与假设", "成功指标", "待解问题"].map((item) => (
                <button key={item} className="rt-outline__item" type="button">{item}</button>
              ))}
            </nav>
          </aside>

          <section className="rt-card rt-card--surface">
            <div className="rt-section-head">
              <div>
                <p className="rt-kicker">文档正文</p>
                <h2>可编辑叙述与证据徽标</h2>
              </div>
            </div>
            <article className="rt-prd-doc">
              <section>
                <strong>总览</strong>
                <p>ReviewTrace 会把应用评论转化为有证据链支撑的产品计划和可追溯测试套件。</p>
              </section>
              <section>
                <strong>问题陈述</strong>
                <textarea className="rt-textarea" defaultValue="用户在被推到付费前，并不清楚订阅价值和取消路径。" />
              </section>
              <section>
                <strong>目标</strong>
                <p>提升清晰度，减少意外，并让每条需求都能追溯到评论证据。</p>
              </section>
              <section>
                <strong>非目标</strong>
                <p>不要声称不存在的证据。没有显式标记时，不要把假设当成已验证事实。</p>
              </section>
              <section>
                <strong>版本计划</strong>
                <div className="rt-plan-row">
                  {demoOverview.versionPlan.map((item) => (
                    <div key={item.label} className="rt-plan-card">
                      <strong>{item.label}</strong>
                      <span>{item.note}</span>
                      <small>{item.count} 项</small>
                    </div>
                  ))}
                </div>
              </section>
            </article>
          </section>

          <section className="rt-card rt-card--surface">
            <div className="rt-section-head">
              <div>
                <p className="rt-kicker">需求</p>
                <h2>结构化需求在可编辑的同时保留来源链</h2>
              </div>
              <span className="rt-pill">REQ-004</span>
            </div>
            <div className="rt-requirement-list">
              {demoRequirements.map((requirement) => (
                <button
                  key={requirement.id}
                  className={`rt-requirement-card ${requirement.assumption ? "is-assumption" : ""}`}
                  type="button"
                  onClick={() => setActiveInspector({ kind: "requirement", id: requirement.id })}
                >
                  <div className="rt-requirement-card__head">
                    <strong>{requirement.id}</strong>
                    <span className="rt-pill">{requirement.priority}</span>
                  </div>
                  <p>{requirement.statement}</p>
                  <div className="rt-requirement-card__meta">
                    <span>{requirement.targetRelease}</span>
                    <span>{requirement.status}</span>
                    <span>{requirement.confidence}</span>
                  </div>
                  <ul>
                    {requirement.acceptanceCriteria.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  function renderTests() {
    const selected = demoTestCases[0];
    return (
      <div className="rt-page">
        <div className="rt-page__lead">
          <div>
            <p className="rt-kicker">测试用例</p>
            <h1>可追溯测试套件</h1>
            <p className="rt-lead">28 个测试用例 · 覆盖 12 条需求 · 证据关联测试 100%。</p>
          </div>
          <div className="rt-lead__status">
            <span className="rt-badge rt-badge--success">覆盖率 92%</span>
            <span className="rt-badge rt-badge--warning">3 个边界情况需审查</span>
          </div>
        </div>

        <section className="rt-card rt-card--surface">
          <table className="rt-table">
            <thead>
              <tr>
                <th>测试 ID</th>
                <th>标题</th>
                <th>类型</th>
                <th>优先级</th>
                <th>关联需求</th>
                <th>来源评论</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {demoTestCases.map((testCase) => (
                <tr key={testCase.id} className="rt-table-row">
                  <td>
                    <button className="rt-link-button" type="button" onClick={() => setActiveInspector({ kind: "test_case", id: testCase.id })}>{testCase.id}</button>
                  </td>
                  <td>{testCase.title}</td>
                  <td>{testCase.type}</td>
                  <td>{testCase.priority}</td>
                  <td>{testCase.requirementId}</td>
                  <td>{testCase.sourceReviews.join(", ")}</td>
                  <td>草案</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rt-card rt-card--surface">
          <div className="rt-section-head">
            <div>
              <p className="rt-kicker">详情视图</p>
              <h2>这个测试为什么存在</h2>
            </div>
            <span className="rt-pill">{selected.id}</span>
          </div>
          <article className="rt-detail-panel">
            <strong>{selected.title}</strong>
            <p>{selected.why}</p>
            <div className="rt-detail-grid">
              <div><span>前置条件</span><ul>{selected.preconditions.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div><span>步骤</span><ol>{selected.steps.map((item) => <li key={item}>{item}</li>)}</ol></div>
              <div><span>预期结果</span><p>{selected.expected}</p></div>
              <div><span>边界情况</span><ul>{selected.edgeCases.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>
          </article>
        </section>
      </div>
    );
  }

  function renderValidate() {
    return (
      <div className="rt-page">
        <div className="rt-page__lead">
          <div>
            <p className="rt-kicker">追溯验证</p>
            <h1>评论 → 发现 → 需求 → 测试用例</h1>
            <p className="rt-lead">默认显示矩阵视图，图谱视图可用但保持克制。</p>
          </div>
          <div className="rt-tabs">
            <button className={`rt-tab ${validateTab === "matrix" ? "is-active" : ""}`} type="button" onClick={() => setValidateTab("matrix")}>矩阵</button>
            <button className={`rt-tab ${validateTab === "graph" ? "is-active" : ""}`} type="button" onClick={() => setValidateTab("graph")}>图谱</button>
          </div>
        </div>

        <div className="rt-inline-metrics">
          <div className="rt-metric"><span>完全可追溯</span><strong>94%</strong><small>含 3 个显式假设</small></div>
          <div className="rt-metric"><span>无支撑发现</span><strong>2</strong><small>需要移除或标记为假设</small></div>
          <div className="rt-metric"><span>无测试需求</span><strong>1</strong><small>生成缺失测试</small></div>
          <div className="rt-metric"><span>冲突组</span><strong>4</strong><small>已审查，但未忽略</small></div>
        </div>

        {validateTab === "matrix" ? (
          <section className="rt-card rt-card--surface">
            <div className="rt-section-head">
              <div>
                <p className="rt-kicker">矩阵</p>
                <h2>每一行都是可折叠的追溯链</h2>
              </div>
              <span className="rt-pill">断链 / 警告 / 假设</span>
            </div>
            <div className="rt-validation-list">
              {demoValidationIssues.map((issue) => (
                <button
                  key={issue.id}
                  className={`rt-validation-card rt-validation-card--${validationStatusClass(issue.status)}`}
                  type="button"
                  onClick={() => setActiveInspector({ kind: "validation_issue", id: issue.id })}
                >
                  <div className="rt-validation-card__head">
                    <strong>{issue.id}</strong>
                    <span className="rt-pill">{issue.status}</span>
                  </div>
                  <p>{issue.title}</p>
                  <small>{issue.path} · {issue.reviewCount} 条评论</small>
                  <span>{issue.action}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="rt-card rt-card--surface">
            <div className="rt-section-head">
              <div>
                <p className="rt-kicker">图谱</p>
                <h2>节点颜色表示类型，连线表示有效、警告或断链</h2>
              </div>
              <span className="rt-pill">仅显示到所选测试的路径</span>
            </div>
            <div className="rt-graph">
              {["评论", "发现", "需求", "测试用例"].map((node, index) => (
                <div key={node} className="rt-graph__node">
                  <span>{index + 1}</span>
                  <strong>{node}</strong>
                </div>
              ))}
              <div className="rt-graph__edge">有效</div>
              <div className="rt-graph__edge rt-graph__edge--warning">警告</div>
            </div>
          </section>
        )}
      </div>
    );
  }

  function renderOverview() {
    return (
      <div className="rt-page">
        <div className="rt-page__lead">
          <div>
            <p className="rt-kicker">最终总览</p>
            <h1>决策摘要</h1>
            <p className="rt-lead">用户最困扰什么、哪些证据最强、哪些仍不确定，以及优先该做什么。</p>
          </div>
          <span className="rt-badge rt-badge--success">已验证，含显式假设</span>
        </div>

        <section className="rt-grid rt-grid--overview">
          {Object.entries(demoOverview.summary).map(([key, value]) => (
            <article key={key} className="rt-card rt-card--surface">
              <p className="rt-kicker">{key}</p>
              <strong>{value}</strong>
            </article>
          ))}
        </section>

        <section className="rt-card rt-card--surface">
          <div className="rt-section-head">
            <div>
              <p className="rt-kicker">版本计划</p>
              <h2>优先处理高置信度修复</h2>
            </div>
          </div>
          <div className="rt-plan-row">
            {demoOverview.versionPlan.map((item) => (
              <article key={item.label} className="rt-plan-card">
                <strong>{item.label}</strong>
                <span>{item.note}</span>
                <small>{item.count} 项</small>
              </article>
            ))}
          </div>
        </section>

        <section className="rt-card rt-card--surface">
          <div className="rt-section-head">
            <div>
              <p className="rt-kicker">交付物</p>
              <h2>所有交付物都带标签且可导出</h2>
            </div>
          </div>
          <div className="rt-deliverable-grid">
            {demoOverview.deliverables.map((item) => (
              <article key={item} className="rt-deliverable-card">
                <FolderOpen size={18} />
                <strong>{item}</strong>
                <span>已版本化 · 已更新 · 已验证</span>
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderReviewSummary(review: DemoReviewRow) {
    return (
      <div className="rt-detail-card">
        <div className="rt-detail-card__head">
          <strong>{review.id}</strong>
          <span className="rt-pill">{review.source}</span>
        </div>
        <p>{review.excerpt}</p>
        <div className="rt-detail-grid rt-detail-grid--compact">
          <div><span>评分</span><strong>{review.rating}★</strong></div>
          <div><span>日期</span><strong>{review.date}</strong></div>
          <div><span>版本</span><strong>{review.version}</strong></div>
          <div><span>地区</span><strong>{review.locale}</strong></div>
        </div>
        <div className="rt-mini-stack">
          <span>主题：{review.theme}</span>
          <span>证据用途：{review.evidenceUsed}</span>
          {review.duplicateOf ? <span className="rt-warning">重复于 {review.duplicateOf}</span> : null}
        </div>
      </div>
    );
  }

  function renderInspector() {
    if (activeInspector.kind === "app_preview") {
      return (
        <InspectorCard title="应用预览" subtitle="示例" icon={<AppIcon />}>
          <div className="rt-inspector-list">
            <div><span>名称</span><strong>{demoAppPreview.name}</strong></div>
            <div><span>开发者</span><strong>{demoAppPreview.developer}</strong></div>
            <div><span>分类</span><strong>{demoAppPreview.category}</strong></div>
            <div><span>版本</span><strong>{demoAppPreview.version}</strong></div>
            <div><span>评分</span><strong>{demoAppPreview.rating} ★</strong></div>
            <div><span>评论</span><strong>{demoAppPreview.reviews}</strong></div>
            <div><span>商店</span><strong>{demoAppPreview.storefront}</strong></div>
          </div>
          <p className="rt-note">{demoAppPreview.note}</p>
        </InspectorCard>
      );
    }

    if (activeInspector.kind === "run_health") {
      return (
        <InspectorCard title="运行健康" subtitle={inspectorHint} icon={<Gauge />}>
          <div className="rt-inspector-metrics">
            <div><span>数据完整度</span><strong>82%</strong></div>
            <div><span>证据覆盖率</span><strong>74%</strong></div>
            <div><span>追溯覆盖率</span><strong>0%</strong></div>
          </div>
          <div className="rt-mini-stack">
            <span>提供方：{currentProvider}</span>
            <span>来源：{currentSource}</span>
            <span>已知限制：限流、缓存示例兜底、假设门控。</span>
          </div>
        </InspectorCard>
      );
    }

    if (activeInspector.kind === "review") {
      const review = demoReviewRows.find((row) => row.id === activeInspector.id) ?? demoReviewRows[0];
      return <InspectorCard title="评论" subtitle={review.id} icon={<FolderOpen />}>{renderReviewSummary(review)}</InspectorCard>;
    }

    if (activeInspector.kind === "theme") {
      const theme = demoThemeCards.find((item) => item.id === activeInspector.id) ?? demoThemeCards[0];
      return (
        <InspectorCard title="主题" subtitle={theme.id} icon={<Sparkles />}>
          <div className="rt-inspector-list">
            <div><span>名称</span><strong>{theme.name}</strong></div>
            <div><span>置信度</span><strong>{theme.confidence}</strong></div>
            <div><span>评论</span><strong>{theme.reviews}</strong></div>
            <div><span>冲突</span><strong>{theme.conflicts}</strong></div>
          </div>
          <p>{theme.summary}</p>
          <div className="rt-sparkline rt-sparkline--mini">
            {theme.spark.map((value, index) => <span key={index} style={{ height: `${value * 8}px` }} />)}
          </div>
        </InspectorCard>
      );
    }

    if (activeInspector.kind === "finding") {
      const finding = demoFindingCards.find((item) => item.id === activeInspector.id) ?? demoFindingCards[0];
      return (
        <InspectorCard title="发现" subtitle={finding.id} icon={<Sparkles />}>
          <div className="rt-inspector-list">
            <div><span>严重度</span><strong>{finding.severity}</strong></div>
            <div><span>置信度</span><strong>{finding.confidence}</strong></div>
            <div><span>样本</span><strong>{finding.sampleCount}</strong></div>
          </div>
          <p>{finding.stats}</p>
          <p>{finding.synthesis}</p>
          <div className="rt-mini-stack">
            {finding.contradictingEvidence.map((item) => <span key={item} className="rt-warning">{item}</span>)}
            <span>{finding.limitation}</span>
          </div>
        </InspectorCard>
      );
    }

    if (activeInspector.kind === "requirement") {
      const req = demoRequirements.find((item) => item.id === activeInspector.id) ?? demoRequirements[0];
      return (
        <InspectorCard title="需求" subtitle={req.id} icon={<BookOpen />}>
          <div className="rt-inspector-list">
            <div><span>优先级</span><strong>{req.priority}</strong></div>
            <div><span>状态</span><strong>{req.status}</strong></div>
            <div><span>目标版本</span><strong>{req.targetRelease}</strong></div>
            <div><span>置信度</span><strong>{req.confidence}</strong></div>
          </div>
          <p>{req.statement}</p>
          <div className="rt-mini-stack">
            <span>来源发现：{req.sourceFindings.join(", ")}</span>
            <span>来源评论：{req.sourceReviews.join(", ")}</span>
            {req.assumption ? <span className="rt-warning">显式假设</span> : null}
          </div>
        </InspectorCard>
      );
    }

    if (activeInspector.kind === "test_case") {
      const testCase = demoTestCases.find((item) => item.id === activeInspector.id) ?? demoTestCases[0];
      return (
        <InspectorCard title="测试用例" subtitle={testCase.id} icon={<TestTube2 />}>
          <div className="rt-inspector-list">
            <div><span>类型</span><strong>{testCase.type}</strong></div>
            <div><span>优先级</span><strong>{testCase.priority}</strong></div>
            <div><span>需求</span><strong>{testCase.requirementId}</strong></div>
          </div>
          <p>{testCase.expected}</p>
          <div className="rt-mini-stack">
            <span>原因：{testCase.why}</span>
            <span>来源评论：{testCase.sourceReviews.join(", ")}</span>
          </div>
        </InspectorCard>
      );
    }

    if (activeInspector.kind === "validation_issue") {
      const issue = demoValidationIssues.find((item) => item.id === activeInspector.id) ?? demoValidationIssues[0];
      return (
        <InspectorCard title="验证" subtitle={issue.id} icon={<GitBranch />}>
          <div className="rt-inspector-list">
            <div><span>状态</span><strong>{issue.status}</strong></div>
            <div><span>评论</span><strong>{issue.reviewCount}</strong></div>
            <div><span>路径</span><strong>{issue.path}</strong></div>
          </div>
          <p>{issue.note}</p>
          <div className="rt-mini-stack">
            <span>动作：{issue.action}</span>
          </div>
        </InspectorCard>
      );
    }

    return (
      <InspectorCard title="总览" subtitle="决策摘要" icon={<Gauge />}>
        <div className="rt-mini-stack">
          <span>{demoOverview.summary.strongest}</span>
          <span>{demoOverview.summary.uncertain}</span>
          <span>{demoOverview.summary.buildV1}</span>
          <span>{demoOverview.summary.defer}</span>
        </div>
      </InspectorCard>
    );
  }

  return (
    <main className="rt-shell">
      <h1 className="rt-sr-only">ReviewTrace</h1>
      <aside className="rt-nav">
        <div className="rt-nav__brand">
          <div className="rt-nav__logo">
            <LayoutDashboard size={18} />
          </div>
          <div>
            <strong>ReviewTrace</strong>
            <span>证据优先工作台</span>
          </div>
          <button className="rt-nav__collapse" type="button" aria-label="折叠导航">
            <PanelLeft size={16} />
          </button>
        </div>

        <section className="rt-nav__section">
          <span className="rt-nav__heading">全局</span>
          {views.slice(0, 3).map((item) => (
            <button
              key={item.id}
              className={`rt-nav__item ${activeView === item.id ? "is-active" : ""}`}
              type="button"
              onClick={() => goToView(item.id)}
            >
              {item.icon}
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          ))}
        </section>

        <section className="rt-nav__section">
          <span className="rt-nav__heading">阶段</span>
          {stageNav.map((item) => (
            <button
              key={item.id}
              className={`rt-nav__item ${activeView === item.view ? "is-active" : ""}`}
              type="button"
              onClick={() => goToView(item.view)}
            >
              {stageIcon(demoStages.find((stage) => stage.id === item.id)?.status ?? "pending")}
              <span>
                <strong>{item.label}</strong>
                <small>{demoStages.find((stage) => stage.id === item.id)?.badge ?? "—"}</small>
              </span>
            </button>
          ))}
        </section>

        <section className="rt-nav__section">
          <span className="rt-nav__heading">交付物</span>
          {artifactNav.map((item) => (
            <button
              key={item.id}
              className={`rt-nav__item ${activeView === item.view ? "is-active" : ""}`}
              type="button"
              onClick={() => goToView(item.view)}
            >
              <Layers3 size={16} />
              <span>
                <strong>{item.label}</strong>
                <small>{views.find((view) => view.id === item.view)?.description}</small>
              </span>
            </button>
          ))}
        </section>
      </aside>

      <section className="rt-main">
        <header className="rt-topbar">
          <div className="rt-topbar__left">
            <div className="rt-topbar__app">
              <div className="rt-topbar__appicon">
                <Workflow size={18} />
              </div>
              <div>
                <strong>{demoApp.appName}</strong>
                <span>{views.find((item) => item.id === activeView)?.label ?? "ReviewTrace"}</span>
              </div>
            </div>
            <div className="rt-topbar__meta">
              <span className="rt-topbar__token">{demoApp.runId}</span>
              <span className={`rt-badge ${currentRunStatus === "运行中" ? "rt-badge--running" : currentRunStatus === "已验证" ? "rt-badge--success" : "rt-badge--warning"}`}>{currentRunStatus}</span>
              <span className="rt-topbar__token">{currentSource}</span>
              <span className="rt-topbar__token">{currentProvider}</span>
              <span className="rt-topbar__token">上次保存 {demoApp.lastSaved}</span>
            </div>
          </div>
          <div className="rt-topbar__actions">
            <button className="rt-button rt-button--ghost" type="button"><Download size={16} /> {demoApp.exportLabel}</button>
            <button className="rt-button rt-button--ghost" type="button"><MoreHorizontal size={16} /> 更多</button>
          </div>
        </header>

        <div className="rt-main__body">
          <div className="rt-content">
            {activeView === "new" && renderNewAnalysis()}
            {activeView === "run" && renderRunWorkspace()}
            {activeView === "reviews" && renderReviews()}
            {activeView === "findings" && renderFindings()}
            {activeView === "prd" && renderPrd()}
            {activeView === "tests" && renderTests()}
            {activeView === "validate" && renderValidate()}
            {activeView === "overview" && renderOverview()}
          </div>
          <aside className="rt-inspector">
            <div className="rt-inspector__head">
              <div>
                <p className="rt-kicker">证据检查器</p>
                <h2>{inspectorKindLabel(activeInspector.kind)}</h2>
              </div>
              <button className="rt-button rt-button--ghost" type="button"><PanelRight size={16} /></button>
            </div>
            {renderInspector()}
          </aside>
        </div>
      </section>
    </main>
  );
}

function AppIcon() {
  return (
    <div className="rt-app-icon">
      <span />
      <span />
      <span />
    </div>
  );
}

function InspectorCard({
  title,
  subtitle,
  icon,
  children,
}: {
  children: ReactNode;
  icon: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="rt-inspector-card">
      <div className="rt-inspector-card__head">
        <div className="rt-inspector-card__icon">{icon}</div>
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      </div>
      {children}
    </section>
  );
}
