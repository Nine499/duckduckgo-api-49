# duckduckgo-api-49

面向编程 Agent / 大语言模型的 DuckDuckGo 搜索 CLI。输入关键词，输出结构化 JSON（默认）或 Markdown，专为 Agent 消费设计。

## 快速开始

不发布到 NPM，从 GitHub 克隆后本地安装（要求 Node >= 18、pnpm）：

```bash
git clone git@github.com:Nine499/duckduckgo-api-49.git
cd duckduckgo-api-49
pnpm install && pnpm run build && pnpm link --global
```

装好后在任意目录执行：

```bash
duckduckgo-api-49 rust async runtime
```

正常返回结构化 JSON。卸载：`pnpm unlink --global duckduckgo-api-49`。

## 用法

```bash
duckduckgo-api-49 <关键词...> [选项]
echo <关键词> | duckduckgo-api-49 [选项]
```

- 关键词可直接跟多个参数（自动空格拼接），也可从 stdin 管道读入
- 终端里直接敲命令名（无参数无管道）→ 打印用法，退出码 0
- 无关键词但 stdin 传了空内容 → 参数错误，退出码 2

### 选项

| 选项 | 取值 | 默认 | 说明 |
|---|---|---|---|
| `--markdown` / `-m` | — | JSON | 输出 Markdown（人类阅读） |
| `--safe` | `off` / `moderate` / `strict` | `off` | 安全搜索 |
| `--region` | DDG 地区代码，如 `cn-zh`、`us-en`、`de-de` | 不限 | 国家和地区 |
| `--time` | `d` / `w` / `m` / `y` | 不限 | 搜索时间范围（天/周/月/年） |
| `--help` / `-h` | — | — | 显示帮助 |

所有选项支持 `--safe=strict` 形式。非法取值（如 `--time=x`）→ 错误 JSON + 退出码 2。

### 输出

JSON 模式（默认，给 Agent）：

```json
{
  "query": "rust async runtime",
  "filters": { "safe_search": "off", "region": "none", "time_range": "any" },
  "count": 10,
  "results": [
    { "title": "…", "url": "https://…", "snippet": "…" }
  ]
}
```

每条结果 `{ title, url, snippet }`；`url` 已从 DuckDuckGo 重定向解出真实地址。默认过滤条件下 `filters` 三个字段分别是 `"off"` / `"none"` / `"any"`。

错误时 stderr 输出：

```json
{
  "error": { "type": "…", "message": "…" }
}
```

`type` 取值：`invalid_args`（参数错）、`network_error`（网络失败 / DDG 拒绝关键词）、`rate_limited`（限流重试后仍失败）。

### 退出码

| 退出码 | 含义 |
|---|---|
| 0 | 成功（含零结果） |
| 1 | 网络失败、被限流、DDG 拒绝关键词 |
| 2 | 参数错误 |

### 代理

自动读取 `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` 环境变量：

```bash
HTTPS_PROXY=http://127.0.0.1:7890 duckduckgo-api-49 openai news
```

## Agent 集成示例

```bash
# 基本搜索
duckduckgo-api-49 "tokio vs async-std"

# 管道传入（含特殊字符更稳）
echo "rust web framework" | duckduckgo-api-49

# 限定近一周 + 日本地区
duckduckgo-api-49 rust news --time=w --region=jp-jp

# 给人看的结果
duckduckgo-api-49 rust --markdown
```

## 常见问题 / 踩坑

- **关键词含 `"精确匹配"` 或 `site:域名` 直接报错**：DDG 的 HTML 端点对这类搜索语法恒定返回 202 拒绝页（实测与频率、退避、请求头无关），CLI 会提示去掉语法重试。`filetype:`、`intitle:`、单引号不受影响。
- **`--safe` 效果由服务端决定**：参数会传给 DDG（`kp`），但实测其 HTML 端点在部分网络环境下不执行过滤，各取值返回相同结果。参数保留，效果不保证。
- **偶尔一次失败**：DDG 限流（403/429）会自动退避 3 秒重试一次；直连 DDG 时通时断的网络下，重跑一遍通常就通，或设 `HTTPS_PROXY`。
- **结果条数**：单次约 10 条（HTML 端点单页全部），不支持翻页。

## 项目结构

```text
duckduckgo-api-49/
├── src/
│   ├── cli.ts        # 入口：参数解析、stdin、退出码
│   ├── search.ts     # 抓取 html.duckduckgo.com + 解析结果页
│   ├── markdown.ts   # Markdown 渲染
│   ├── types.ts      # 类型定义
│   ├── errors.ts     # 三类错误
│   └── usage.ts      # 帮助文案
├── dist/             # tsc 编译产物（bin 指向 dist/cli.js）
├── package.json
└── tsconfig.json
```

## 开发

```bash
pnpm run build      # tsc 编译到 dist/ 并给 dist/cli.js 加执行位
pnpm run typecheck  # 类型检查（不产出文件）
pnpm run dev        # tsc 监听模式
pnpm exec biome check src/   # 代码检查
```

项目无测试文件，验证靠手动跑真实搜索。

- Agent 文档：[AGENTS.md](AGENTS.md)
- MIT License
