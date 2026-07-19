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
  sentiment: "正向" | "混合" | "负向";
  duplicateOf?: string;
  evidenceUsed: string;
  source: "示例" | "缓存" | "实时" | "导入";
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

export const demoApp = {
  appName: "Workout for Women: Fitness App",
  runId: "RUN-2026-0720-014",
  runStatus: "已验证，含 3 个显式假设",
  source: "缓存示例",
  provider: "GPT-5 · OpenAI",
  lastSaved: "2026-07-20 09:24",
  elapsed: "02:18",
  progress: "8 个阶段已完成 4 个",
  exportLabel: "导出",
};

export const demoAppPreview = {
  name: "Workout for Women: Fitness App",
  developer: "Fast Builder Ltd.",
  category: "健康与健身",
  version: "7.2.1",
  rating: "4.6",
  reviews: "8,420",
  storefront: "美国区商店",
  sourceLabel: "示例",
  note: "评论可用性可能受商店地区和限流影响。",
};

export const demoGoalChips = [
  "订阅转化",
  "训练可用性",
  "低评分评论",
  "最新版本",
  "冲突反馈",
  "多语言评论",
];

export const demoScopeLimits = [
  "评分：1–3 星",
  "日期范围：最近 90 天",
  "版本：7.1、7.2、7.2.1",
  "语言：en-US、zh-Hans",
  "最大评论数：1,500",
  "最小证据阈值：3 条独立评论",
  "采集失败时包含缓存示例",
];

export const demoStages = [
  { id: "scope", label: "1 范围", status: "complete", method: "规则", summary: "收敛到订阅转化、训练可用性与取消路径。", input: "108 条评论", output: "3 个重点范围", badge: "2 个警告", duration: "12.4s", tokens: "0", cost: "$0.00" },
  { id: "collect", label: "2 收集", status: "complete", method: "工具", summary: "抓取受限时透明降级到缓存样本与导入数据。", input: "1,248 条记录", output: "824 条实时 + 424 条缓存", badge: "已限流", duration: "31.8s", tokens: "0", cost: "$0.00" },
  { id: "clean", label: "3 清洗", status: "complete", method: "确定性", summary: "去空白、去重复、字段归一化。", input: "1,248 条原始", output: "1,182 条清洗后", badge: "移除 66 条", duration: "0.8s", tokens: "0", cost: "$0.00" },
  { id: "analyze", label: "4 分析", status: "pending", method: "模型生成", summary: "点击开始分析后运行主题聚合。", input: "1,182 条清洗后", output: "待生成", badge: "等待启动", duration: "—", tokens: "—", cost: "—" },
  { id: "evidence", label: "5 证据", status: "pending", method: "确定性", summary: "证据覆盖和冲突证据待汇总。", input: "6 个主题", output: "5 个发现", badge: "等待中", duration: "—", tokens: "—", cost: "—" },
  { id: "prd", label: "6 PRD", status: "pending", method: "模型生成", summary: "将高置信发现转成需求草案。", input: "5 个发现", output: "4 条需求", badge: "等待中", duration: "—", tokens: "—", cost: "—" },
  { id: "tests", label: "7 测试用例", status: "pending", method: "确定性", summary: "依据需求与证据生成测试用例。", input: "4 条需求", output: "28 个用例", badge: "等待中", duration: "—", tokens: "—", cost: "—" },
  { id: "validate", label: "8 验证", status: "pending", method: "确定性", summary: "检查链路完整性、假设与断链。", input: "28 个用例", output: "追溯矩阵", badge: "等待中", duration: "—", tokens: "—", cost: "—" },
];

export const demoSummaryMetrics = [
  { label: "已收集评论", value: "1,248", hint: "824 条实时 · 424 条缓存" },
  { label: "清洗后评论", value: "1,182", hint: "移除 66 条重复/空内容" },
  { label: "已去重", value: "51", hint: "占原始行 3.9%" },
  { label: "识别语言", value: "2", hint: "en-US · zh-Hans" },
  { label: "模型主题", value: "6", hint: "2 个高置信主题" },
  { label: "验证问题", value: "3", hint: "2 个警告 · 1 个假设" },
];

export const demoReviewRows: DemoReviewRow[] = [
  {
    id: "REV-00421",
    rating: 2,
    date: "2026-07-18",
    version: "7.2",
    locale: "en-US",
    excerpt: "我喜欢训练内容，但还没弄清楚订阅包含什么，试用就结束了。",
    theme: "订阅说明清晰度",
    sentiment: "负向",
    evidenceUsed: "用于 FND-003",
    source: "示例",
  },
  {
    id: "REV-00818",
    rating: 3,
    date: "2026-07-16",
    version: "7.2.1",
    locale: "en-US",
    excerpt: "训练库不错，但取消订阅的入口藏得太深。",
    theme: "取消订阅阻力",
    sentiment: "混合",
    duplicateOf: "REV-00421",
    evidenceUsed: "作为 FND-003 的冲突证据",
    source: "缓存",
  },
  {
    id: "REV-01007",
    rating: 1,
    date: "2026-07-14",
    version: "7.1",
    locale: "zh-Hans",
    excerpt: "订阅弹窗出来得太早，根本没看懂套餐区别。",
    theme: "订阅说明清晰度",
    sentiment: "负向",
    evidenceUsed: "用于 FND-003",
    source: "实时",
  },
  {
    id: "REV-01102",
    rating: 4,
    date: "2026-07-13",
    version: "7.2",
    locale: "en-US",
    excerpt: "教练语气很好，但不同训练里的语音提示不太一致。",
    theme: "音频引导",
    sentiment: "混合",
    evidenceUsed: "用于 FND-008",
    source: "缓存",
  },
];

export const demoThemeCards: DemoThemeCard[] = [
  {
    id: "THM-006",
    name: "订阅取消阻力",
    summary: "用户在付费前反复询问套餐到底包含什么。",
    reviews: 84,
    share: "17%",
    avgRating: "2.1",
    confidence: "高",
    trend: "本周 ↑ 18%",
    conflicts: 4,
    versions: ["7.1", "7.2"],
    languages: ["en-US"],
    spark: [2, 3, 2, 4, 5, 7, 9],
  },
  {
    id: "THM-009",
    name: "训练计划可用性",
    summary: "训练计划受到认可，但用户希望看到更清晰的进度提示。",
    reviews: 61,
    share: "12%",
    avgRating: "3.4",
    confidence: "中",
    trend: "→ 稳定",
    conflicts: 2,
    versions: ["7.2"],
    languages: ["en-US", "zh-Hans"],
    spark: [5, 4, 5, 6, 5, 6, 6],
  },
  {
    id: "THM-012",
    name: "音频引导不一致",
    summary: "部分训练会话的旁白时间点或音量不一致。",
    reviews: 37,
    share: "7%",
    avgRating: "3.0",
    confidence: "中",
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
    severity: "高",
    confidence: "高",
    sampleCount: 7,
    supportingReviews: ["REV-00421", "REV-01007", "REV-00818"],
    stats: "跨 2 个应用版本的 7 条独立评论。",
    synthesis: "模型生成归纳，请对照引用评论核验。",
    contradictingEvidence: ["REV-00818 表示价格在较早阶段已经可见。"],
    limitation: "采集曾被限流。结果混合实时数据和明确标记的缓存示例。",
  },
  {
    id: "FND-008",
    title: "音频引导在不同训练会话中存在节奏和音量差异",
    severity: "中",
    confidence: "中",
    sampleCount: 5,
    supportingReviews: ["REV-01102"],
    stats: "5 条评论，覆盖 2 个版本、1 个语言族。",
    synthesis: "模型生成归纳，请对照引用评论核验。",
    contradictingEvidence: ["部分用户认为语音提示很有帮助，也能带来动力。"],
    limitation: "尚无明确证据证明该问题影响所有训练计划。",
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
    confidence: "高",
    status: "已验证",
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
    confidence: "中",
    assumption: true,
    status: "证据不足",
  },
];

export const demoTestCases: DemoTestCase[] = [
  {
    id: "TC-012",
    title: "尝试取消订阅后仍保留训练访问提示",
    type: "失败恢复",
    priority: "P0",
    requirementId: "REQ-004",
    sourceReviews: ["REV-00421", "REV-00818", "REV-01007"],
    preconditions: ["已安装应用", "试用用户", "订阅横幅可见"],
    steps: [
      "打开一个高级训练课程。",
      "在确认前查看订阅说明。",
      "尝试进入取消订阅流程。",
    ],
    expected: "用户能理解价格和取消路径，并且不会丢失训练访问提示。",
    edgeCases: ["采集被限流", "使用缓存示例"],
    why: "该测试存在是因为用户反复抱怨订阅价值说明不清。",
  },
  {
    id: "TC-018",
    title: "保持不同训练会话中的语音引导音量一致",
    type: "体验",
    priority: "P1",
    requirementId: "REQ-009",
    sourceReviews: ["REV-01102"],
    preconditions: ["两个训练会话", "已开启音频"],
    steps: [
      "开始训练会话 A。",
      "完成一个带引导的训练组。",
      "开始训练会话 B，并比较提示音量。",
    ],
    expected: "音频提示保持在文档规定的一致性范围内。",
    edgeCases: ["切换语言", "设备音量较低"],
    why: "该需求仍被标记为证据不足，因此测试仅作为待审用例。",
  },
];

export const demoValidationIssues: DemoValidationIssue[] = [
  {
    id: "VAL-001",
    title: "无支撑发现已从最终范围中移除",
    status: "有效",
    path: "评论 → 发现 → 需求 → 测试",
    reviewCount: 3,
    note: "FND-008 已明确标记为假设，并排除在已验证范围之外。",
    action: "标记为假设",
  },
  {
    id: "VAL-002",
    title: "一条需求还没有完全验证的测试",
    status: "警告",
    path: "需求 → 测试",
    reviewCount: 1,
    note: "REQ-009 在提升前仍需要更强证据。",
    action: "关联支持评论",
  },
  {
    id: "VAL-003",
    title: "追溯矩阵包含被限流影响的实时样本",
    status: "警告",
    path: "评论 → 发现",
    reviewCount: 2,
    note: "实时采集受到限制；示例数据已清晰标记。",
    action: "使用可用数据继续",
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
    { label: "v1", note: "最高置信度修复", count: 1 },
    { label: "v1.1", note: "中等置信度改进", count: 1 },
    { label: "后续", note: "证据不足或风险较高", count: 2 },
  ],
  deliverables: [
    "清洗数据集",
    "主题报告",
    "发现",
    "PRD",
    "测试套件",
    "追溯报告",
  ],
};

export const schemaExampleJson = `[
  {
    "review_id": "REV-00421",
    "rating": 2,
    "text": "我喜欢训练内容，但还没弄清楚订阅包含什么，试用就结束了。",
    "date": "2026-07-18",
    "version": "7.2"
  }
]`;

export const schemaExampleCsv = `review_id,rating,text,date,version,locale
REV-00421,2,"我喜欢训练内容，但还没弄清楚订阅包含什么，试用就结束了。",2026-07-18,7.2,en-US`;
