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
} from "./workflow";
import {
  demoFindingCards,
  demoGoalChips,
  demoRequirements,
  demoReviewRows,
  demoScopeLimits,
  demoStages,
  demoTestCases,
  demoValidationIssues,
  schemaExampleCsv,
  schemaExampleJson,
  type DemoInspectorKind,
  type DemoReviewRow,
  type DemoView,
} from "./reviewtrace-demo";
import {
  buildWorkbenchModel,
  workflowStageIdForNav,
} from "./workbench-view-model";

type SourceMode = "live" | "fixture" | "import";
type ReviewTab = "raw" | "clean";
type ReviewDuplicateFilter = "all" | "only" | "hide";
type ReviewRatingFilter = "all" | "low" | "mid" | "high";
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

const prdOutline = [
  { id: "overview", label: "总览" },
  { id: "problem", label: "问题陈述" },
  { id: "goals", label: "目标" },
  { id: "non-goals", label: "非目标" },
  { id: "versions", label: "版本计划" },
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
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewRatingFilter, setReviewRatingFilter] =
    useState<ReviewRatingFilter>("all");
  const [reviewDuplicateFilter, setReviewDuplicateFilter] =
    useState<ReviewDuplicateFilter>("all");
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [activeStageId, setActiveStageId] = useState(stageNav[0].id);
  const [activePrdSection, setActivePrdSection] = useState(prdOutline[0].id);
  const [scopeExpanded, setScopeExpanded] = useState(true);

  const { error, failWorkflow, progressStages, requestWorkflow, run, stageReports, status } =
    useWorkflowRun();
  const modelStatus = useModelStatus();

  const currentTimelineStages = useMemo(() => {
    const workflowStages = run?.stages.length ? run.stages : progressStages;
    if (workflowStages.length) {
      return workflowStages.map((stage) => ({
        id: stage.name,
        label: workflowStageLabel(stage.name),
        status: stage.status,
      }));
    }

    return demoStages.map((stage) => ({
      id: workflowStageIdForNav(stage.id),
      label: stage.label,
      status: stage.status,
    }));
  }, [progressStages, run]);

  const currentRunStatus =
    status === "running"
      ? "运行中"
      : run
        ? run.traceabilityValidation.status === "passed"
          ? "已验证"
          : "需要关注"
        : status === "failed"
          ? "需要关注"
          : "演示就绪";

  const currentSource =
    run?.source.label ??
    (sourceMode === "import"
      ? importFileName || "等待导入"
      : sourceMode === "fixture"
        ? "缓存示例数据集"
        : "App Store API");

  const currentRunId = run?.runId ?? "尚未运行";
  const currentProvider =
    run
      ? `${run.analysisSummary.provider} · ${run.analysisSummary.model}`
      : modelStatus?.provider && modelStatus?.model
      ? `${modelStatus.provider} · ${modelStatus.model}`
      : "等待后端状态";
  const workbenchModel = useMemo(() => buildWorkbenchModel(run), [run]);
  const {
    cleanReviewRows,
    findingCards,
    overview,
    rawReviewRows,
    requirementCards,
    summaryMetrics,
    testCaseCards,
    themeCards,
    validationIssues,
  } = workbenchModel;
  const effectiveStageReports = stageReports.length
    ? stageReports
    : run?.stageReports ?? [];
  const importPreview = useMemo(
    () => previewImportedDataset(importText, importFileName),
    [importFileName, importText],
  );
  const importRowCount = useMemo(
    () => countImportedRows(importText, importFileName),
    [importFileName, importText],
  );
  const sourceLabel =
    sourceMode === "import"
      ? importFileName || "导入数据集"
      : sourceMode === "fixture"
        ? "缓存示例数据集"
        : "U.S. App Store";

  useEffect(() => {
    setValidationAttempted(false);
  }, [appStoreLink]);

  useEffect(() => {
    try {
      const savedDraft = window.localStorage.getItem("reviewtrace-draft");
      if (!savedDraft) {
        return;
      }

      const parsed = JSON.parse(savedDraft) as Partial<{
        analysisGoal: string;
        appStoreLink: string;
        sourceMode: SourceMode;
        savedAt: string;
      }>;
      if (typeof parsed.appStoreLink === "string") {
        setAppStoreLink(parsed.appStoreLink);
      }
      if (typeof parsed.analysisGoal === "string") {
        setAnalysisGoal(parsed.analysisGoal);
      }
      if (
        parsed.sourceMode === "live" ||
        parsed.sourceMode === "fixture" ||
        parsed.sourceMode === "import"
      ) {
        setSourceMode(parsed.sourceMode);
      }
      if (typeof parsed.savedAt === "string") {
        setDraftSavedAt(parsed.savedAt);
      }
    } catch {
      window.localStorage.removeItem("reviewtrace-draft");
    }
  }, []);

  useEffect(() => {
    if (run && requestedStart) {
      setActiveView("run");
      openInspector(defaultInspectorMap.run, { revealOnMobile: false });
      setRequestedStart(false);
      setInspectorHint("实时");
    }
  }, [requestedStart, run]);

  function goToView(view: DemoView) {
    setActiveView(view);
    setActiveInspector(defaultInspectorSelection(view));
    setInspectorHint(run ? "实时" : "示例");
    setMobileNavOpen(false);
    setMobileInspectorOpen(false);
    if (view === "run") {
      setActiveStageId(stageNav[0].id);
    }
  }

  function goToStage(stage: (typeof stageNav)[number]) {
    setActiveStageId(stage.id);
    setActiveView(stage.view);
    setInspectorHint(run ? "实时" : "示例");
    setMobileNavOpen(false);
    if (stage.view === "run") {
      openInspector(defaultInspectorMap.run, { revealOnMobile: false });
      return;
    }
    setActiveInspector(defaultInspectorSelection(stage.view));
    setMobileInspectorOpen(false);
  }

  function openInspector(
    selection: InspectorSelection,
    options: { revealOnMobile?: boolean } = {},
  ) {
    setActiveInspector(selection);
    setInspectorCollapsed(false);
    setMobileInspectorOpen(options.revealOnMobile ?? true);
  }

  function defaultInspectorSelection(view: DemoView): InspectorSelection {
    if (view === "reviews") {
      return { kind: "review", id: rawReviewRows[0]?.id ?? "" };
    }
    if (view === "findings") {
      return findingCards[0]
        ? { kind: "finding", id: findingCards[0].id }
        : { kind: "overview" };
    }
    if (view === "prd") {
      return requirementCards[0]
        ? { kind: "requirement", id: requirementCards[0].id }
        : { kind: "overview" };
    }
    if (view === "tests") {
      return testCaseCards[0]
        ? { kind: "test_case", id: testCaseCards[0].id }
        : { kind: "overview" };
    }
    if (view === "validate") {
      return validationIssues[0]
        ? { kind: "validation_issue", id: validationIssues[0].id }
        : { kind: "overview" };
    }

    return defaultInspectorMap[view];
  }

  async function handleStartAnalysis() {
    setValidationAttempted(true);
    const normalizedImportFileName = importFileName || "reviewtrace-import.json";

    if (sourceMode !== "import") {
      if (appStoreUrlError(appStoreLink)) {
        return;
      }
    }

    if (sourceMode === "import" && !importText.trim()) {
      return;
    }

    setRequestedStart(true);
    setActiveView("run");
    setActiveStageId("scope");
    openInspector(defaultInspectorMap.run, { revealOnMobile: false });
    setInspectorHint("实时");
    setMobileNavOpen(false);
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
      openInspector(defaultInspectorMap.new, { revealOnMobile: false });
    }
  }

  function handleSaveDraft() {
    const savedAt = new Date().toLocaleString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
    window.localStorage.setItem(
      "reviewtrace-draft",
      JSON.stringify({
        analysisGoal,
        appStoreLink,
        savedAt,
        sourceMode,
      }),
    );
    setDraftSavedAt(savedAt);
  }

  function handleExportJson() {
    downloadTextFile(
      `${run?.runId ?? "reviewtrace-workspace"}.json`,
      "application/json",
      JSON.stringify(buildExportPayload(), null, 2),
    );
  }

  function handleExportMarkdown() {
    downloadTextFile(
      `${run?.runId ?? "reviewtrace-prd"}.md`,
      "text/markdown",
      buildMarkdownExport(),
    );
  }

  function buildExportPayload() {
    return {
      exportedAt: new Date().toISOString(),
      run,
      draft: {
        analysisGoal,
        appStoreLink,
        sourceMode,
        sourceLabel,
      },
      workbench: workbenchModel,
    };
  }

  function buildMarkdownExport() {
    const requirementLines = requirementCards.length
      ? requirementCards
          .map(
            (requirement) =>
              `- ${requirement.id} ${requirement.priority}: ${requirement.statement}`,
          )
          .join("\n")
      : "- 暂无需求。";
    const testLines = testCaseCards.length
      ? testCaseCards
          .map((testCase) => `- ${testCase.id}: ${testCase.title}`)
          .join("\n")
      : "- 暂无测试用例。";

    return [
      `# ${run?.prd.title ?? "ReviewTrace 工作台导出"}`,
      "",
      `运行：${run?.runId ?? "尚未运行"}`,
      `来源：${currentSource}`,
      `目标：${analysisGoal || "未填写"}`,
      "",
      "## 摘要",
      overview.summary.strongest,
      overview.summary.uncertain,
      "",
      "## 需求",
      requirementLines,
      "",
      "## 测试用例",
      testLines,
    ].join("\n");
  }

  function focusPrdSection(sectionId: string) {
    setActivePrdSection(sectionId);
    const section = document.getElementById(`rt-prd-${sectionId}`);
    if (typeof section?.scrollIntoView === "function") {
      section.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
    openInspector({ kind: "app_preview" }, { revealOnMobile: false });
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
      openInspector({ kind: "app_preview" }, { revealOnMobile: false });
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

    return appStoreUrlError(appStoreLink);
  }, [appStoreLink, sourceMode, validationAttempted]);
  const importError =
    validationAttempted && sourceMode === "import" && !importText.trim()
      ? "请先选择或拖入 JSON / CSV 评论数据。"
      : "";
  const canStartAnalysis =
    status !== "running" &&
    (sourceMode === "import" ? Boolean(importText.trim()) : !appStoreError);

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
            <span className="rt-badge rt-badge--success">{sourceLabel}</span>
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
            className={`rt-segmented__button ${sourceMode === "fixture" ? "is-active" : ""}`}
            type="button"
            onClick={() => setSourceMode("fixture")}
          >
            缓存示例
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
              <span className="rt-pill">{sourceMode === "fixture" ? "使用后端缓存" : "实时采集入口"}</span>
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
              onClick={() => openInspector({ kind: "app_preview" })}
            >
              <div className="rt-preview__icon">
                <AppIcon />
              </div>
              <div className="rt-preview__body">
                <strong>{run ? "最近一次运行" : "待分析应用"}</strong>
                <span>
                  {sourceMode === "fixture"
                    ? "缓存数据集会走完整后端工作流。"
                    : "运行完成后会以真实结果替换当前预览。"}
                </span>
                <div className="rt-preview__meta">
                  <span>{extractAppStoreId(appStoreLink) || "未识别 App ID"}</span>
                  <span>{run ? `${run.reviews.length} 条清洗评论` : "尚未运行"}</span>
                  <span>{sourceMode === "fixture" ? "缓存" : sourceMode === "import" ? "导入" : "实时"}</span>
                  <span>{appStoreError || "链接格式可用"}</span>
                </div>
              </div>
            </button>
            <p className="rt-note">
              App Store 元数据不会在前端伪造；运行完成后以评论源和工作流输出为准。
            </p>
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
                <strong>{importRowCount} 行</strong>
              </div>
              <div>
                <span className="rt-mini-label">数据来源</span>
                <strong>{sourceMode === "import" ? "已导入" : "未导入"}</strong>
              </div>
            </div>
            {importError ? <p className="rt-inline-error">{importError}</p> : null}

            <div className="rt-code-sample">
              <div className="rt-code-sample__head">
                <span>字段映射</span>
                <span>{importText ? "导入预览" : "示例格式"}</span>
              </div>
              <pre>{importText ? importPreview : schemaExampleCsv}</pre>
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
            <button
              className="rt-chip rt-chip--soft"
              type="button"
              onClick={() => setScopeExpanded((value) => !value)}
            >
              <ChevronDown size={14} />
              {scopeExpanded ? "收起" : "展开"}
            </button>
          </div>
          {scopeExpanded ? (
            <>
              <div className="rt-limit-grid">
                {(run?.analysisScope?.filteringRules?.length
                  ? run.analysisScope.filteringRules
                  : demoScopeLimits
                ).map((item) => (
                  <div key={item} className="rt-limit-item">
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="rt-inline-metrics">
                <div><strong>模型</strong><span>{currentProvider}</span></div>
                <div><strong>规则</strong><span>确定性 + 模型阶段</span></div>
                <div><strong>数据源</strong><span>{sourceLabel}</span></div>
              </div>
            </>
          ) : null}
        </section>

        <footer className="rt-action-bar">
          <div>
            <span className="rt-mini-label">预估流程</span>
            <strong>8 个阶段 · 实时数据集约 3 分钟</strong>
          </div>
          <div className="rt-action-bar__buttons">
            <button
              className="rt-button rt-button--secondary"
              type="button"
              onClick={handleSaveDraft}
            >
              <ClipboardCheck size={16} />
              保存草稿
            </button>
            <button
              className="rt-button rt-button--primary"
              type="button"
              onClick={handleStartAnalysis}
              disabled={!canStartAnalysis}
            >
              {status === "running" ? <Loader2 className="rt-spin" size={16} /> : <Play size={16} />}
              开始分析
            </button>
          </div>
        </footer>
        {draftSavedAt ? <p className="rt-note">草稿已保存：{draftSavedAt}</p> : null}
        {error ? <p className="rt-global-error">{error}</p> : null}
      </div>
    );
  }

  function renderRunWorkspace() {
    const progressCopy = run
      ? `${run.stages.filter((stage) => stage.status === "complete").length} 个阶段已完成。流程会如实展示限制、重试和仍需证据的内容。`
      : status === "running"
        ? "正在启动采集、清洗与分析流程。阶段状态会在下方逐步刷新。"
        : error
          ? "启动或运行失败。请回到新分析检查输入，或切换到缓存示例继续验证流程。"
          : "演示工作台 · 当前未启动真实运行。点击开始分析后将显示实时阶段状态与证据。";

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

        <section
          className={`rt-run-status ${
            error ? "rt-run-status--error" : status === "running" ? "rt-run-status--running" : ""
          }`}
        >
          <div>
            <span className="rt-mini-label">当前状态</span>
            <strong>{currentRunStatus}</strong>
          </div>
          <p>
            {error
              ? error
              : status === "running"
                ? "工作流已经接收请求，正在按阶段产生可追溯结果。"
                : run
                  ? "本次运行已完成，可以继续查看评论、主题、PRD、测试与验证结果。"
                  : "这里展示的是工作流结构预览，启动后会替换为实时报告。"}
          </p>
          {error ? (
            <button className="rt-button rt-button--secondary" type="button" onClick={() => goToView("new")}>
              回到新分析
            </button>
          ) : null}
        </section>

        <div className="rt-inline-metrics rt-inline-metrics--clickable">
          {summaryMetrics.map((metric) => (
            <button key={metric.label} className="rt-metric" type="button" onClick={() => openInspector({ kind: "run_health" })}>
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
            {currentTimelineStages.map((stage, index) => {
              const demoStage = demoStages.find(
                (item) => workflowStageIdForNav(item.id) === stage.id,
              );
              const report = effectiveStageReports.find((item) => item.name === stage.id);
              const rawStatus = stage.status ?? "pending";
              const summary = report?.summary ?? demoStage?.summary ?? "等待中";
              const details = report?.details ?? [demoStage?.input ?? "—", demoStage?.output ?? "—"];
              return (
                <details
                  key={stage.id}
                  className={`rt-trace-row ${rawStatus === "running" ? "is-running" : ""} ${
                    stage.id === workflowStageIdForNav(activeStageId) ? "is-active" : ""
                  }`}
                  open={index < 2 || stage.id === workflowStageIdForNav(activeStageId)}
                >
                  <summary className="rt-trace-row__summary" onClick={() => openInspector({ kind: "run_health" })}>
                    <span className={`rt-status-dot rt-status-dot--${rawStatus}`}>{stageIcon(rawStatus)}</span>
                    <span className="rt-trace-row__main">
                      <strong>{stage.label}</strong>
                      <span>{demoStage?.method ?? "确定性"} · {summary}</span>
                    </span>
                    <span className="rt-trace-row__meta">
                      <small>{stageLabel(rawStatus)}</small>
                      <small>{demoStage?.duration ?? "—"}</small>
                    </span>
                    <span className="rt-trace-row__meta rt-trace-row__meta--narrow">
                      <small>{details[0] ?? "—"}</small>
                      <small>{details[1] ?? "—"}</small>
                      <small>{demoStage?.tokens ?? "—"} token</small>
                    </span>
                  </summary>
                  <div className="rt-trace-row__body">
                    <div>
                      <span className="rt-mini-label">摘要</span>
                      <p>{summary}</p>
                    </div>
                    <div className="rt-trace-grid">
                      <div><strong>输入</strong><span>{details[0] ?? "—"}</span></div>
                      <div><strong>输出</strong><span>{details[1] ?? "—"}</span></div>
                      <div><strong>警告</strong><span>{report?.errors?.join("；") || demoStage?.badge}</span></div>
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
            <span className="rt-pill">{effectiveStageReports.length || demoStages.length} 条报告</span>
          </div>
          <div className="rt-report-grid">
            {(effectiveStageReports.length ? effectiveStageReports : demoStages.slice(0, 4).map((stage, index) => ({
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
    const rows = reviewTab === "raw" ? rawReviewRows : cleanReviewRows;
    const filteredRows = rows.filter((row) => {
      const query = reviewSearch.trim().toLowerCase();
      const matchesSearch =
        !query ||
        [
          row.id,
          row.date,
          row.version,
          row.locale,
          row.excerpt,
          row.theme,
          row.evidenceUsed,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesRating =
        reviewRatingFilter === "all" ||
        (reviewRatingFilter === "low" && row.rating <= 2) ||
        (reviewRatingFilter === "mid" && row.rating === 3) ||
        (reviewRatingFilter === "high" && row.rating >= 4);
      const matchesDuplicate =
        reviewDuplicateFilter === "all" ||
        (reviewDuplicateFilter === "only" && Boolean(row.duplicateOf)) ||
        (reviewDuplicateFilter === "hide" && !row.duplicateOf);

      return matchesSearch && matchesRating && matchesDuplicate;
    });
    const selectedReview =
      filteredRows.find(
        (row) => activeInspector.kind === "review" && row.id === activeInspector.id,
      ) ?? filteredRows[0];
    const leadCopy = run
      ? `${run.rawReviews.length} 条原始 → ${run.reviews.length} 条清洗后。可搜索、筛选并在右侧检查器中打开任一行。`
      : `${rawReviewRows.length} 条示例原始 → ${cleanReviewRows.length} 条示例清洗后。可搜索、筛选并在右侧检查器中打开任一行。`;

    return (
      <div className="rt-page">
        <div className="rt-page__lead">
          <div>
              <p className="rt-kicker">评论语料</p>
              <h1>原始评论与清洗评论</h1>
              <p className="rt-lead">{leadCopy}</p>
          </div>
          <div className="rt-tabs">
            <button className={`rt-tab ${reviewTab === "raw" ? "is-active" : ""}`} type="button" onClick={() => setReviewTab("raw")}>原始评论</button>
            <button className={`rt-tab ${reviewTab === "clean" ? "is-active" : ""}`} type="button" onClick={() => setReviewTab("clean")}>清洗数据集</button>
          </div>
        </div>

        <div className="rt-filter-bar">
          <label className="rt-search-field">
            <Search size={14} />
            <input
              aria-label="搜索评论"
              value={reviewSearch}
              onChange={(event) => setReviewSearch(event.target.value)}
              placeholder="搜索 ID、版本、主题或摘录"
            />
          </label>
          <label className="rt-select-field">
            <Filter size={14} />
            <select
              aria-label="评分筛选"
              value={reviewRatingFilter}
              onChange={(event) =>
                setReviewRatingFilter(event.target.value as ReviewRatingFilter)
              }
            >
              <option value="all">全部评分</option>
              <option value="low">1-2 星</option>
              <option value="mid">3 星</option>
              <option value="high">4-5 星</option>
            </select>
          </label>
          <label className="rt-select-field">
            <ClipboardCheck size={14} />
            <select
              aria-label="重复项筛选"
              value={reviewDuplicateFilter}
              onChange={(event) =>
                setReviewDuplicateFilter(event.target.value as ReviewDuplicateFilter)
              }
            >
              <option value="all">全部评论</option>
              <option value="hide">隐藏重复项</option>
              <option value="only">只看重复项</option>
            </select>
          </label>
          <span className="rt-pill">{filteredRows.length} / {rows.length} 条</span>
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
              {filteredRows.map((row) => (
                <tr key={row.id} className="rt-table-row">
                  <td>
                    <button className="rt-link-button" type="button" onClick={() => openInspector({ kind: "review", id: row.id })}>
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
          {filteredRows.length === 0 ? <p className="rt-note">没有符合筛选条件的评论。</p> : null}
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
            {selectedReview ? renderReviewSummary(selectedReview) : <p className="rt-note">当前运行没有可展示评论。</p>}
          </div>
        </section>
      </div>
    );
  }

  function renderFindings() {
    const activeTheme = themeCards[0];
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
              {themeCards.map((theme) => (
                <button
                  key={theme.id}
                  className="rt-theme-card"
                  type="button"
                  onClick={() => openInspector({ kind: "theme", id: theme.id })}
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
              {themeCards.length === 0 ? <p className="rt-note">当前运行没有生成主题卡。</p> : null}
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
              {findingCards.map((finding) => (
                <button
                  key={finding.id}
                  className={`rt-finding-card ${finding.assumption ? "is-assumption" : ""}`}
                  type="button"
                  onClick={() => openInspector({ kind: "finding", id: finding.id })}
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
              {findingCards.length === 0 ? <p className="rt-note">当前运行没有生成发现。</p> : null}
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
          {activeTheme ? (
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
                  {rawReviewRows.slice(0, 3).map((row) => (
                    <li key={row.id}>
                      <button type="button" className="rt-link-button" onClick={() => openInspector({ kind: "review", id: row.id })}>
                        {row.id}
                      </button>
                      <span>{row.excerpt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="rt-note">暂无代表性摘录。</p>
          )}
        </section>
      </div>
    );
  }

  function renderPrd() {
    const prd = run?.prd;
    const coverage = run
      ? run.traceabilityValidation.status === "passed"
        ? "100%"
        : "需修复"
      : "91%";

    return (
      <div className="rt-page">
        <div className="rt-page__lead">
          <div>
            <p className="rt-kicker">PRD 编辑器</p>
            <h1>{prd?.title ?? "PRD v1 草案"}</h1>
            <p className="rt-lead">由已验证发现生成，并保持可追溯到评论。</p>
          </div>
          <div className="rt-lead__status">
            <span className="rt-badge rt-badge--success">证据覆盖率 {coverage}</span>
            <div className="rt-inline-actions">
              <button className="rt-button rt-button--ghost" type="button" onClick={handleExportMarkdown}>
                <FileDown size={16} /> 导出 Markdown
              </button>
              <button className="rt-button rt-button--ghost" type="button" onClick={handleExportJson}>
                <Download size={16} /> 导出 JSON
              </button>
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
              {prdOutline.map((item) => (
                <button
                  key={item.id}
                  className={`rt-outline__item ${activePrdSection === item.id ? "is-active" : ""}`}
                  type="button"
                  onClick={() => focusPrdSection(item.id)}
                >
                  {item.label}
                </button>
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
              <section id="rt-prd-overview">
                <strong>总览</strong>
                <p>{prd?.objective ?? "ReviewTrace 会把应用评论转化为有证据链支撑的产品计划和可追溯测试套件。"}</p>
              </section>
              <section id="rt-prd-problem">
                <strong>问题陈述</strong>
                <textarea
                  key={run?.runId ?? "demo-prd-problem"}
                  className="rt-textarea"
                  defaultValue={run?.analysisScope?.focusSummary ?? "用户在被推到付费前，并不清楚订阅价值和取消路径。"}
                />
              </section>
              <section id="rt-prd-goals">
                <strong>目标</strong>
                <p>{prd?.successMetrics?.join("；") ?? "提升清晰度，减少意外，并让每条需求都能追溯到评论证据。"}</p>
              </section>
              <section id="rt-prd-non-goals">
                <strong>非目标</strong>
                <p>{run?.dataLimitations.join("；") || "不要声称不存在的证据。没有显式标记时，不要把假设当成已验证事实。"}</p>
              </section>
              <section id="rt-prd-versions">
                <strong>版本计划</strong>
                <div className="rt-plan-row">
                  {overview.versionPlan.map((item) => (
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
              <span className="rt-pill">{requirementCards[0]?.id ?? "暂无需求"}</span>
            </div>
            <div className="rt-requirement-list">
              {requirementCards.map((requirement) => (
                <button
                  key={requirement.id}
                  className={`rt-requirement-card ${requirement.assumption ? "is-assumption" : ""}`}
                  type="button"
                  onClick={() => openInspector({ kind: "requirement", id: requirement.id })}
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
              {requirementCards.length === 0 ? <p className="rt-note">当前运行没有生成需求。</p> : null}
            </div>
          </section>
        </div>
      </div>
    );
  }

  function renderTests() {
    const selected = testCaseCards.find(
      (testCase) => activeInspector.kind === "test_case" && testCase.id === activeInspector.id,
    ) ?? testCaseCards[0];
    const coveredRequirementCount = new Set(testCaseCards.map((testCase) => testCase.requirementId)).size;
    const testCoverage = requirementCards.length
      ? `${Math.round((coveredRequirementCount / requirementCards.length) * 100)}%`
      : "0%";
    const edgeCaseCount = testCaseCards.reduce(
      (total, testCase) => total + testCase.edgeCases.length,
      0,
    );
    const testLead = run
      ? `${testCaseCards.length} 个测试用例 · 覆盖 ${coveredRequirementCount} 条需求 · 证据关联测试 ${run.traceabilityValidation.unsupportedTestCaseIds.length ? "需修复" : "100%"}。`
      : `${testCaseCards.length} 个示例测试用例 · 覆盖 ${coveredRequirementCount} 条需求。`;

    return (
      <div className="rt-page">
        <div className="rt-page__lead">
          <div>
            <p className="rt-kicker">测试用例</p>
            <h1>可追溯测试套件</h1>
            <p className="rt-lead">{testLead}</p>
          </div>
          <div className="rt-lead__status">
            <span className="rt-badge rt-badge--success">覆盖率 {testCoverage}</span>
            <span className="rt-badge rt-badge--warning">{edgeCaseCount} 个边界情况</span>
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
              {testCaseCards.map((testCase) => (
                <tr key={testCase.id} className="rt-table-row">
                  <td>
                    <button className="rt-link-button" type="button" onClick={() => openInspector({ kind: "test_case", id: testCase.id })}>{testCase.id}</button>
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
          {testCaseCards.length === 0 ? <p className="rt-note">当前运行没有生成测试用例。</p> : null}
        </section>

        <section className="rt-card rt-card--surface">
          <div className="rt-section-head">
            <div>
              <p className="rt-kicker">详情视图</p>
              <h2>这个测试为什么存在</h2>
            </div>
            <span className="rt-pill">{selected?.id ?? "暂无测试"}</span>
          </div>
          {selected ? (
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
          ) : (
            <p className="rt-note">暂无测试详情。</p>
          )}
        </section>
      </div>
    );
  }

  function renderValidate() {
    const unsupportedFindingCount =
      run?.traceabilityValidation.unsupportedFindingIds.length ??
      validationIssues.filter((issue) => issue.path.includes("发现") && issue.status !== "有效").length;
    const unsupportedRequirementCount =
      run?.traceabilityValidation.unsupportedRequirementIds.length ??
      validationIssues.filter((issue) => issue.path.includes("需求") && issue.status !== "有效").length;
    const unsupportedTestCount =
      run?.traceabilityValidation.unsupportedTestCaseIds.length ??
      validationIssues.filter((issue) => issue.path.includes("测试") && issue.status !== "有效").length;
    const conflictCount = findingCards.reduce(
      (total, finding) => total + finding.contradictingEvidence.length,
      0,
    );
    const traceabilityCoverage = run
      ? run.traceabilityValidation.status === "passed"
        ? "100%"
        : `${Math.max(0, 100 - (unsupportedFindingCount + unsupportedRequirementCount + unsupportedTestCount) * 10)}%`
      : `${Math.max(0, 100 - (unsupportedFindingCount + unsupportedRequirementCount + unsupportedTestCount) * 10)}%`;

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
          <div className="rt-metric"><span>完全可追溯</span><strong>{traceabilityCoverage}</strong><small>含显式假设</small></div>
          <div className="rt-metric"><span>无支撑发现</span><strong>{unsupportedFindingCount}</strong><small>需要移除或标记为假设</small></div>
          <div className="rt-metric"><span>无支撑需求</span><strong>{unsupportedRequirementCount}</strong><small>补强来源链</small></div>
          <div className="rt-metric"><span>冲突组</span><strong>{conflictCount}</strong><small>已审查，但未忽略</small></div>
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
              {validationIssues.map((issue) => (
                <button
                  key={issue.id}
                  className={`rt-validation-card rt-validation-card--${validationStatusClass(issue.status)}`}
                  type="button"
                  onClick={() => openInspector({ kind: "validation_issue", id: issue.id })}
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
          <span className={`rt-badge ${run?.traceabilityValidation.status === "failed" ? "rt-badge--warning" : "rt-badge--success"}`}>
            {currentRunStatus}
          </span>
        </div>

        <section className="rt-grid rt-grid--overview">
          {Object.entries(overview.summary).map(([key, value]) => (
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
            {overview.versionPlan.map((item) => (
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
            {overview.deliverables.map((item) => (
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
        <InspectorCard title="应用预览" subtitle={run ? "实时" : "待运行"} icon={<AppIcon />}>
          <div className="rt-inspector-list">
            <div><span>App ID</span><strong>{extractAppStoreId(appStoreLink) || "未识别"}</strong></div>
            <div><span>来源</span><strong>{sourceLabel}</strong></div>
            <div><span>状态</span><strong>{currentRunStatus}</strong></div>
            <div><span>原始评论</span><strong>{run ? run.rawReviews.length : "尚未采集"}</strong></div>
            <div><span>清洗评论</span><strong>{run ? run.reviews.length : "尚未生成"}</strong></div>
            <div><span>模型</span><strong>{currentProvider}</strong></div>
            <div><span>链接</span><strong>{sourceMode === "import" ? "导入数据" : appStoreLink}</strong></div>
          </div>
          <p className="rt-note">这里展示当前工作台上下文；真实应用元数据不会在前端伪造。</p>
        </InspectorCard>
      );
    }

    if (activeInspector.kind === "run_health") {
      return (
        <InspectorCard title="运行健康" subtitle={inspectorHint} icon={<Gauge />}>
          <div className="rt-inspector-metrics">
            {summaryMetrics.slice(0, 3).map((metric) => (
              <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>
            ))}
          </div>
          <div className="rt-mini-stack">
            <span>提供方：{currentProvider}</span>
            <span>来源：{currentSource}</span>
            <span>已知限制：{run?.dataLimitations.join("；") || "限流、缓存示例兜底、假设门控。"}</span>
          </div>
        </InspectorCard>
      );
    }

    if (activeInspector.kind === "review") {
      const review = rawReviewRows.find((row) => row.id === activeInspector.id) ??
        cleanReviewRows.find((row) => row.id === activeInspector.id) ??
        rawReviewRows[0] ??
        cleanReviewRows[0];
      return (
        <InspectorCard title="评论" subtitle={review?.id ?? "暂无评论"} icon={<FolderOpen />}>
          {review ? renderReviewSummary(review) : <p className="rt-note">当前没有评论可检查。</p>}
        </InspectorCard>
      );
    }

    if (activeInspector.kind === "theme") {
      const theme = themeCards.find((item) => item.id === activeInspector.id) ?? themeCards[0];
      return (
        <InspectorCard title="主题" subtitle={theme?.id ?? "暂无主题"} icon={<Sparkles />}>
          {theme ? (
            <>
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
            </>
          ) : <p className="rt-note">当前没有主题可检查。</p>}
        </InspectorCard>
      );
    }

    if (activeInspector.kind === "finding") {
      const finding = findingCards.find((item) => item.id === activeInspector.id) ?? findingCards[0];
      return (
        <InspectorCard title="发现" subtitle={finding?.id ?? "暂无发现"} icon={<Sparkles />}>
          {finding ? (
            <>
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
            </>
          ) : <p className="rt-note">当前没有发现可检查。</p>}
        </InspectorCard>
      );
    }

    if (activeInspector.kind === "requirement") {
      const req = requirementCards.find((item) => item.id === activeInspector.id) ?? requirementCards[0];
      return (
        <InspectorCard title="需求" subtitle={req?.id ?? "暂无需求"} icon={<BookOpen />}>
          {req ? (
            <>
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
            </>
          ) : <p className="rt-note">当前没有需求可检查。</p>}
        </InspectorCard>
      );
    }

    if (activeInspector.kind === "test_case") {
      const testCase = testCaseCards.find((item) => item.id === activeInspector.id) ?? testCaseCards[0];
      return (
        <InspectorCard title="测试用例" subtitle={testCase?.id ?? "暂无测试"} icon={<TestTube2 />}>
          {testCase ? (
            <>
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
            </>
          ) : <p className="rt-note">当前没有测试用例可检查。</p>}
        </InspectorCard>
      );
    }

    if (activeInspector.kind === "validation_issue") {
      const issue = validationIssues.find((item) => item.id === activeInspector.id) ?? validationIssues[0];
      return (
        <InspectorCard title="验证" subtitle={issue?.id ?? "暂无验证"} icon={<GitBranch />}>
          {issue ? (
            <>
              <div className="rt-inspector-list">
                <div><span>状态</span><strong>{issue.status}</strong></div>
                <div><span>评论</span><strong>{issue.reviewCount}</strong></div>
                <div><span>路径</span><strong>{issue.path}</strong></div>
              </div>
              <p>{issue.note}</p>
              <div className="rt-mini-stack">
                <span>动作：{issue.action}</span>
              </div>
            </>
          ) : <p className="rt-note">当前没有验证项可检查。</p>}
        </InspectorCard>
      );
    }

    return (
      <InspectorCard title="总览" subtitle="决策摘要" icon={<Gauge />}>
        <div className="rt-mini-stack">
          <span>{overview.summary.strongest}</span>
          <span>{overview.summary.uncertain}</span>
          <span>{overview.summary.buildV1}</span>
          <span>{overview.summary.defer}</span>
        </div>
      </InspectorCard>
    );
  }

  return (
    <main
      className={`rt-shell ${navCollapsed ? "rt-shell--nav-collapsed" : ""} ${
        inspectorCollapsed ? "rt-shell--inspector-collapsed" : ""
      } ${mobileNavOpen ? "rt-shell--mobile-nav-open" : ""} ${
        mobileInspectorOpen ? "rt-shell--mobile-inspector-open" : ""
      }`}
    >
      <h1 className="rt-sr-only">ReviewTrace</h1>
      {mobileNavOpen || mobileInspectorOpen ? (
        <button
          aria-label="关闭面板"
          className="rt-shell__scrim"
          type="button"
          onClick={() => {
            setMobileNavOpen(false);
            setMobileInspectorOpen(false);
          }}
        />
      ) : null}
      <aside className="rt-nav">
        <div className="rt-nav__brand">
          <div className="rt-nav__logo">
            <LayoutDashboard size={18} />
          </div>
          <div>
            <strong>ReviewTrace</strong>
            <span>证据优先工作台</span>
          </div>
          <button
            className="rt-nav__collapse"
            type="button"
            aria-label={navCollapsed ? "展开导航" : "折叠导航"}
            onClick={() => setNavCollapsed((value) => !value)}
          >
            {navCollapsed ? <PanelRight size={16} /> : <PanelLeft size={16} />}
          </button>
          <button
            className="rt-nav__mobile-close"
            type="button"
            aria-label="关闭导航"
            onClick={() => setMobileNavOpen(false)}
          >
            <XCircle size={18} />
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
          {stageNav.map((item) => {
            const demoStage = demoStages.find((stage) => stage.id === item.id);
            const workflowStatus = run?.stages.find(
              (stage) => stage.name === workflowStageIdForNav(item.id),
            )?.status;
            const navStatus = workflowStatus ?? demoStage?.status ?? "pending";

            return (
              <button
                key={item.id}
                className={`rt-nav__item ${
                  activeView === item.view && activeStageId === item.id ? "is-active" : ""
                }`}
                type="button"
                onClick={() => goToStage(item)}
              >
                {stageIcon(navStatus)}
                <span>
                  <strong>{item.label}</strong>
                  <small>{workflowStatus ? stageLabel(workflowStatus) : demoStage?.badge ?? "—"}</small>
                </span>
              </button>
            );
          })}
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
                <strong>{run ? "ReviewTrace 运行" : "ReviewTrace 工作台"}</strong>
                <span>{views.find((item) => item.id === activeView)?.label ?? "ReviewTrace"}</span>
              </div>
            </div>
            <div className="rt-topbar__meta">
              <span className="rt-topbar__token">{currentRunId}</span>
              <span className={`rt-badge ${currentRunStatus === "运行中" ? "rt-badge--running" : currentRunStatus === "已验证" ? "rt-badge--success" : "rt-badge--warning"}`}>{currentRunStatus}</span>
              <span className="rt-topbar__token">{currentSource}</span>
              <span className="rt-topbar__token">{currentProvider}</span>
              <span className="rt-topbar__token">
                {run ? "本次运行已生成" : draftSavedAt ? `草稿 ${draftSavedAt}` : "未保存草稿"}
              </span>
            </div>
          </div>
          <div className="rt-topbar__actions">
            <button
              className="rt-button rt-button--ghost rt-mobile-nav-trigger"
              type="button"
              aria-label="打开移动导航"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu size={16} /> 导航
            </button>
            {navCollapsed ? (
              <button
                className="rt-button rt-button--ghost"
                type="button"
                onClick={() => setNavCollapsed(false)}
              >
                <Menu size={16} /> 导航
              </button>
            ) : null}
            <button className="rt-button rt-button--ghost" type="button" onClick={handleExportJson}>
              <Download size={16} /> 导出 JSON
            </button>
            <button
              className="rt-button rt-button--ghost rt-mobile-inspector-trigger"
              type="button"
              aria-label="打开详情面板"
              onClick={() => {
                setInspectorCollapsed(false);
                setMobileInspectorOpen(true);
              }}
            >
              <PanelRight size={16} /> 详情
            </button>
            {inspectorCollapsed ? (
              <button
                className="rt-button rt-button--ghost"
                type="button"
                onClick={() => setInspectorCollapsed(false)}
              >
                <PanelRight size={16} /> 检查器
              </button>
            ) : null}
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
          {inspectorCollapsed ? null : (
          <aside className="rt-inspector">
            <div className="rt-inspector__head">
              <div>
                <p className="rt-kicker">证据检查器</p>
                <h2>{inspectorKindLabel(activeInspector.kind)}</h2>
              </div>
              <button
                className="rt-button rt-button--ghost"
                type="button"
                aria-label="收起检查器"
                onClick={() => {
                  setInspectorCollapsed(true);
                  setMobileInspectorOpen(false);
                }}
              >
                <PanelRight size={16} />
              </button>
            </div>
            {renderInspector()}
          </aside>
          )}
        </div>
      </section>
    </main>
  );
}

function workflowStageLabel(name: string) {
  const labels: Record<string, string> = {
    analysis: "分类结果",
    cleaning: "清洗",
    prd: "产品需求文档",
    reviews: "评论",
    scope: "范围",
    tests: "测试",
    validation: "校验",
  };

  return labels[name] ?? name;
}

function appStoreUrlError(appStoreLink: string) {
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
}

function extractAppStoreId(appStoreLink: string) {
  return appStoreLink.match(/id(\d+)/)?.[1] ?? "";
}

function countImportedRows(datasetText: string, fileName: string) {
  if (!datasetText.trim()) {
    return 0;
  }

  if (fileName.toLowerCase().endsWith(".csv")) {
    return Math.max(
      0,
      datasetText.split(/\r?\n/).filter((line) => line.trim()).length - 1,
    );
  }

  try {
    const parsed = JSON.parse(datasetText) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : isObjectWithReviews(parsed)
        ? parsed.reviews
        : [];
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return datasetText.split(/\r?\n/).filter((line) => line.trim()).length;
  }
}

function previewImportedDataset(datasetText: string, fileName: string) {
  const trimmed = datasetText.trim();
  if (!trimmed) {
    return "";
  }

  if (fileName.toLowerCase().endsWith(".csv")) {
    return trimmed.split(/\r?\n/).slice(0, 6).join("\n");
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return JSON.stringify(parsed.slice(0, 5), null, 2);
    }
    if (isObjectWithReviews(parsed) && Array.isArray(parsed.reviews)) {
      return JSON.stringify({ ...parsed, reviews: parsed.reviews.slice(0, 5) }, null, 2);
    }
  } catch {
    return trimmed.split(/\r?\n/).slice(0, 8).join("\n");
  }

  return trimmed.split(/\r?\n/).slice(0, 8).join("\n");
}

function isObjectWithReviews(value: unknown): value is { reviews: unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "reviews" in value &&
    Array.isArray((value as { reviews?: unknown }).reviews)
  );
}

function downloadTextFile(fileName: string, mimeType: string, text: string) {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const link = document.createElement("a");
  const canUseBlobUrl = typeof URL.createObjectURL === "function";
  const url = canUseBlobUrl
    ? URL.createObjectURL(blob)
    : `data:${mimeType};charset=utf-8,${encodeURIComponent(text)}`;

  link.href = url;
  link.download = fileName;
  link.click();
  if (canUseBlobUrl) {
    URL.revokeObjectURL(url);
  }
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
