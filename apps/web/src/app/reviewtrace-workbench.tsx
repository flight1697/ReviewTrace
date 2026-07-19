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
  { id: "new", label: "New analysis", description: "Start a new evidence-backed analysis", icon: <LayoutDashboard size={16} /> },
  { id: "run", label: "Run workspace", description: "Watch stages run with trace detail", icon: <Workflow size={16} /> },
  { id: "reviews", label: "Reviews", description: "Raw and clean review corpus", icon: <FolderOpen size={16} /> },
  { id: "findings", label: "Themes & findings", description: "Dynamic themes and evidence-backed findings", icon: <Sparkles size={16} /> },
  { id: "prd", label: "PRD", description: "Structured requirements and document draft", icon: <BookOpen size={16} /> },
  { id: "tests", label: "Test cases", description: "Traceable test suite", icon: <TestTube2 size={16} /> },
  { id: "validate", label: "Validate", description: "Traceability matrix and graph", icon: <GitBranch size={16} /> },
  { id: "overview", label: "Overview", description: "Decision summary and deliverables", icon: <Gauge size={16} /> },
];

const stageNav = [
  { id: "scope", label: "1 Scope", view: "run" as DemoView },
  { id: "collect", label: "2 Collect", view: "run" as DemoView },
  { id: "clean", label: "3 Clean", view: "run" as DemoView },
  { id: "analyze", label: "4 Analyze", view: "run" as DemoView },
  { id: "evidence", label: "5 Evidence", view: "findings" as DemoView },
  { id: "prd", label: "6 PRD", view: "prd" as DemoView },
  { id: "tests", label: "7 Test cases", view: "tests" as DemoView },
  { id: "validate", label: "8 Validate", view: "validate" as DemoView },
];

const artifactNav = [
  { id: "reviews", label: "Raw reviews", view: "reviews" as DemoView },
  { id: "findings", label: "Theme map", view: "findings" as DemoView },
  { id: "prd", label: "PRD v1", view: "prd" as DemoView },
  { id: "tests", label: "Test suite", view: "tests" as DemoView },
  { id: "validate", label: "Trace matrix", view: "validate" as DemoView },
  { id: "overview", label: "Deliverables", view: "overview" as DemoView },
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
  if (kind === "run_health") return "Run health";
  if (kind === "app_preview") return "App preview";
  if (kind === "review") return "Review";
  if (kind === "theme") return "Theme";
  if (kind === "finding") return "Finding";
  if (kind === "requirement") return "Requirement";
  if (kind === "test_case") return "Test case";
  if (kind === "validation_issue") return "Validation";
  return "Overview";
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
  const [inspectorHint, setInspectorHint] = useState("Sample");

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
    status === "running" ? "Running" : run ? "Validated" : status === "failed" ? "Needs attention" : "Demo ready";

  const currentSource =
    run?.source.label ??
    (sourceMode === "import"
      ? "Imported CSV"
      : sourceMode === "fixture"
        ? "Cached sample"
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
      setInspectorHint("Live");
    }
  }, [requestedStart, run]);

  function goToView(view: DemoView) {
    setActiveView(view);
    setActiveInspector(defaultInspectorMap[view]);
    setInspectorHint("Sample");
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
    setInspectorHint("Import");
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
      setInspectorHint("Import");
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
            <p className="rt-kicker">New analysis</p>
            <h1>Start an evidence-backed analysis</h1>
            <p className="rt-lead">
              Give ReviewTrace an App Store link or a review dataset. Add a goal so the analysis optimizes for the decision you actually need to make.
            </p>
          </div>
          <div className="rt-lead__status">
            <span className="rt-badge rt-badge--success">Sample / Cached / Live</span>
            <span className="rt-subtle">Review availability may vary by storefront and rate limits.</span>
          </div>
        </div>

        <div className="rt-segmented">
          <button
            className={`rt-segmented__button ${sourceMode !== "import" ? "is-active" : ""}`}
            type="button"
            onClick={() => setSourceMode("live")}
          >
            App Store link
          </button>
          <button
            className={`rt-segmented__button ${sourceMode === "import" ? "is-active" : ""}`}
            type="button"
            onClick={() => setSourceMode("import")}
          >
            Import JSON / CSV
          </button>
        </div>

        <div className="rt-grid rt-grid--two">
          <section className={`rt-card rt-card--surface ${sourceMode === "import" ? "rt-card--dimmed" : ""}`}>
            <div className="rt-section-head">
              <div>
                <p className="rt-kicker">A. App Store link</p>
                <h2>Paste a valid U.S. App Store URL</h2>
              </div>
              <span className="rt-pill">Pre-filled demo</span>
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
                  <span>{demoAppPreview.reviews} reviews</span>
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
                <p className="rt-kicker">B. Import JSON / CSV</p>
                <h2>Drop a review dataset or upload a file</h2>
              </div>
              <a className="rt-link" href={`data:text/plain;charset=utf-8,${encodeURIComponent(schemaExampleJson)}`} download="reviewtrace-schema-example.json">
                Download schema example
              </a>
            </div>

            <div
              className={`rt-dropzone ${sourceMode === "import" ? "is-active" : ""}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDropFile}
            >
              <Upload size={22} />
              <strong>Drag JSON / CSV here</strong>
              <span>Supports review_id, rating, text, date, locale, version.</span>
              <label className="rt-button rt-button--ghost">
                Choose file
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
                <span className="rt-mini-label">Selected file</span>
                <strong>{importFileName || "No file selected"}</strong>
              </div>
              <div>
                <span className="rt-mini-label">Rows previewed</span>
                <strong>{importText ? "5 rows" : "0 rows"}</strong>
              </div>
              <div>
                <span className="rt-mini-label">Data source</span>
                <strong>{sourceMode === "import" ? "Imported" : "Sample"}</strong>
              </div>
            </div>

            <div className="rt-code-sample">
              <div className="rt-code-sample__head">
                <span>Field mapping</span>
                <span>First 5 rows preview</span>
              </div>
              <pre>{schemaExampleCsv}</pre>
            </div>
          </section>
        </div>

        <section className="rt-card rt-card--surface">
          <div className="rt-section-head">
            <div>
              <p className="rt-kicker">Analysis goal</p>
              <h2>Add a goal so the analysis optimizes for the right decision</h2>
            </div>
            <span className="rt-pill">4–6 lines recommended</span>
          </div>
          <textarea
            aria-label="分析目标"
            className="rt-textarea rt-textarea--goal"
            value={analysisGoal}
            onChange={(event) => setAnalysisGoal(event.target.value)}
            placeholder="Focus on subscription conversion, workout usability, app version 7.2, and low-rating reviews. Surface conflicting feedback and avoid conclusions supported by fewer than 3 independent reviews."
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
              <p className="rt-kicker">Scope & limits</p>
              <h2>Transparent controls for rating, versions, languages, and thresholds</h2>
            </div>
            <span className="rt-pill">Collapsible</span>
          </div>
          <div className="rt-limit-grid">
            {demoScopeLimits.map((item) => (
              <div key={item} className="rt-limit-item">
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="rt-inline-metrics">
            <div><strong>Model selector</strong><span>GPT-5 · OpenAI</span></div>
            <div><strong>Rules</strong><span>Deterministic + LLM stages</span></div>
            <div><strong>Fallback</strong><span>Include cached sample if collection fails</span></div>
          </div>
        </section>

        <footer className="rt-action-bar">
          <div>
            <span className="rt-mini-label">Estimated flow</span>
            <strong>8 stages · about 3 minutes on a live dataset</strong>
          </div>
          <div className="rt-action-bar__buttons">
            <button className="rt-button rt-button--secondary" type="button">
              Save as draft
            </button>
            <button
              className="rt-button rt-button--primary"
              type="button"
              onClick={handleStartAnalysis}
              disabled={status === "running"}
            >
              {status === "running" ? <Loader2 className="rt-spin" size={16} /> : <Play size={16} />}
              Start analysis
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
      : "Demo workspace · 4 of 8 stages shown. Start analysis to watch a live run and inspect evidence.";

    return (
      <div className="rt-page">
        <div className="rt-page__lead">
          <div>
            <p className="rt-kicker">Run workspace</p>
            <h1>{run ? "Watch the live run" : "Traceable execution in a single view"}</h1>
            <p className="rt-lead">{progressCopy}</p>
          </div>
          <div className="rt-lead__status">
            <span className={`rt-badge ${status === "running" ? "rt-badge--running" : run ? "rt-badge--success" : "rt-badge--warning"}`}>
              {currentRunStatus}
            </span>
            <span className="rt-subtle">Run ID {currentRunId}</span>
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
              <p className="rt-kicker">Trace timeline</p>
              <h2>Expandable rows expose method type, inputs, outputs, token, and warnings</h2>
            </div>
            <span className="rt-pill">Deterministic / Model-generated</span>
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
                      <span>{demoStage?.method ?? "Deterministic"} · {demoStage?.summary ?? "Pending"}</span>
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
                      <span className="rt-mini-label">Summary</span>
                      <p>{demoStage?.summary}</p>
                    </div>
                    <div className="rt-trace-grid">
                      <div><strong>Inputs</strong><span>{demoStage?.input}</span></div>
                      <div><strong>Outputs</strong><span>{demoStage?.output}</span></div>
                      <div><strong>Warnings</strong><span>{demoStage?.badge}</span></div>
                      <div><strong>Tokens</strong><span>{demoStage?.tokens}</span></div>
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
              <p className="rt-kicker">Stage report</p>
              <h2>Every report keeps revisions, failures, and notes visible</h2>
            </div>
            <span className="rt-pill">{stageReports.length || demoStages.length} reports</span>
          </div>
          <div className="rt-report-grid">
            {(stageReports.length ? stageReports : demoStages.slice(0, 4).map((stage, index) => ({
              name: stage.id,
              status: stage.status,
              summary: stage.summary,
              details: [stage.input, stage.output],
              revisions: index === 1 ? ["Rate limited live data; used cached sample as fallback."] : ["Deterministic step."] ,
              errors: stage.status === "warning" ? ["Needs attention"] : [],
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
              <strong>Stage failed, but the flow stays honest about it.</strong>
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
            <p className="rt-kicker">Review corpus</p>
            <h1>Raw and clean reviews</h1>
            <p className="rt-lead">1,284 raw → 1,182 clean. Search, filter, and open any row in the inspector.</p>
          </div>
          <div className="rt-tabs">
            <button className={`rt-tab ${reviewTab === "raw" ? "is-active" : ""}`} type="button" onClick={() => setReviewTab("raw")}>Raw reviews</button>
            <button className={`rt-tab ${reviewTab === "clean" ? "is-active" : ""}`} type="button" onClick={() => setReviewTab("clean")}>Clean dataset</button>
          </div>
        </div>

        <div className="rt-filter-bar">
          <button className="rt-chip rt-chip--soft" type="button"><Search size={14} /> Search</button>
          <button className="rt-chip rt-chip--soft" type="button"><Filter size={14} /> Rating</button>
          <button className="rt-chip rt-chip--soft" type="button"><CalendarRange size={14} /> Date</button>
          <button className="rt-chip rt-chip--soft" type="button"><Layers3 size={14} /> Version</button>
          <button className="rt-chip rt-chip--soft" type="button"><ClipboardCheck size={14} /> Duplicate</button>
        </div>

        <section className="rt-card rt-card--surface">
          <table className="rt-table">
            <thead>
              <tr>
                <th>Review ID</th>
                <th>Rating</th>
                <th>Date</th>
                <th>Version</th>
                <th>Locale</th>
                <th>Excerpt</th>
                <th>Theme</th>
                <th>Sentiment</th>
                <th>Evidence used</th>
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
              <p className="rt-kicker">Selected review</p>
              <h2>Lineage, source label, and duplicate state stay visible</h2>
            </div>
            <span className="rt-pill">Click any row</span>
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
            <p className="rt-kicker">Themes & findings</p>
            <h1>Dynamic themes and evidence-backed findings</h1>
            <p className="rt-lead">Themes are not fixed keywords. Findings carry stats, synthesis, contradictions, and assumptions.</p>
          </div>
          <div className="rt-tabs">
            <button className={`rt-tab ${findingsTab === "themes" ? "is-active" : ""}`} type="button" onClick={() => setFindingsTab("themes")}>Themes</button>
            <button className={`rt-tab ${findingsTab === "findings" ? "is-active" : ""}`} type="button" onClick={() => setFindingsTab("findings")}>Findings</button>
          </div>
        </div>

        <div className="rt-grid rt-grid--findings">
          <section className="rt-card rt-card--surface">
            <div className="rt-section-head">
              <div>
                <p className="rt-kicker">Themes</p>
                <h2>Theme cards surface support, confidence, trend, and conflicts</h2>
              </div>
              <span className="rt-pill">High / Medium / Low</span>
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
                    <span>{theme.reviews} reviews · {theme.share}</span>
                    <span>{theme.avgRating} avg rating · {theme.trend}</span>
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
                <p className="rt-kicker">Findings</p>
                <h2>Evidence-backed finding cards separate stats, synthesis, conflicts, and assumptions</h2>
              </div>
              <span className="rt-pill">Promote to requirement</span>
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
              <p className="rt-kicker">Theme trend</p>
              <h2>Click a data point to return to the review corpus</h2>
            </div>
            <span className="rt-pill">Representative excerpts</span>
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
            <p className="rt-kicker">PRD editor</p>
            <h1>PRD v1 Draft</h1>
            <p className="rt-lead">Generated from validated findings and kept traceable back to reviews.</p>
          </div>
          <div className="rt-lead__status">
            <span className="rt-badge rt-badge--success">Evidence coverage 91%</span>
            <div className="rt-inline-actions">
              <button className="rt-button rt-button--ghost" type="button"><FileDown size={16} /> Export Markdown</button>
              <button className="rt-button rt-button--ghost" type="button"><Download size={16} /> Export JSON</button>
            </div>
          </div>
        </div>

        <div className="rt-grid rt-grid--prd">
          <aside className="rt-card rt-card--surface">
            <div className="rt-section-head">
              <div>
                <p className="rt-kicker">Outline</p>
                <h2>Document sections</h2>
              </div>
            </div>
            <nav className="rt-outline">
              {["Overview", "Problem statement", "Goals", "Non-goals", "Users & scenarios", "Requirements", "Version plan", "Risks & assumptions", "Success metrics", "Open questions"].map((item) => (
                <button key={item} className="rt-outline__item" type="button">{item}</button>
              ))}
            </nav>
          </aside>

          <section className="rt-card rt-card--surface">
            <div className="rt-section-head">
              <div>
                <p className="rt-kicker">Document body</p>
                <h2>Editable narrative with evidence badges</h2>
              </div>
            </div>
            <article className="rt-prd-doc">
              <section>
                <strong>Overview</strong>
                <p>ReviewTrace turns app reviews into an evidence-backed product plan and traceable test suite.</p>
              </section>
              <section>
                <strong>Problem statement</strong>
                <textarea className="rt-textarea" defaultValue="Users do not understand subscription value and cancellation paths before they are pushed into payment." />
              </section>
              <section>
                <strong>Goals</strong>
                <p>Improve clarity, reduce surprise, and keep every requirement traceable to review evidence.</p>
              </section>
              <section>
                <strong>Non-goals</strong>
                <p>Do not claim evidence that is not present. Do not validate assumptions without explicit markers.</p>
              </section>
              <section>
                <strong>Version plan</strong>
                <div className="rt-plan-row">
                  {demoOverview.versionPlan.map((item) => (
                    <div key={item.label} className="rt-plan-card">
                      <strong>{item.label}</strong>
                      <span>{item.note}</span>
                      <small>{item.count} items</small>
                    </div>
                  ))}
                </div>
              </section>
            </article>
          </section>

          <section className="rt-card rt-card--surface">
            <div className="rt-section-head">
              <div>
                <p className="rt-kicker">Requirements</p>
                <h2>Structure keeps lineage intact while drafts remain editable</h2>
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
            <p className="rt-kicker">Test cases</p>
            <h1>Traceable test suite</h1>
            <p className="rt-lead">28 test cases · 12 requirements covered · Evidence-linked tests 100%.</p>
          </div>
          <div className="rt-lead__status">
            <span className="rt-badge rt-badge--success">Coverage 92%</span>
            <span className="rt-badge rt-badge--warning">3 edge cases need review</span>
          </div>
        </div>

        <section className="rt-card rt-card--surface">
          <table className="rt-table">
            <thead>
              <tr>
                <th>Test ID</th>
                <th>Title</th>
                <th>Type</th>
                <th>Priority</th>
                <th>Linked requirement</th>
                <th>Source reviews</th>
                <th>Status</th>
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
                  <td>Draft</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rt-card rt-card--surface">
          <div className="rt-section-head">
            <div>
              <p className="rt-kicker">Detail view</p>
              <h2>Why this test exists</h2>
            </div>
            <span className="rt-pill">{selected.id}</span>
          </div>
          <article className="rt-detail-panel">
            <strong>{selected.title}</strong>
            <p>{selected.why}</p>
            <div className="rt-detail-grid">
              <div><span>Preconditions</span><ul>{selected.preconditions.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div><span>Steps</span><ol>{selected.steps.map((item) => <li key={item}>{item}</li>)}</ol></div>
              <div><span>Expected</span><p>{selected.expected}</p></div>
              <div><span>Edge cases</span><ul>{selected.edgeCases.map((item) => <li key={item}>{item}</li>)}</ul></div>
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
            <p className="rt-kicker">Traceability validation</p>
            <h1>Review → Finding → Requirement → Test case</h1>
            <p className="rt-lead">Matrix is default. Graph is available, but deliberately restrained.</p>
          </div>
          <div className="rt-tabs">
            <button className={`rt-tab ${validateTab === "matrix" ? "is-active" : ""}`} type="button" onClick={() => setValidateTab("matrix")}>Matrix</button>
            <button className={`rt-tab ${validateTab === "graph" ? "is-active" : ""}`} type="button" onClick={() => setValidateTab("graph")}>Graph</button>
          </div>
        </div>

        <div className="rt-inline-metrics">
          <div className="rt-metric"><span>Fully traceable</span><strong>94%</strong><small>Validated with 3 explicit assumptions</small></div>
          <div className="rt-metric"><span>Unsupported findings</span><strong>2</strong><small>Need to be removed or marked as assumptions</small></div>
          <div className="rt-metric"><span>Requirements without tests</span><strong>1</strong><small>Generate missing test</small></div>
          <div className="rt-metric"><span>Contradictory groups</span><strong>4</strong><small>Reviewed but not ignored</small></div>
        </div>

        {validateTab === "matrix" ? (
          <section className="rt-card rt-card--surface">
            <div className="rt-section-head">
              <div>
                <p className="rt-kicker">Matrix</p>
                <h2>Each row is a collapsible trace chain</h2>
              </div>
              <span className="rt-pill">Broken links / warnings / assumptions</span>
            </div>
            <div className="rt-validation-list">
              {demoValidationIssues.map((issue) => (
                <button
                  key={issue.id}
                  className={`rt-validation-card rt-validation-card--${issue.status.toLowerCase()}`}
                  type="button"
                  onClick={() => setActiveInspector({ kind: "validation_issue", id: issue.id })}
                >
                  <div className="rt-validation-card__head">
                    <strong>{issue.id}</strong>
                    <span className="rt-pill">{issue.status}</span>
                  </div>
                  <p>{issue.title}</p>
                  <small>{issue.path} · {issue.reviewCount} reviews</small>
                  <span>{issue.action}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="rt-card rt-card--surface">
            <div className="rt-section-head">
              <div>
                <p className="rt-kicker">Graph</p>
                <h2>Node colors represent type; edges represent valid, warning, or broken</h2>
              </div>
              <span className="rt-pill">Show only path to selected test</span>
            </div>
            <div className="rt-graph">
              {["Review", "Finding", "Requirement", "Test case"].map((node, index) => (
                <div key={node} className="rt-graph__node">
                  <span>{index + 1}</span>
                  <strong>{node}</strong>
                </div>
              ))}
              <div className="rt-graph__edge">valid</div>
              <div className="rt-graph__edge rt-graph__edge--warning">warning</div>
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
            <p className="rt-kicker">Final overview</p>
            <h1>Decision summary</h1>
            <p className="rt-lead">What users struggle with, what evidence is strongest, what remains uncertain, and what to build first.</p>
          </div>
          <span className="rt-badge rt-badge--success">Validated with assumptions</span>
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
              <p className="rt-kicker">Version plan</p>
              <h2>Prioritize highest-confidence fixes first</h2>
            </div>
          </div>
          <div className="rt-plan-row">
            {demoOverview.versionPlan.map((item) => (
              <article key={item.label} className="rt-plan-card">
                <strong>{item.label}</strong>
                <span>{item.note}</span>
                <small>{item.count} items</small>
              </article>
            ))}
          </div>
        </section>

        <section className="rt-card rt-card--surface">
          <div className="rt-section-head">
            <div>
              <p className="rt-kicker">Deliverables</p>
              <h2>Everything stays labeled and exportable</h2>
            </div>
          </div>
          <div className="rt-deliverable-grid">
            {demoOverview.deliverables.map((item) => (
              <article key={item} className="rt-deliverable-card">
                <FolderOpen size={18} />
                <strong>{item}</strong>
                <span>Versioned · Updated · Verified</span>
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
          <div><span>Rating</span><strong>{review.rating}★</strong></div>
          <div><span>Date</span><strong>{review.date}</strong></div>
          <div><span>Version</span><strong>{review.version}</strong></div>
          <div><span>Locale</span><strong>{review.locale}</strong></div>
        </div>
        <div className="rt-mini-stack">
          <span>Theme: {review.theme}</span>
          <span>Evidence used: {review.evidenceUsed}</span>
          {review.duplicateOf ? <span className="rt-warning">Duplicate of {review.duplicateOf}</span> : null}
        </div>
      </div>
    );
  }

  function renderInspector() {
    if (activeInspector.kind === "app_preview") {
      return (
        <InspectorCard title="App preview" subtitle="Sample" icon={<AppIcon />}>
          <div className="rt-inspector-list">
            <div><span>Name</span><strong>{demoAppPreview.name}</strong></div>
            <div><span>Developer</span><strong>{demoAppPreview.developer}</strong></div>
            <div><span>Category</span><strong>{demoAppPreview.category}</strong></div>
            <div><span>Version</span><strong>{demoAppPreview.version}</strong></div>
            <div><span>Rating</span><strong>{demoAppPreview.rating} ★</strong></div>
            <div><span>Reviews</span><strong>{demoAppPreview.reviews}</strong></div>
            <div><span>Storefront</span><strong>{demoAppPreview.storefront}</strong></div>
          </div>
          <p className="rt-note">{demoAppPreview.note}</p>
        </InspectorCard>
      );
    }

    if (activeInspector.kind === "run_health") {
      return (
        <InspectorCard title="Run health" subtitle={inspectorHint} icon={<Gauge />}>
          <div className="rt-inspector-metrics">
            <div><span>Data completeness</span><strong>82%</strong></div>
            <div><span>Evidence coverage</span><strong>74%</strong></div>
            <div><span>Traceability coverage</span><strong>0%</strong></div>
          </div>
          <div className="rt-mini-stack">
            <span>Provider: {currentProvider}</span>
            <span>Source: {currentSource}</span>
            <span>Known limitations: rate limits, cached sample fallback, assumption gating.</span>
          </div>
        </InspectorCard>
      );
    }

    if (activeInspector.kind === "review") {
      const review = demoReviewRows.find((row) => row.id === activeInspector.id) ?? demoReviewRows[0];
      return <InspectorCard title="Review" subtitle={review.id} icon={<FolderOpen />}>{renderReviewSummary(review)}</InspectorCard>;
    }

    if (activeInspector.kind === "theme") {
      const theme = demoThemeCards.find((item) => item.id === activeInspector.id) ?? demoThemeCards[0];
      return (
        <InspectorCard title="Theme" subtitle={theme.id} icon={<Sparkles />}>
          <div className="rt-inspector-list">
            <div><span>Name</span><strong>{theme.name}</strong></div>
            <div><span>Confidence</span><strong>{theme.confidence}</strong></div>
            <div><span>Reviews</span><strong>{theme.reviews}</strong></div>
            <div><span>Conflicts</span><strong>{theme.conflicts}</strong></div>
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
        <InspectorCard title="Finding" subtitle={finding.id} icon={<Sparkles />}>
          <div className="rt-inspector-list">
            <div><span>Severity</span><strong>{finding.severity}</strong></div>
            <div><span>Confidence</span><strong>{finding.confidence}</strong></div>
            <div><span>Samples</span><strong>{finding.sampleCount}</strong></div>
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
        <InspectorCard title="Requirement" subtitle={req.id} icon={<BookOpen />}>
          <div className="rt-inspector-list">
            <div><span>Priority</span><strong>{req.priority}</strong></div>
            <div><span>Status</span><strong>{req.status}</strong></div>
            <div><span>Target</span><strong>{req.targetRelease}</strong></div>
            <div><span>Confidence</span><strong>{req.confidence}</strong></div>
          </div>
          <p>{req.statement}</p>
          <div className="rt-mini-stack">
            <span>Source findings: {req.sourceFindings.join(", ")}</span>
            <span>Source reviews: {req.sourceReviews.join(", ")}</span>
            {req.assumption ? <span className="rt-warning">Explicit assumption</span> : null}
          </div>
        </InspectorCard>
      );
    }

    if (activeInspector.kind === "test_case") {
      const testCase = demoTestCases.find((item) => item.id === activeInspector.id) ?? demoTestCases[0];
      return (
        <InspectorCard title="Test case" subtitle={testCase.id} icon={<TestTube2 />}>
          <div className="rt-inspector-list">
            <div><span>Type</span><strong>{testCase.type}</strong></div>
            <div><span>Priority</span><strong>{testCase.priority}</strong></div>
            <div><span>Requirement</span><strong>{testCase.requirementId}</strong></div>
          </div>
          <p>{testCase.expected}</p>
          <div className="rt-mini-stack">
            <span>Why: {testCase.why}</span>
            <span>Source reviews: {testCase.sourceReviews.join(", ")}</span>
          </div>
        </InspectorCard>
      );
    }

    if (activeInspector.kind === "validation_issue") {
      const issue = demoValidationIssues.find((item) => item.id === activeInspector.id) ?? demoValidationIssues[0];
      return (
        <InspectorCard title="Validation" subtitle={issue.id} icon={<GitBranch />}>
          <div className="rt-inspector-list">
            <div><span>Status</span><strong>{issue.status}</strong></div>
            <div><span>Reviews</span><strong>{issue.reviewCount}</strong></div>
            <div><span>Path</span><strong>{issue.path}</strong></div>
          </div>
          <p>{issue.note}</p>
          <div className="rt-mini-stack">
            <span>Action: {issue.action}</span>
          </div>
        </InspectorCard>
      );
    }

    return (
      <InspectorCard title="Overview" subtitle="Decision summary" icon={<Gauge />}>
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
            <span>Evidence-first workbench</span>
          </div>
          <button className="rt-nav__collapse" type="button" aria-label="Collapse navigation">
            <PanelLeft size={16} />
          </button>
        </div>

        <section className="rt-nav__section">
          <span className="rt-nav__heading">Global</span>
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
          <span className="rt-nav__heading">Stages</span>
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
          <span className="rt-nav__heading">Artifacts</span>
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
              <span className={`rt-badge ${currentRunStatus === "Running" ? "rt-badge--running" : currentRunStatus === "Validated" ? "rt-badge--success" : "rt-badge--warning"}`}>{currentRunStatus}</span>
              <span className="rt-topbar__token">{currentSource}</span>
              <span className="rt-topbar__token">{currentProvider}</span>
              <span className="rt-topbar__token">Last saved {demoApp.lastSaved}</span>
            </div>
          </div>
          <div className="rt-topbar__actions">
            <button className="rt-button rt-button--ghost" type="button"><Download size={16} /> {demoApp.exportLabel}</button>
            <button className="rt-button rt-button--ghost" type="button"><MoreHorizontal size={16} /> More</button>
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
                <p className="rt-kicker">Evidence inspector</p>
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
