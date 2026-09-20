# AGENTS.md

## Golden rules

### Deployments go through Git — NOT Vercel
- We **self-host on the VPS** (`vps725503`) and **deploy via Git**. Vercel is **not** used for this project and references to Vercel in code, docs, or workflows are stale.
- The deploy path is: **commit → push to `main` → merge the PR → GitHub Actions self-hosted runner builds on the VPS and restarts the service**.
- Do not create Vercel deployments, use the Vercel API/token, or modify Vercel env vars. Treat `scripts/vercel-tool.mjs` and `NEXT_PUBLIC_*` Vercel env hooks as obsolete.
- Environment configuration lives on the VPS at `/srv/ybw-frontend/.env.local`, not in Vercel.

## Deployment process (source of truth: `.github/workflows/deploy-vps.yml`)
1. `main` is a **protected branch**:
   - Direct pushes are rejected (`GH006`).
   - Changes **must** go through a pull request.
   - The **`Vitest`** status check is required and must pass (self-hosted runner; local Mac may fail one ga4/OpenSSL-3 test — CI is the source of truth).
2. Merge a PR to `main` → GitHub Actions workflow `deploy-vps.yml` (self-hosted runner on `vps725503`, ~5–15 min) does:
   - `git fetch` + `reset --hard` `/srv/ybw-frontend` to the merge SHA.
   - `pnpm install --frozen-lockfile` + `pnpm build` (NODE_OPTIONS `--max-old-space-size=3072`, 720s watchdog).
   - `systemctl restart ybw-frontend.service` (+ `ybw-frontend-tls.service`).
3. To ship a fix:
   - Create a branch off `main`, commit, push, open a PR with `gh pr create` (base `main`).
   - Wait for the Vitest check to pass, then merge. The VPS runner auto-deploys.

## Local verification commands
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Tests: `pnpm test`

## Other notes
- Postgres (magazine/store backend) is reached through an existing SSH tunnel at `127.0.0.1:5432` (db `ybw_magazine`, user `ybw_app`). `psql` is not installed locally — use `node -e` with `require('pg')` from the repo root.
- Secrets/passwords are never committed or logged (see `HANDOFF-magazine-postgres-migration.md` for VPS specifics).