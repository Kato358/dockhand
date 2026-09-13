# 汉化流水线（zh-CN）

本仓库通过三个依次衔接的 GitHub Actions 工作流，实现"同步上游 → 汉化 → 发布镜像"的全自动流水线：

```
┌────────────────────┐   gh workflow run   ┌────────────────────┐   gh workflow run   ┌────────────────────┐
│ 1 sync-upstream    │ ──────────────────▶ │ 2 localize         │ ──────────────────▶ │ 3 docker-publish   │
│ 上游 Finsys/dockhand│  （仅当 main 推进）  │ 从 main 重建        │  （仅当有翻译变更    │ 从 localized 分支    │
│ 合并进 main        │                     │ localized 分支并    │   或 force_build）  │ 构建并推送镜像       │
└────────────────────┘                     │ 应用 zh-CN 翻译    │                     └────────────────────┘
                                           └────────────────────┘
```

| 工作流 | 文件 | 触发方式 |
| --- | --- | --- |
| Sync upstream | `.github/workflows/sync-upstream.yml` | 每日定时（UTC 21:00）+ 手动 |
| Localize (zh-CN) | `.github/workflows/localize.yml` | 由 1 触发 + 手动 |
| Build & publish Docker image | `.github/workflows/docker-publish.yml` | 由 2 触发 + 手动 |

每个工作流也可以在 Actions 页面单独手动运行（例如只改了词典，手动跑工作流 2 并勾选 force_build；或手动跑工作流 1 勾选 force）。

## 关键设计

- **翻译不进 main**：工作流 2 每次从 main 全新创建 `localized` 分支，应用翻译后强推该分支。
  main 保持接近上游镜像，因此每日同步永远不会和翻译产生合并冲突。
- **精确替换**：`apply.mjs` 只处理 `src/**/*.svelte`，且只做整词精确匹配：
  - 引号字面量：`"Stop"` / `'Stop'` / `` `Stop` ``（覆盖 `title=`、`label=` 等属性和字符串 props）；
  - 标记文本节点：`>Stop<`（含两侧空白）。
  大小写敏感、不做子串替换、脚本幂等；服务端 `*.ts/*.js` 一律不动，避免破坏 API 逻辑。
- **过时词典可感知**：上游改了文案导致某条词典未命中时，脚本会在日志和 Job Summary 里列出 stale 条目，方便更新词典。

## 如何补充翻译

1. 编辑 `l10n/zh-CN.json`，键必须是源码里**逐字出现的英文串**（注意标点和省略号 `...`）。
   可在 `src/routes`、`src/lib/components` 里搜索原文。
2. 本地预览：`node l10n/apply.mjs --dry-run` 看命中统计（会改文件的话先在分支上试，`git checkout -- src` 还原）。
3. 提交词典后手动运行工作流 2（Localize），勾选 **force_build**，即可产出新镜像。

## 镜像产物

- 主镜像（amd64 + arm64）：`ghcr.io/<owner>/<repo>:v1.0.47`、`:latest`
- 老CPU 基线镜像（仅 amd64，musl）：`...:v1.0.47-baseline`、`:baseline`
- 若配置了仓库 Secrets `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`，同名镜像会同步推到 Docker Hub `<DOCKERHUB_USERNAME>/dockhand`。

## 注意事项

- 本公开镜像仓库不含 `package-lock.json`（上游私有流水线生成），工作流 3 会在构建前用
  `npm install --package-lock-only` 自动补生成；若上游某天把 lockfile 发布进仓库，则跳过该步骤。
- arm64 构建在 QEMU 模拟下编译原生模块，耗时较长（整个 job 可能 30–90 分钟），属正常现象。
- 若工作流 1 报合并冲突，需按错误提示在本地手动合并解决后推送，再重跑工作流 1（勾选 force）。
