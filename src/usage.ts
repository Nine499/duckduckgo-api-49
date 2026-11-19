export const USAGE = `duckduckgo-api-49 — 面向 Agent 的 DuckDuckGo 搜索 CLI

用法
  duckduckgo-api-49 <关键词...> [选项]
  echo <关键词> | duckduckgo-api-49 [选项]

选项
  --markdown, -m    输出 Markdown（人类阅读），默认输出 JSON
  --safe <值>       安全搜索：off（默认）/ moderate / strict
  --region <值>     国家和地区：DDG 地区代码（如 cn-zh、us-en），默认不限
  --time <值>       搜索时间范围：d（天）/ w（周）/ m（月）/ y（年），默认不限
  --help, -h        显示本帮助

所有选项也支持 --safe=off 形式。

输出
  JSON 模式输出 { query, filters, count, results[] }，
  每条结果为 { title, url, snippet }。
  错误时 stderr 输出 { error: { type, message } }。

退出码
  0 成功（含零结果）    1 网络失败或被限流    2 参数错误

示例
  duckduckgo-api-49 rust async runtime
  duckduckgo-api-49 "LLM agent framework" --markdown
  echo "token bucket" | duckduckgo-api-49 --time=m
  HTTPS_PROXY=http://127.0.0.1:7890 duckduckgo-api-49 openai news

`;
