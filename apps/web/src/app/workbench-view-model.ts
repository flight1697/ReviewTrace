import type { Finding, Review, WorkflowRun } from "./workflow";

export type DemoReviewRow = {
  id: string;
  rating: number;
  date: string;
  version: string;
  locale: string;
  excerpt: string;
  theme: string;
  sentiment: "正向" | "混合" | "负向";
  duplicateOf?: string;
  evidenceUsed: string;
  source: "实时" | "导入" | "未知";
};

export type DemoThemeCard = {
  id: string;
  name: string;
  summary: string;
  reviews: number;
  share: string;
  avgRating: string;
  confidence: "高" | "中" | "低";
  trend: string;
  conflicts: number;
  versions: string[];
  languages: string[];
  spark: number[];
};

export type DemoFindingCard = {
  id: string;
  title: string;
  severity: string;
  confidence: "高" | "中" | "低";
  sampleCount: number;
  supportingReviews: string[];
  stats: string;
  synthesis: string;
  contradictingEvidence: string[];
  limitation: string;
  assumption?: boolean;
};

export type DemoRequirementCard = {
  id: string;
  statement: string;
  priority: "P0" | "P1" | "P2";
  targetRelease: string;
  sourceFindings: string[];
  sourceReviews: string[];
  acceptanceCriteria: string[];
  confidence: string;
  assumption?: boolean;
  status: "草案" | "已验证" | "证据不足";
};

export type DemoTestCase = {
  id: string;
  title: string;
  type: "功能" | "体验" | "回归" | "失败恢复";
  priority: string;
  requirementId: string;
  sourceReviews: string[];
  preconditions: string[];
  steps: string[];
  expected: string;
  edgeCases: string[];
  why: string;
};

export type DemoValidationIssue = {
  id: string;
  title: string;
  status: "有效" | "警告" | "断链";
  path: string;
  reviewCount: number;
  note: string;
  action: string;
};

export type WorkbenchSummaryMetric = {
  label: string;
  value: string;
  hint: string;
};

export type WorkbenchOverview = {
  summary: {
    strongest: string;
    uncertain: string;
    buildV1: string;
    defer: string;
  };
  versionPlan: {
    label: string;
    note: string;
    count: number;
  }[];
  deliverables: string[];
};

export type WorkbenchViewModel = {
  cleanReviewRows: DemoReviewRow[];
  findingCards: DemoFindingCard[];
  overview: WorkbenchOverview;
  rawReviewRows: DemoReviewRow[];
  requirementCards: DemoRequirementCard[];
  summaryMetrics: WorkbenchSummaryMetric[];
  testCaseCards: DemoTestCase[];
  themeCards: DemoThemeCard[];
  validationIssues: DemoValidationIssue[];
};

const EMPTY_OVERVIEW: WorkbenchOverview = {
  summary: {
    strongest: "暂无运行结果，开始分析后会显示真实证据链。",
    uncertain: "当前还没有可验证的运行数据。",
    buildV1: "等待后端工作流生成版本建议。",
    defer: "暂无需要延后的交付物。",
  },
  versionPlan: [],
  deliverables: [],
};

const EMPTY_SUMMARY_METRICS: WorkbenchSummaryMetric[] = [
  { label: "已收集评论", value: "0", hint: "等待后端返回运行结果" },
  { label: "清洗后评论", value: "0", hint: "等待运行" },
  { label: "已去重", value: "0", hint: "等待运行" },
  { label: "识别语言", value: "0", hint: "等待运行" },
  { label: "模型发现", value: "0", hint: "等待运行" },
  { label: "验证问题", value: "0", hint: "等待运行" },
];

export function buildWorkbenchModel(run: WorkflowRun | null): WorkbenchViewModel {
  if (!run) {
    return {
      cleanReviewRows: [],
      findingCards: [],
      overview: EMPTY_OVERVIEW,
      rawReviewRows: [],
      requirementCards: [],
      summaryMetrics: EMPTY_SUMMARY_METRICS,
      testCaseCards: [],
      themeCards: [],
      validationIssues: [],
    };
  }

  return {
    cleanReviewRows: buildRunReviewRows(run, run.reviews),
    findingCards: buildRunFindingCards(run),
    overview: buildRunOverview(run),
    rawReviewRows: buildRunReviewRows(run, run.rawReviews),
    requirementCards: buildRunRequirements(run),
    summaryMetrics: buildRunSummaryMetrics(run),
    testCaseCards: buildRunTestCases(run),
    themeCards: buildRunThemeCards(run),
    validationIssues: buildRunValidationIssues(run),
  };
}

export function workflowStageIdForNav(navId: string) {
  const stageIds: Record<string, string> = {
    analyze: "analysis",
    clean: "cleaning",
    collect: "reviews",
    evidence: "evidence",
    prd: "prd",
    scope: "scope",
    tests: "tests",
    validate: "validation",
  };

  return stageIds[navId] ?? navId;
}

function buildRunReviewRows(run: WorkflowRun, reviews: Review[]): DemoReviewRow[] {
  const findingByReviewId = new Map<string, Finding>();
  for (const finding of run.findings) {
    for (const reviewId of finding.reviewIds) {
      if (!findingByReviewId.has(reviewId)) {
        findingByReviewId.set(reviewId, finding);
      }
    }
  }

  return reviews.map((review) => {
    const finding = findingByReviewId.get(review.id);
    const body = [review.title, review.body].filter(Boolean).join("：");

    return {
      id: review.id,
      rating: review.rating,
      date: review.date || "未提供",
      version: review.appVersion || "未提供",
      locale: review.locale || run.scope.storefront || "未提供",
      excerpt: body || review.body || review.title || "未提供",
      theme: finding?.title || "综合反馈",
      sentiment: review.rating <= 2 ? "负向" : review.rating === 3 ? "混合" : "正向",
      evidenceUsed: finding ? `用于 ${finding.id}` : "原始评论",
      source: sourceModeLabel(run.source.mode),
    };
  });
}

function buildRunThemeCards(run: WorkflowRun): DemoThemeCard[] {
  if (!run.findings.length) {
    return [];
  }

  const reviewsById = new Map(run.reviews.map((review) => [review.id, review]));

  return run.findings.map((finding, index) => {
    const sourceReviews = finding.reviewIds
      .map((reviewId) => reviewsById.get(reviewId))
      .filter((review): review is Review => Boolean(review));
    const averageRating = sourceReviews.length
      ? sourceReviews.reduce((sum, review) => sum + review.rating, 0) / sourceReviews.length
      : 0;
    const languages = uniqueNonEmpty(
      sourceReviews.map((review) => review.locale || run.scope.storefront || ""),
    );
    const versions = uniqueNonEmpty(sourceReviews.map((review) => review.appVersion || ""));

    return {
      id: finding.id,
      name: finding.title,
      summary: finding.evidence[0]?.excerpt || finding.title,
      reviews: finding.reviewIds.length,
      share: run.reviews.length
        ? `${Math.round((finding.reviewIds.length / run.reviews.length) * 100)}%`
        : "0%",
      avgRating: averageRating ? averageRating.toFixed(1) : "0.0",
      confidence: normalizeConfidence(finding.confidence),
      trend: index === 0 ? "当前重点" : "关联主题",
      conflicts: finding.conflictingEvidence.length,
      versions: versions.length ? versions : [run.scope.storefront],
      languages: languages.length ? languages : [run.scope.storefront],
      spark: buildSparkline(index, finding.reviewIds.length),
    };
  });
}

function buildRunFindingCards(run: WorkflowRun): DemoFindingCard[] {
  return run.findings.map((finding) => ({
    id: finding.id,
    title: finding.title,
    severity: severityLabel(finding.sampleCount, finding.conflictingEvidence.length),
    confidence: normalizeConfidence(finding.confidence),
    sampleCount: finding.sampleCount,
    supportingReviews: finding.reviewIds,
    stats: `${finding.sampleCount} 条评论 · ${finding.method}`,
    synthesis: finding.evidence[0]?.excerpt || "后端工作流生成的发现。",
    contradictingEvidence: finding.conflictingEvidence.map(
      (item) => `${item.reviewId}：${item.excerpt}`,
    ),
    limitation:
      finding.conflictingEvidence.length > 0
        ? "存在冲突证据，仍需要继续审查。"
        : "当前发现已绑定到原始评论证据。",
    assumption: finding.confidence === "低",
  }));
}

function buildRunRequirements(run: WorkflowRun): DemoRequirementCard[] {
  return run.requirements.map((requirement) => ({
    id: requirement.id,
    statement: requirement.title,
    priority: requirement.priority as "P0" | "P1" | "P2",
    targetRelease: requirement.version,
    sourceFindings: requirement.findingIds,
    sourceReviews: requirement.sourceReviewIds,
    acceptanceCriteria: requirement.acceptanceCriteria ?? [],
    confidence: normalizeConfidenceFromPriority(requirement.priority),
    assumption: requirement.assumption,
    status: requirement.assumption ? "证据不足" : "已验证",
  }));
}

function buildRunTestCases(run: WorkflowRun): DemoTestCase[] {
  const requirementById = new Map(
    run.requirements.map((requirement) => [requirement.id, requirement]),
  );

  return run.testCases.map((testCase) => {
    const requirement = requirementById.get(testCase.requirementId);

    return {
      id: testCase.id,
      title: testCase.title,
      type: "功能",
      priority: requirement?.priority || "P2",
      requirementId: testCase.requirementId,
      sourceReviews: testCase.sourceReviewIds,
      preconditions: [
        `关联需求 ${testCase.requirementId}`,
        `来源评论 ${testCase.sourceReviewIds.join(", ")}`,
      ],
      steps: testCase.steps,
      expected: testCase.expectedResult,
      edgeCases: testCase.verificationPoints?.length
        ? testCase.verificationPoints
        : ["暂无额外边界"],
      why: requirement
        ? `由需求 ${requirement.id} 自动生成，保持对原始评论的可追溯。`
        : "由后端工作流自动生成。",
    };
  });
}

function buildRunValidationIssues(run: WorkflowRun): DemoValidationIssue[] {
  const issues: DemoValidationIssue[] = [];

  if (run.traceabilityValidation.unsupportedFindingIds.length === 0) {
    issues.push({
      id: "VAL-001",
      title: "发现与评论链路已完成追溯",
      status: "有效",
      path: "评论 → 发现",
      reviewCount: run.reviews.length,
      note: "所有发现都已绑定到有效评论证据。",
      action: "保持当前范围",
    });
  } else {
    issues.push({
      id: "VAL-001",
      title: "部分发现未通过追溯校验",
      status: "断链",
      path: "评论 → 发现",
      reviewCount: run.traceabilityValidation.unsupportedFindingIds.length,
      note: run.traceabilityValidation.unsupportedFindingIds.join("、"),
      action: "补充或移除这些发现",
    });
  }

  if (run.traceabilityValidation.unsupportedRequirementIds.length) {
    issues.push({
      id: "VAL-002",
      title: "部分需求缺少完整来源链",
      status: "警告",
      path: "发现 → 需求",
      reviewCount: run.traceabilityValidation.unsupportedRequirementIds.length,
      note: run.traceabilityValidation.unsupportedRequirementIds.join("、"),
      action: "补强需求证据",
    });
  }

  if (run.traceabilityValidation.unsupportedTestCaseIds.length) {
    issues.push({
      id: "VAL-003",
      title: "部分测试用例未通过追溯校验",
      status: "警告",
      path: "需求 → 测试",
      reviewCount: run.traceabilityValidation.unsupportedTestCaseIds.length,
      note: run.traceabilityValidation.unsupportedTestCaseIds.join("、"),
      action: "修正测试来源链",
    });
  }

  return issues;
}

function buildRunOverview(run: WorkflowRun): WorkbenchOverview {
  const supportedRequirements = run.requirements.filter((requirement) => !requirement.assumption);

  return {
    summary: {
      strongest:
        run.findings[0]?.title || "当前运行没有生成新的发现。",
      uncertain:
        run.traceabilityValidation.status === "passed"
          ? "当前追溯链路没有明显断点。"
          : "仍有需要修补的追溯断点。",
      buildV1: supportedRequirements.length
        ? `优先交付 ${supportedRequirements[0].title}`
        : "等待更多证据后再生成版本 1。",
      defer:
        run.requirements.length > supportedRequirements.length
          ? "证据不足的需求先放入后续版本。"
          : "当前版本计划没有明显需要延后项。",
    },
    versionPlan: run.versionPlan.versions.map((version, index) => ({
      label: version.id,
      note: version.goal,
      count: version.requirementIds.length || index + 1,
    })),
    deliverables: [
      "清洗数据集",
      "主题报告",
      "发现",
      "PRD",
      "测试套件",
      "追溯报告",
    ],
  };
}

function buildRunSummaryMetrics(run: WorkflowRun): WorkbenchSummaryMetric[] {
  const languages = uniqueNonEmpty(run.reviews.map((review) => review.locale || ""));
  return [
    {
      label: "已收集评论",
      value: String(run.rawReviews.length),
      hint: `${run.source.label} · ${run.rawReviews.length - run.reviews.length} 条被清洗或去重`,
    },
    {
      label: "清洗后评论",
      value: String(run.reviews.length),
      hint: `移除 ${run.cleaningSummary.duplicateCount + run.cleaningSummary.discardedEmptyCount} 条`,
    },
    {
      label: "已去重",
      value: String(run.cleaningSummary.duplicateCount),
      hint: "基于标题与正文归一化指纹",
    },
    {
      label: "识别语言",
      value: String(languages.length || 1),
      hint: languages.length ? languages.join(" · ") : run.scope.storefront,
    },
    {
      label: "模型发现",
      value: String(run.findings.length),
      hint: `${run.analysisSummary.provider} · ${run.analysisSummary.model}`,
    },
    {
      label: "验证问题",
      value: String(
        run.traceabilityValidation.unsupportedFindingIds.length +
          run.traceabilityValidation.unsupportedRequirementIds.length +
          run.traceabilityValidation.unsupportedTestCaseIds.length,
      ),
      hint:
        run.traceabilityValidation.status === "passed"
          ? "当前追溯链路完整"
          : "仍有断链需要处理",
    },
  ];
}

function sourceModeLabel(mode: string): DemoReviewRow["source"] {
  if (mode === "live") return "实时";
  if (mode === "import") return "导入";
  return "未知";
}

function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeConfidence(value: string): "高" | "中" | "低" {
  if (value === "高" || value === "中" || value === "低") {
    return value;
  }

  if (value.includes("high")) return "高";
  if (value.includes("low")) return "低";
  return "中";
}

function normalizeConfidenceFromPriority(priority: string): "高" | "中" | "低" {
  if (priority === "P0") return "高";
  if (priority === "P1") return "中";
  return "低";
}

function severityLabel(sampleCount: number, conflictCount: number) {
  if (sampleCount >= 4 && conflictCount === 0) return "高";
  if (sampleCount >= 2) return "中";
  return "低";
}

function buildSparkline(index: number, sampleCount: number) {
  const base = Math.max(3, sampleCount);
  return Array.from({ length: 7 }, (_, position) =>
    Math.max(1, base + (position === index % 7 ? 3 : 0) - Math.abs(position - index)),
  );
}
