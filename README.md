# ReviewTrace

ReviewTrace 将 App Store 用户评论转化为有证据链支撑的产品洞察、PRD 需求、版本规划和 QA 测试用例。

当前版本已经搭建了可运行的 Web 应用骨架：

- `apps/web` 中的 Next.js 前端
- `apps/api` 中的 FastAPI 后端
- 后端健康检查 API
- 示例工作流 API，可返回可追溯的评论、发现、需求和测试用例
- 前后端测试命令

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

点击 **开始分析** 可以调用本地 API，运行内置的示例工作流。

也可以点击 **导入评论** 选择 `.json` 或 `.csv` 文件。导入的数据会走同一个 workflow API，并返回原始评论、清洗结果和基础评分统计。

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
      "appVersion": "2.0.0"
    }
  ]
}
```

CSV 需要表头，当前支持这些字段：

```csv
id,rating,title,body,appVersion
review-001,2,订阅说明不清楚,价格和取消方式需要更明确,2.0.0
```

## 运行测试

```powershell
npm run test
```

## 环境变量

将 `.env.example` 复制为 `.env.local` 后可配置本地前端。不要将 API key 或其他密钥提交到 Git。
