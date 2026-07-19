# ReviewTrace

ReviewTrace 将 App Store 用户评论转化为有证据链支撑的产品洞察、PRD 需求、版本规划和 QA 测试用例。

当前版本已经提供一条可运行的端到端工作流：

- `apps/web` 中的 Next.js 前端
- `apps/api` 中的 FastAPI 后端
- U.S. App Store 最新评论采集
- JSON / CSV 评论导入兜底
- 评论清洗、去重、评分统计
- 可切换的模型语义分析 provider
- 从评论到发现、需求、版本计划、产品需求文档草案和 QA 用例的追溯链
- 数据限制与追溯校验结果展示

## 环境要求

- Node.js 24 或更新版本
- npm 11 或更新版本
- 通过 Windows `py` 启动器使用 Python 3.14

## 安装依赖

```powershell
npm install
py -m pip install -r apps/api/requirements.txt
```

## 本地运行

```powershell
npm run dev
```

前端会启动在 http://localhost:3000，后端会启动在 http://localhost:8000。

点击 **生成分析报告** 会调用本地 API，从 U.S. App Store 评论源获取最新公开评论，并运行完整工作流。

点击 **运行缓存示例** 可以在离线或网络不稳定时运行内置样例。点击 **选择文件并生成报告** 可以选择 `.json` 或 `.csv` 文件；导入的数据会走同一个 workflow API，并返回原始评论、清洗结果、分类结果、发现、需求、版本计划、产品需求文档草案、QA 用例和追溯校验。

内置离线样例数据位于 `apps/api/src/reviewtrace_api/fixtures/sample_reviews.json`。

## 工作流阶段与技术选择

ReviewTrace 的核心约束是“结论必须能回到具体评论证据”。因此工作流把确定性步骤和模型步骤分开：

| 阶段 | 实现方式 | 选择理由 |
| --- | --- | --- |
| 范围 | 用户目标驱动的评论子集选择 + 模型输出的 `scope` + 确定性兜底 | 用户目标可能包含订阅、低评分、版本或可用性限制，需要先收敛参与语义分析的评论范围，并把范围评论 ID 展示出来。 |
| 评论采集 | 确定性 HTTP 请求 | 数据源和请求频率要可重复、可解释，避免对 Apple RSS 形成重试风暴。 |
| 清洗去重 | 确定性规则 | 空评论剔除、标题正文指纹去重、评分统计都应稳定可复现。 |
| 语义分析 | DeepSeek/OpenAI 模型驱动，缺 key 时兜底 | 主题发现和问题整合需要泛化到未见应用、混合语言和新目标，不能只靠固定关键词。 |
| 证据评估 | 模型置信度 + 确定性校验 | 每个 finding 都要带 reviewId、摘录、样本数、置信度和冲突证据；无效 reviewId 会被剔除。 |
| PRD/版本计划 | 规则化生成并引用模型 finding | 需求、版本和边界必须保持可追溯，低置信度结论会进入假设列表而不是直接变成测试用例。 |
| QA 测试 | 确定性生成 | 测试用例必须直接绑定需求和源评论，避免模型生成不可验证或无证据的步骤。 |
| 追溯校验 | 确定性验证 | 校验 review → finding → requirement → test case 的每条链路，缺证据的结论会被拦截。 |

后端会返回 `analysisScope` 和 `stageReports`。前端会展示分析范围、范围评论 ID、证据信号、约束、不确定性，以及每个阶段的中间结果、修订记录和校验结果。

## App Store 数据源

live 模式仅支持 U.S. App Store 链接，例如：

```text
https://apps.apple.com/us/app/workout-for-women-home-gym/id839285684
```

后端会从 Apple 公开评论 RSS 源读取最新评论：

```text
https://itunes.apple.com/us/rss/customerreviews/page=2/id=<app_id>/sortBy=mostRecent/json
```

已知限制：

- 当前只实现 `us` storefront。
- Apple RSS 返回的是公开最新评论样本，不保证覆盖全部历史评论。
- 网络、代理、Apple 临时限流或返回格式变化会导致 live 采集失败。
- live 采集失败时，界面会提示改用导入评论或缓存示例。
- 小样本会在结果中显示“样本量较小”的数据限制，避免过度解读。

采集策略：

- 每次用户点击 **开始分析** 只发起一次 Apple RSS 请求。
- 当前版本不做自动重试，避免在 Apple 返回错误或网络不稳定时形成重试风暴。
- 如果需要重复分析同一 app，建议优先使用导出的 JSON/CSV 数据走导入模式。
- 如果后续增加缓存，应在 UI 中明确标记“缓存数据”，不能冒充 live 结果。

## 评论导入格式

JSON 支持数组，或包含 `reviews` 字段的对象：

```json
{
  "reviews": [
    {
      "id": "review-001",
      "rating": 2,
      "title": "订阅说明不清楚",
      "body": "价格和取消方式需要更明确。",
      "appVersion": "2.0.0",
      "date": "2026-07-01T00:00:00Z",
      "locale": "zh-CN",
      "appId": "123456789"
    }
  ]
}
```

CSV 需要表头，常用字段如下；`date`、`locale`、`source`、`appId`、`author` 可选：

```csv
id,rating,title,body,appVersion,date,locale,source,appId,author
review-001,2,订阅说明不清楚,价格和取消方式需要更明确,2.0.0,2026-07-01T00:00:00Z,zh-CN,import,123456789,用户A
```

## 运行测试

```powershell
npm run test
```

## 环境变量

将 `.env.example` 复制为 `.env.local` 后可配置本地前端和后端模型。不要将 API key 或其他密钥提交到 Git。

后端模型分析通过环境变量配置：

```powershell
$env:MODEL_PROVIDER="deepseek"
$env:MODEL_NAME="deepseek-v4-flash"
$env:DEEPSEEK_BASE_URL="https://api.deepseek.com"
$env:DEEPSEEK_API_KEY="你的 DeepSeek API key"
```

本地开发时，后端会自动读取仓库根目录下的 `.env.local` 或 `.env`。不配置 `DEEPSEEK_API_KEY` 时，系统会使用明确标注的确定性兜底分析。配置 DeepSeek 后，语义 finding 会通过 DeepSeek 的 OpenAI 兼容 Chat Completions API 生成，并在结果中标记 `modelDriven: true`。

前端启动时会读取 `GET /config/model`，只展示 provider、模型、是否已配置 key 以及当前分析模式，不会返回 key 内容。缺少对应 key 时，工作台会明确提示将使用确定性兜底分析。

## 模型提示与故障处理

主要模型任务位于 `apps/api/src/reviewtrace_api/workflow.py` 的 `build_review_analysis_prompt()`。提示要求模型只返回 JSON，并生成：

- `scope.focusSummary`、`focusAreas`、`dataSignals`、`constraints`、`uncertaintyNotes`、`scopeReviewIds`
- `findings[].id`、`title`、`reviewIds`、`sampleCount`、`confidence`、`conflictingEvidence`

防幻觉策略：

- 模型只接收已清洗、且被当前分析目标选入范围的评论字段和 reviewId。
- prompt 明确要求“只能使用输入评论中存在的证据，不要编造 reviewId、样本数或结论”。
- 后端会重新校验模型返回的 reviewId；没有有效 reviewId 的 finding 会被删除或回退到确定性摘要。
- 冲突证据会重新映射到真实评论摘录，不能直接信任模型生成的文本。
- PRD 和测试用例只从已验证 finding 生成；低置信度 finding 会进入假设列表。
- 最终 `traceabilityValidation` 会检查 finding、requirement、test case 是否都能追溯到清洗后的评论。

故障处理：

- 没有模型 key 时，系统使用 `deterministic-import-summary` 兜底，并在 UI 中标明“确定性兜底”。
- 模型服务不可用时，API 返回可恢复错误，提示检查 key、网络或改用兜底/导入模式。
- live 采集失败或 Apple RSS 返回空数据时，界面提示使用缓存示例或导入评论。

## 工作流输出

每次运行会返回并展示：

- 原始评论与清洗后的评论
- 分类结果，包括模型或兜底方法、范围评论、发现、样本数、置信度和冲突证据数量
- 分析范围、范围评论 ID、证据信号、约束和不确定性
- 每个阶段的中间结果、修订记录、错误和校验摘要
- 评分统计、重复评论数和空评论数
- 模型或兜底分析产生的发现
- 每个发现的评论证据、样本数、置信度和冲突证据
- 从发现生成的需求、优先级、版本范围、边界、验收条件和假设标记
- 产品需求文档草案，包括范围摘要、版本计划、需求、成功指标和假设
- 从需求生成的 QA 测试用例、步骤、验证点和期望结果
- 从 review → finding → requirement → test case 的追溯校验结果

系统不会为缺少证据的结论伪造评论 ID、样本数或确定性。
