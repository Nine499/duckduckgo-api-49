# AGENTS.md

## What this is

A DuckDuckGo search CLI for coding agents and LLMs. Takes keywords as args or stdin, prints structured JSON (default) or Markdown to stdout. Exit codes carry status: 0 ok (including zero results), 1 network/rate-limit/refused keyword, 2 invalid args.

It is NOT a library, NOT an official API client — it scrapes `https://html.duckduckgo.com/html/` (unofficial, no-JS endpoint) and parses the result page. Not published to npm; distributed via GitHub, installed globally via `pnpm add -g .` from a clone.

## Stack & Run

- TypeScript, ESM (`"type": "module"`), compiled with `tsc` to `dist/`. Node >= 18 (package.json `engines`). Package manager: pnpm only.
- Runtime deps: `cheerio` (HTML parsing), `undici` (fetch + proxy-aware dispatcher).
- Dev deps: `typescript`, `@types/node`, `@biomejs/biome` (project-local).

```bash
pnpm install            # install deps
pnpm run build          # tsc + chmod +x dist/cli.js
pnpm run typecheck      # tsc --noEmit
pnpm run dev            # tsc --watch
pnpm exec biome check src/     # lint + format check (use --write to fix)
node dist/cli.js <keywords>     # run without linking
```

No test files. Verification is manual real-network runs of `node dist/cli.js`.

## Layout

```text
src/
  cli.ts       entry (#!/usr/bin/env node). Arg parsing (ArgStream class), stdin fallback, exit codes, output dispatch.
  search.ts    fetch + parse. GET to html.duckduckgo.com/html/ with Firefox UA + Accept headers; retry logic; cheerio selectors .result / a.result__a / .result__snippet; unwraps DDG redirect links via uddg param.
  markdown.ts  toMarkdown(): renders SearchResponse for humans.
  types.ts     SearchResultItem {title,url,snippet}, Filters, SearchResponse.
  errors.ts    CliError (invalid_args), NetworkError (network_error), RateLimitError (rate_limited).
  usage.ts     USAGE constant, Chinese help text.
dist/         tsc output. bin target is dist/cli.js.
```

## Conventions

- pnpm only. Never npm/yarn/npx. Run package-local commands via `pnpm exec`.
- Lint/format: project-local Biome, tabs for indentation. `pnpm exec biome check src/` must pass before delivery.
- ESM with `.js` import specifiers even in `.ts` files (`import { search } from "./search.js"`).
- Errors: three semantic classes in `errors.ts`, each maps to a JSON `error.type` string. CliError → exit 2; NetworkError/RateLimitError → exit 1; all printed to stderr as `{"error":{type,message}}` followed by USAGE.
- Error/log messages are Simplified Chinese; code identifiers English.
- User-facing docs in Chinese (README.md), agent docs in English (this file).
- Defaults live in `cli.ts` parseArgs: safe=off, region="", time="", markdown=false. Empty region/time translate to "none"/"any" in the Filters output object.

## Tasks

**Add a CLI option:**
1. `src/usage.ts` — add to USAGE text.
2. `src/cli.ts` — extend `ParsedArgs`, add a `--name value` branch plus `--name=value` branch in `parseArgs`; validate values (throw `CliError` on bad input); map into `Filters` in `main()`.
3. `src/search.ts` — in `fetchOnce`, translate the filter into a DDG query param only when non-default (follow the `kp`/`kl`/`df` pattern).
4. Rebuild (`pnpm run build`), run `pnpm exec biome check src/`, test with a real query.

**Change result parsing (DDG page structure changed):**
1. `src/search.ts` `parseResults()` — selectors live here only. Shell check `$(".results")` distinguishes "zero results" (return `[]`) from "anomaly page" (return `null` → treated as rate-limit and retried).
2. Keep `extractRealUrl` in sync with the redirect format (`//duckduckgo.com/l/?uddg=<encoded>`).

**Change output shape:** `src/types.ts` (types) → `src/markdown.ts` (human rendering) → README output example.

## Traps

- **DDG returns HTTP 202 for: POST requests, requests without an `Accept` header, and queries containing `"exact phrase"` or `site:domain` syntax.** All three are edge-level blocks; retrying/backoff/Referer do not help. The 202-on-syntax case is DDG-side and unfixable here — the CLI surfaces a clear error telling the user to drop the syntax. `filetype:`, `intitle:`, single quotes are fine.
- Requests MUST be GET with `Accept: text/html,...` header and the Firefox UA. See `fetchOnce` comments — do not "simplify" back to POST.
- The `kp` (safe search) param is sent but DDG's HTML endpoint demonstrably ignores it in some networks (verified empirically, same results for every value). Keep sending it; don't promise filtering.
- `kl` (region) and `df` (time range) DO take effect — verified by comparing results across values.
- Result links in the HTML are DDG redirect wrappers (`//duckduckgo.com/l/?uddg=...&rut=...`); always unwrap via `extractRealUrl`, never emit the raw href.
- Snippets contain `<b>` highlight tags — use cheerio `.text()`, not raw HTML.
- `pnpm run build` includes `chmod +x dist/cli.js`; a bare `tsc` invocation will leave dist/cli.js non-executable and the global install broken. Use the script.
- stdin fallback triggers only when there are no positional args AND stdin is not a TTY. Empty piped stdin is an arg error (exit 2), not a search.
- `dist/` is build output (gitignored). Never edit files in `dist/` — edit `src/` and rebuild.
- Direct connections to duckduckgo.com flap in some networks (intermittent ConnectTimeout). That's environment, not a bug; the proxy env vars (`HTTPS_PROXY`/`HTTP_PROXY`/`NO_PROXY`, read automatically by undici `EnvHttpProxyAgent`) exist for that.
- **Global install on pnpm 12: use `pnpm add -g .` only.** `pnpm link --global` is removed in pnpm 12 (hard error), and `pnpm link .` writes a `duckduckgo-api-49: link:.` override into `pnpm-lock.yaml` plus a `pnpm-workspace.yaml` — both residue, both useless (the working global command comes from the `add -g` snapshot). If that residue appears: delete `pnpm-workspace.yaml`, `git checkout -- pnpm-lock.yaml`.
- Global installs are snapshots, not symlinks: after changing code, re-run `pnpm run build && pnpm add -g .` to refresh the installed command. A stale same-name command from an earlier global install can shadow the new one — check with `pnpm list -g`.
