# CLAUDE.md

See [AGENTS.md](AGENTS.md) for project conventions, layout, common tasks, and traps.

Quick facts:

- DuckDuckGo search CLI for coding agents. TypeScript, ESM, pnpm only, Node >= 18.
- Build: `pnpm run build` (tsc + chmod +x dist/cli.js). Lint: `pnpm exec biome check src/`.
- Never edit `dist/` — compiled output, gitignored. Edit `src/` and rebuild.
- No test files; verification is manual real-network runs of `node dist/cli.js <query>`.

## Versioning rule (mandatory)

Any code change that produces a new version MUST bump `package.json` `version` using the time-version-49 skill (`uv run --no-project ~/.claude/skills/time-version-49/scripts/time-version.py` → `YYYYMMDD.HHMM.SSMS`, e.g. `20261119.2033.5833`). Apply before commit, in the same commit as the code change. Docs-only changes do not bump the version.
