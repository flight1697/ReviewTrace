# Issue tracker：GitHub

本仓库的 issue 和 PRD 存放在 GitHub Issues 中。所有操作优先使用 `gh` CLI。

## 约定

- **创建 issue**：`gh issue create --title "..." --body "..."`。多行正文使用 heredoc。
- **读取 issue**：`gh issue view <number> --comments`，需要时用 `jq` 过滤评论并读取标签。
- **列出 issue**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，并按需要添加 `--label` 和 `--state` 过滤。
- **评论 issue**：`gh issue comment <number> --body "..."`
- **添加 / 移除标签**：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **关闭 issue**：`gh issue close <number> --comment "..."`

仓库信息从 `git remote -v` 推断；在 clone 内运行时，`gh` 通常会自动识别。

## Pull request 是否作为 triage 入口

**PRs as a request surface: no.** 如果本仓库以后把外部 PR 当作功能请求入口，可以把这里改成 `yes`，`/triage` 会读取这个标记。

当设置为 `yes` 时，PR 使用和 issue 相同的标签与状态流转，并通过对应的 `gh pr` 命令操作：

- **读取 PR**：`gh pr view <number> --comments`，用 `gh pr diff <number>` 查看 diff。
- **列出需要 triage 的外部 PR**：`gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`，然后只保留 `authorAssociation` 为 `CONTRIBUTOR`、`FIRST_TIME_CONTRIBUTOR` 或 `NONE` 的 PR，过滤掉 `OWNER`、`MEMBER`、`COLLABORATOR`。
- **评论 / 打标签 / 关闭**：`gh pr comment`、`gh pr edit --add-label` / `--remove-label`、`gh pr close`。

GitHub 的 issue 和 PR 共享同一套编号空间，所以裸编号 `#42` 可能是 issue，也可能是 PR。先用 `gh pr view 42` 判断，失败后再回退到 `gh issue view 42`。

## 当 skill 说“发布到 issue tracker”

创建一个 GitHub issue。

## 当 skill 说“获取相关 ticket”

运行 `gh issue view <number> --comments`。

## Wayfinding 操作

`/wayfinder` 使用这些约定。**map** 是一个单独的 issue，下面挂 **child** issues 作为 tickets。

- **Map**：一个带有 `wayfinder:map` 标签的 issue，正文保存 Notes / Decisions-so-far / Fog。使用 `gh issue create --label wayfinder:map` 创建。
- **Child ticket**：通过 GitHub sub-issue 关系挂到 map 上。如果仓库没有启用 sub-issues，则在 map 正文里添加任务列表，并在 child issue 正文顶部写 `Part of #<map>`。标签使用 `wayfinder:<type>`，例如 `research`、`prototype`、`grilling`、`task`。一旦被领取，这个 ticket 会分配给当前负责的开发者。
- **阻塞关系**：优先使用 GitHub 原生 issue dependencies。使用 `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` 添加关系，其中 `<blocker-db-id>` 是 blocker 的数字数据库 ID，可通过 `gh api repos/<owner>/<repo>/issues/<n> --jq .id` 获取，不是 `#number` 或 `node_id`。GitHub 会通过 `issue_dependencies_summary.blocked_by` 报告仍打开的 blocker。如果 dependencies 不可用，则在 child issue 正文顶部写 `Blocked by: #<n>, #<n>`。当所有 blocker 都关闭时，ticket 即解除阻塞。
- **Frontier query**：列出 map 下仍打开的 children，过滤掉仍有打开 blocker 或已有 assignee 的 ticket，按 map 顺序取第一个。
- **领取**：`gh issue edit <n> --add-assignee @me`，这是会话中的第一个写操作。
- **解决**：`gh issue comment <n> --body "<answer>"`，然后 `gh issue close <n>`，再把上下文指针追加到 map 的 Decisions-so-far。
