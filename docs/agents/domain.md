# 领域文档

这里说明工程技能在探索代码库时应该如何读取本仓库的领域文档。

## 开始探索前优先读取

- 仓库根目录的 **`CONTEXT.md`**，或
- 仓库根目录的 **`CONTEXT-MAP.md`**，如果它存在。它会指向每个上下文各自的 `CONTEXT.md`，只读取和当前任务相关的部分。
- **`docs/adr/`** 中和当前修改区域相关的 ADR。多上下文仓库还需要检查 `src/<context>/docs/adr/` 下的上下文级决策。

如果这些文件不存在，直接继续即可。不要因为缺少这些文件而报错，也不要提前建议创建它们。`/domain-modeling` skill 会在术语或决策真正需要沉淀时再创建它们。

## 文件结构

单上下文仓库，大多数项目都适用：

```text
/
|-- CONTEXT.md
|-- docs/adr/
|   |-- 0001-event-sourced-orders.md
|   `-- 0002-postgres-for-write-model.md
`-- src/
```

多上下文仓库，根目录存在 `CONTEXT-MAP.md` 时使用：

```text
/
|-- CONTEXT-MAP.md
|-- docs/adr/                          <- 系统级决策
`-- src/
    |-- ordering/
    |   |-- CONTEXT.md
    |   `-- docs/adr/                  <- 上下文级决策
    `-- billing/
        |-- CONTEXT.md
        `-- docs/adr/
```

## 使用术语表中的词汇

当输出中需要命名领域概念时，例如 issue 标题、重构建议、假设或测试名称，优先使用 `CONTEXT.md` 中定义的术语。不要随意漂移到术语表明确避免的同义词。

如果你需要的概念还没有出现在术语表中，这就是一个信号：要么你正在发明项目并未使用的语言，需要重新考虑；要么这里确实存在领域语言空缺，可以记录给 `/domain-modeling`。

## 标出 ADR 冲突

如果输出内容和已有 ADR 冲突，要明确指出，而不是静默覆盖：

> _与 ADR-0007（event-sourced orders）冲突，但值得重新讨论，因为..._
