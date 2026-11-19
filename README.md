# duckduckgo-api-49

面向编程 Agent / 大语言模型的 DuckDuckGo 搜索 CLI。输入关键词，输出结构化 JSON 或 Markdown，专为 Agent 消费设计。

## 安装

不发布到 NPM。从 GitHub 克隆后本地安装：

```bash
git clone git@github.com:Nine499/duckduckgo-api-49.git
cd duckduckgo-api-49
pnpm install
pnpm run build
pnpm link --global
```

之后即可在任意目录执行 `duckduckgo-api-49`。要求：Node >= 18，pnpm。

## 用法

```bash
duckduckgo-api-49 <关键词...> [选项]
echo <关键词> | duckduckgo-api-49 [选项]
```

### 选项

| 选项 | 取值 | 默认 | 说明 |
|---|---|---|---|
| `--markdown` / `-m` | — | JSON | 输出 Markdown（人类阅读） |
| `--safe` | `off` / `moderate` / `strict` | `off` | 安全搜索 |
| `--region` | DDG 地区代码，如 `cn-zh`、`us-en`、`de-de` | 不限 | 国家和地区 |
| `--time` | `d` / `w` / `m` / `y` | 不限 | 搜索时间范围（天/周/月/年） |
| `--help` / `-h` | — | — | 显示帮助 |

所有选项支持 `--safe=strict` 形式。

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

每条结果：`{ title, url, snippet }`。`url` 已从 DuckDuckGo 重定向解出真实地址。

错误时 stderr 输出 `{ "error": { "type, message" } }`，同时打印用法。

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

# 管道传入
echo "rust web framework" | duckduckgo-api-49

# 限定近一周 + 日本地区
duckduckgo-api-49 rust news --time=w --region=jp-jp

# 给人看的结果
duckduckgo-api-49 rust --markdown
```

## 已知限制

- **搜索语法被拦**：关键词含双引号精确匹配（`"..."`）或 `site:域名` 时，DuckDuckGo 的 HTML 端点恒定返回 202 拒绝页（与频率无关，已实测）。此时 CLI 报错并提示去掉语法。`filetype:`、`intitle:`、单引号不受影响。
- **安全搜索效果由服务端决定**：`--safe` 参数会传给 DDG，但实测其 HTML 端点在部分网络环境下不执行过滤。参数保留，效果不保证。
- **结果条数**：单次返回约 10 条（DDG HTML 端点单页全部），不支持翻页。
- 数据来源是 `html.duckduckgo.com`（非官方端点），高频调用可能触发限流；CLI 会退避 3 秒重试一次。

## 开发

```bash
pnpm run build      # tsc 编译到 dist/
pnpm run typecheck  # 类型检查
pnpm exec biome check src/   # 代码检查
```

MIT License.
