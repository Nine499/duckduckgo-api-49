# CLAUDE.md

See [AGENTS.md](AGENTS.md) for project conventions, layout, common tasks, and traps.

Quick facts:

- DuckDuckGo search CLI for coding agents. TypeScript, ESM, pnpm only, Node >= 18.
- Build: `pnpm run build` (tsc + chmod +x dist/cli.js). Lint: `pnpm exec biome check src/`.
- Never edit `dist/` — compiled output, gitignored. Edit `src/` and rebuild.
- No test files; verification is manual real-network runs of `node dist/cli.js <query>`.
