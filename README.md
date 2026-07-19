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

点击 **开始分析** 会调用本地 API，从 U.S. App Store 评论源获取最新公开评论，并运行完整工作流。

点击 **使用缓存示例** 可以在离线或网络不稳定时运行内置样例。点击 **导入评论** 可以选择 `.json` 或 `.csv` 文件；导入的数据会走同一个 workflow API，并返回原始评论、清洗结果、发现、需求、版本计划、产品需求文档草案、QA 用例和追溯校验。

内置离线样例数据位于 `apps/api/src/reviewtrace_api/fixtures/sample_reviews.json`。

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

将 `.env.example` 复制为 `.env.local` 后可配置本地前端。不要将 API key 或其他密钥提交到 Git。

后端模型分析通过环境变量配置：

```powershell
$env:MODEL_PROVIDER="openai"
$env:MODEL_NAME="gpt-5.6-sol"
$env:OPENAI_API_KEY="你的 API key"
```

不配置 `OPENAI_API_KEY` 时，系统会使用明确标注的确定性兜底分析。配置 OpenAI 后，语义 finding 会通过 Responses API 生成，并在结果中标记 `modelDriven: true`。

## 工作流输出

每次运行会返回并展示：

- 原始评论与清洗后的评论
- 评分统计、重复评论数和空评论数
- 模型或兜底分析产生的发现
- 每个发现的评论证据、样本数、置信度和冲突证据
- 从发现生成的需求、优先级、版本范围和边界
- 产品需求文档草案
- 从需求生成的 QA 测试用例
- 从 review → finding → requirement → test case 的追溯校验结果

系统不会为缺少证据的结论伪造评论 ID、样本数或确定性。
