export type DemoView = "new" | "run" | "reviews" | "findings" | "prd" | "tests" | "validate" | "overview";

export type DemoInspectorKind =
  | "run_health"
  | "app_preview"
  | "review"
  | "theme"
  | "finding"
  | "requirement"
  | "test_case"
  | "validation_issue"
  | "overview";

export type DemoReviewRow = {
  id: string;
  rating: number;
  date: string;
  version: string;
  locale: string;
  excerpt: string;
  theme: string;
  sentiment: "Positive" | "Mixed" | "Negative";
  duplicateOf?: string;
  evidenceUsed: string;
  source: "Sample" | "Cached" | "Live";
};

export type DemoThemeCard = {
  id: string;
  name: string;
  summary: string;
  reviews: number;
  share: string;
  avgRating: string;
  confidence: "High" | "Medium" | "Low";
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
  confidence: "High" | "Medium" | "Low";
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
  status: "Draft" | "Validated" | "Needs evidence";
};

export type DemoTestCase = {
  id: string;
  title: string;
  type: "Functional" | "UX" | "Regression" | "Failure recovery";
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
  status: "Valid" | "Warning" | "Broken";
  path: string;
  reviewCount: number;
  note: string;
  action: string;
};

export const demoApp = {
  appName: "Workout for Women: Fitness App",
  runId: "RUN-2026-0720-014",
  runStatus: "Validated with 3 explicit assumptions",
  source: "Cached sample",
  provider: "GPT-5 · OpenAI",
  lastSaved: "2026-07-20 09:24",
  elapsed: "02:18",
  progress: "4 of 8 stages complete",
  exportLabel: "Export",
};

export const demoAppPreview = {
  name: "Workout for Women: Fitness App",
  developer: "Fast Builder Ltd.",
  category: "Health & Fitness",
  version: "7.2.1",
  rating: "4.6",
  reviews: "8,420",
  storefront: "U.S. storefront",
  sourceLabel: "Sample",
  note: "Review availability may vary by storefront and rate limits.",
};

export const demoGoalChips = [
  "Subscription conversion",
  "Workout usability",
  "Low ratings",
  "Latest version",
  "Conflicting feedback",
  "Multilingual reviews",
];

export const demoScopeLimits = [
  "Rating: 1–3 stars",
  "Date range: last 90 days",
  "Versions: 7.1, 7.2, 7.2.1",
  "Languages: en-US, zh-Hans",
  "Maximum reviews: 1,500",
  "Minimum evidence threshold: 3 independent reviews",
  "Include cached sample if collection fails",
];

export const demoStages = [
  { id: "scope", label: "1 Scope", status: "complete", method: "Rule", summary: "收敛到订阅转化、训练可用性与取消路径。", input: "108 reviews", output: "3 focus areas", badge: "2 warnings", duration: "12.4s", tokens: "0", cost: "$0.00" },
  { id: "collect", label: "2 Collect", status: "complete", method: "Tool", summary: "抓取受限时透明降级到缓存样本与导入数据。", input: "1,248 records", output: "824 live + 424 cached", badge: "rate limited", duration: "31.8s", tokens: "0", cost: "$0.00" },
  { id: "clean", label: "3 Clean", status: "complete", method: "Deterministic", summary: "去空白、去重复、字段归一化。", input: "1,248 raw", output: "1,182 clean", badge: "66 removed", duration: "0.8s", tokens: "0", cost: "$0.00" },
  { id: "analyze", label: "4 Analyze", status: "running", method: "Model-generated", summary: "聚焦付费说明与使用阻力的主题聚合正在生成。", input: "1,182 clean", output: "6 themes", badge: "46%", duration: "46%", tokens: "2.4k", cost: "$0.18" },
  { id: "evidence", label: "5 Evidence", status: "pending", method: "Deterministic", summary: "证据覆盖和冲突证据待汇总。", input: "6 themes", output: "5 findings", badge: "pending", duration: "—", tokens: "—", cost: "—" },
  { id: "prd", label: "6 PRD", status: "pending", method: "Model-generated", summary: "将高置信发现转成需求草案。", input: "5 findings", output: "4 reqs", badge: "pending", duration: "—", tokens: "—", cost: "—" },
  { id: "tests", label: "7 Test cases", status: "pending", method: "Deterministic", summary: "依据需求与证据生成测试用例。", input: "4 reqs", output: "28 cases", badge: "pending", duration: "—", tokens: "—", cost: "—" },
  { id: "validate", label: "8 Validate", status: "pending", method: "Deterministic", summary: "检查链路完整性、假设与断链。", input: "28 cases", output: "trace matrix", badge: "pending", duration: "—", tokens: "—", cost: "—" },
];

export const demoSummaryMetrics = [
  { label: "Reviews collected", value: "1,248", hint: "824 live · 424 cached" },
  { label: "After cleaning", value: "1,182", hint: "66 duplicates / empties removed" },
  { label: "Duplicates removed", value: "51", hint: "3.9% of raw rows" },
  { label: "Languages detected", value: "2", hint: "en-US · zh-Hans" },
  { label: "Model themes", value: "6", hint: "2 high confidence" },
  { label: "Validation issues", value: "3", hint: "2 warnings · 1 assumption" },
];

export const demoReviewRows: DemoReviewRow[] = [
  {
    id: "REV-00421",
    rating: 2,
    date: "2026-07-18",
    version: "7.2",
    locale: "en-US",
    excerpt: "I loved the workouts, but the trial expired before I understood what was included.",
    theme: "Subscription clarity",
    sentiment: "Negative",
    evidenceUsed: "Used in FND-003",
    source: "Sample",
  },
  {
    id: "REV-00818",
    rating: 3,
    date: "2026-07-16",
    version: "7.2.1",
    locale: "en-US",
    excerpt: "The workout library is strong, but the cancellation flow is buried too deep.",
    theme: "Cancellation friction",
    sentiment: "Mixed",
    duplicateOf: "REV-00421",
    evidenceUsed: "Contradiction for FND-003",
    source: "Cached",
  },
  {
    id: "REV-01007",
    rating: 1,
    date: "2026-07-14",
    version: "7.1",
    locale: "zh-Hans",
    excerpt: "订阅弹窗出来得太早，根本没看懂套餐区别。",
    theme: "Subscription clarity",
    sentiment: "Negative",
    evidenceUsed: "Used in FND-003",
    source: "Live",
  },
  {
    id: "REV-01102",
    rating: 4,
    date: "2026-07-13",
    version: "7.2",
    locale: "en-US",
    excerpt: "Great coaching tone, but some audio cues are inconsistent across sessions.",
    theme: "Audio guidance",
    sentiment: "Mixed",
    evidenceUsed: "Used in FND-008",
    source: "Cached",
  },
];

export const demoThemeCards: DemoThemeCard[] = [
  {
    id: "THM-006",
    name: "Subscription cancellation friction",
    summary: "Users keep asking what is included before they are asked to pay.",
    reviews: 84,
    share: "17%",
    avgRating: "2.1",
    confidence: "High",
    trend: "↑ 18% this week",
    conflicts: 4,
    versions: ["7.1", "7.2"],
    languages: ["en-US"],
    spark: [2, 3, 2, 4, 5, 7, 9],
  },
  {
    id: "THM-009",
    name: "Workout plan availability",
    summary: "Workout plans are praised, but users miss clearer progression cues.",
    reviews: 61,
    share: "12%",
    avgRating: "3.4",
    confidence: "Medium",
    trend: "→ stable",
    conflicts: 2,
    versions: ["7.2"],
    languages: ["en-US", "zh-Hans"],
    spark: [5, 4, 5, 6, 5, 6, 6],
  },
  {
    id: "THM-012",
    name: "Audio guidance inconsistency",
    summary: "Some sessions play narration at different times or volume levels.",
    reviews: 37,
    share: "7%",
    avgRating: "3.0",
    confidence: "Medium",
    trend: "↑ 9%",
    conflicts: 1,
    versions: ["7.1", "7.2.1"],
    languages: ["en-US"],
    spark: [1, 2, 2, 3, 2, 4, 4],
  },
];

export const demoFindingCards: DemoFindingCard[] = [
  {
    id: "FND-003",
    title: "订阅价值和取消方式在付费前说明不足",
    severity: "High",
    confidence: "High",
    sampleCount: 7,
    supportingReviews: ["REV-00421", "REV-01007", "REV-00818"],
    stats: "7 independent reviews across 2 app versions.",
    synthesis: "Model-generated synthesis. Verify against cited reviews.",
    contradictingEvidence: ["REV-00818 says pricing is already visible early."],
    limitation: "Collection was rate-limited. Results mix live and clearly labeled cached sample reviews.",
  },
  {
    id: "FND-008",
    title: "音频引导在不同训练会话中存在节奏和音量差异",
    severity: "Medium",
    confidence: "Medium",
    sampleCount: 5,
    supportingReviews: ["REV-01102"],
    stats: "5 reviews, 2 versions, 1 language family.",
    synthesis: "Model-generated synthesis. Verify against cited reviews.",
    contradictingEvidence: ["Some users report the cues are helpful and motivating."],
    limitation: "No clear evidence that the issue affects all workout programs.",
    assumption: true,
  },
];

export const demoRequirements: DemoRequirementCard[] = [
  {
    id: "REQ-004",
    statement: "用户在付费前必须看到套餐包含内容、价格、取消方式与适用范围。",
    priority: "P0",
    targetRelease: "v1",
    sourceFindings: ["FND-003"],
    sourceReviews: ["REV-00421", "REV-01007"],
    acceptanceCriteria: [
      "订阅确认前显式展示价格、内容、取消方式。",
      "需求说明页可回溯到至少 3 条独立评论证据。",
    ],
    confidence: "High",
    status: "Validated",
  },
  {
    id: "REQ-009",
    statement: "训练播放过程中需要稳定的语音提示节奏和统一音量。",
    priority: "P1",
    targetRelease: "v1.1",
    sourceFindings: ["FND-008"],
    sourceReviews: ["REV-01102"],
    acceptanceCriteria: [
      "同一训练会话中的音频提示节奏一致。",
      "不同 session 间音量差异不超过设定阈值。",
    ],
    confidence: "Medium",
    assumption: true,
    status: "Needs evidence",
  },
];

export const demoTestCases: DemoTestCase[] = [
  {
    id: "TC-012",
    title: "Preserve workout access after subscription cancellation attempt",
    type: "Failure recovery",
    priority: "P0",
    requirementId: "REQ-004",
    sourceReviews: ["REV-00421", "REV-00818", "REV-01007"],
    preconditions: ["App installed", "Trial user", "Subscription banner visible"],
    steps: [
      "Open a premium workout.",
      "Inspect subscription explanation before confirmation.",
      "Attempt cancellation flow.",
    ],
    expected: "User can understand pricing and cancel path without losing workout access cues.",
    edgeCases: ["Rate limited collection", "Cached sample used"],
    why: "This test exists because users repeatedly complain about unclear subscription value.",
  },
  {
    id: "TC-018",
    title: "Keep audio guidance volume consistent across sessions",
    type: "UX",
    priority: "P1",
    requirementId: "REQ-009",
    sourceReviews: ["REV-01102"],
    preconditions: ["Two workout sessions", "Audio enabled"],
    steps: [
      "Start session A.",
      "Complete one guided set.",
      "Start session B and compare cue levels.",
    ],
    expected: "Audio cues stay within the documented consistency range.",
    edgeCases: ["Language switch", "Low-volume device"],
    why: "The requirement is still marked as needing evidence, so this test is gated as review-only.",
  },
];

export const demoValidationIssues: DemoValidationIssue[] = [
  {
    id: "VAL-001",
    title: "Unsupported finding removed from final scope",
    status: "Valid",
    path: "Review → Finding → Requirement → Test",
    reviewCount: 3,
    note: "Finding FND-008 is explicitly marked as an assumption and excluded from validated scope.",
    action: "Mark as assumption",
  },
  {
    id: "VAL-002",
    title: "One requirement has no fully validated tests",
    status: "Warning",
    path: "Requirement → Test",
    reviewCount: 1,
    note: "REQ-009 still needs stronger evidence before promotion.",
    action: "Link supporting reviews",
  },
  {
    id: "VAL-003",
    title: "Trace matrix contains a rate-limited live sample",
    status: "Warning",
    path: "Review → Finding",
    reviewCount: 2,
    note: "The live collection was limited; sample data is clearly labeled.",
    action: "Continue with available data",
  },
];

export const demoOverview = {
  summary: {
    strongest: "订阅说明与取消路径是最强的证据链。",
    uncertain: "音频引导一致性还需要更多独立样本。",
    buildV1: "优先交付订阅解释与取消路径优化。",
    defer: "音频一致性放入下一轮验证。",
  },
  versionPlan: [
    { label: "v1", note: "Highest-confidence fixes", count: 1 },
    { label: "v1.1", note: "Medium-confidence improvements", count: 1 },
    { label: "Later", note: "Insufficient evidence or higher risk", count: 2 },
  ],
  deliverables: [
    "Clean dataset",
    "Theme report",
    "Findings",
    "PRD",
    "Test suite",
    "Traceability report",
  ],
};

export const schemaExampleJson = `[
  {
    "review_id": "REV-00421",
    "rating": 2,
    "text": "I loved the workouts, but the trial expired before I understood what was included.",
    "date": "2026-07-18",
    "version": "7.2"
  }
]`;

export const schemaExampleCsv = `review_id,rating,text,date,version,locale
REV-00421,2,"I loved the workouts, but the trial expired before I understood what was included.",2026-07-18,7.2,en-US`;
