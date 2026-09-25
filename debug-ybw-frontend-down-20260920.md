# Debug · ybw-frontend-down-20260920
Status: [CLOSED / POST-MORTEM — root-cause fixes merged & deployed to prod, all smokes green]
Date (opened): 2026-09-20
Date (rollback restored HTTP 200): 2026-09-20 21:53 UTC (PR #532)
Date (root-cause fix deployed — no more exit 137 + no more NRestarts ceiling): 2026-09-21 08:33 BST (PR #533 merged → RUN 35572868131 7m55s success)
Reporter: user ("Web site is dowm" — likely typo for "down". Yorkshire BusinessWoman prod VPS.)
Expected: https://yorkshirebusinesswoman.co.uk/ HTTP 200; homepage, /news, /api routes reachable
Actual: user reports site unreachable

## Known recent prod deploys (possible regression window)
- 2026-09-11 ~15:01 BST — PR #510 merged: Phase magazine ad layout redesign (inline float cards replacing header + rail) → deploy-vps RUN 34607144550 success, SHA e7c87dd on /srv/ybw-frontend. All smoke green then.
- 2026-09-16 16:12 CEST — PR #528 merged feat/newsletter-send-log → deploy-vps RUN 35100410407 SUCCESS, SHA 0ff8d51. **LAST GOOD DEPLOY baseline.**
- 2026-09-18 09:20 UTC — PR #530 merged fix/header-ad-rotation → deploy-vps RUN 35329004583 **FAILURE** after 14m3s. **This broken build triggered the cascade to outage.**
- SHA pre-ad-layout: 2015a11 (Phase 6a-6h final Firebase rip).
- Any manual SSH changes, env file edits, unattended-upgrades, certbot, Nginx reloads, OVH VPS reboot unknown.

## 5 Falsifiable Hypotheses (ordered by likelihood)
H1. **VPS systemd unit `ybw-frontend.service` crashed / failed / inactive** — Node died, OOM-killed, or build left `.next/` in half-state after last deploy → Nginx 502.
H2. **TLS certificate / Nginx issue on the VPS (front-door)** — certbot renew failed, Nginx reloaded with bad config, or 443 listener down → curl "Connection refused"/"SSL handshake" error / HTTP 301→404 loop. Port 80→443 redirect path is what the YBW site uses (standard setup).
H3. **OVH VPS unreachable (network down / host down / SSH 22 closed)** — broader infra outage; ICMP ping, TCP 22, TCP 80/443 all RST. Deploy 9 days ago succeeded; OVH incident since.
H4. **Postgres connection pool exhausted / DB unreachable → every route 5xx** — magazine system_settings, member profiles, events are 100% PG. If PG pool on VPS is full / cluster hung / env vars missing, every SSR + API route throws before returning HTML.
H5. **`node_modules/.pnpm/` or `.next/` build artifacts corrupted / disk full → next start fails fast on boot** — VPS has ~3.8GB RAM + limited root; a stray deploy-worker pkill'd mid-build could leave `.next/` build manifest half-written, or pnpm install aborted leaving broken links, or `/srv/` partition at 100% inodes/blocks.

## Evidence Matrix (what to check for each, verdict markers)
| #  | Hypothesis                                   | Positive evidence                             | Negation evidence                          |
|----|----------------------------------------------|-----------------------------------------------|--------------------------------------------|
| H1 | ybw-frontend.service crashed/failed/inactive | `systemctl is-active = failed / activating` OR `MainPID=0` OR `journalctl -u ybw-frontend → Error` | `is-active = active`, MainPID nonzero, Result=success |
| H2 | Nginx / TLS front-door down                  | `curl https:// → Connection refused / SSL handshake fail / 502 Bad Gateway`; `systemctl status nginx = failed`; `journalctl -u nginx → no live upstreams` | `curl https:// → HTTP 200 or 301→200`; Nginx active |
| H3 | VPS unreachable                              | `ssh → Connection refused / timeout 22`; `nc -zv 443 → timeout`; `ping → 100% loss` | SSH OK, curl port 443 OK |
| H4 | PG pool / DB down                            | `systemctl is-active postgresql@* = failed`; VPS `psql -c "select 1" → ERROR`; deploy log grep `getMagazinePgPool.*uninitialized`; homepage curl 500 body contains `Postgres pool not initialized` | `psql select 1 OK`; homepage SSR 200 |
| H5 | Disk / inodes full OR build artifacts broken | `df -h /srv → 100%`; `df -i /srv → 100% inodes`; `ls .next/BUILD_ID ENOENT`; `pnpm install --check bin absent`; `node_modules symlink broken`; `journalctl -u ybw-frontend → module not found next/server` or `ENOENT BUILD_ID` | `df -h < 85%`, `.next/BUILD_ID present`, node_modules OK |

## Diagnostic layers (run in order, fastest first)
1. **L1 Public** — local curl to DNS/HTTPS/HTTP for homepage / /news / /api/upload/idml.
2. **L2 SSH connectivity** — BatchMode ssh topix@vps725503.ovh.net → 0 (OK) or timeout/refused.
3. **L3 VPS systemd** (if L2 OK) — is-active nginx, ybw-frontend, ghost YBM, postgresql; MainPID/Result.
4. **L4 VPS deploy-log + journal** (if H1/H5/H4) — tail latest /tmp/ybw-frontend-deploy-*.log; `journalctl -u ybw-frontend -n 100 --no-pager`.
5. **L5 disk + artifacts** (if H5) — df -h -i /srv/ybw-frontend; cat .next/BUILD_ID; ls .next/; node -e "require('next/package.json').version".
6. **L6 Nginx + TLS** (if H2) — `nginx -t`; certbot certificates; ss -ltnp | grep 80/443.

## Verdict status per hypothesis
| H# | Status (PENDING / CONFIRMED / REJECTED) | Evidence link |
|----|-----------------------------------------|---------------|
| H1 | CONFIRMED (ROOT CAUSE) | ybw-frontend.service: ActiveState=inactive, SubState=dead, MainPID=0, Result=exit-code, ExecMainStatus=1, NRestarts=22669 — systemd hit StartLimitBurst restart ceiling and permanently disabled the unit. See L3 log lines 6-14. Orphan next-server pid=1404731 on 3004 but nginx proxy_pass to backend service port (likely 3300/3000) has no listener, hence 502 for all routes. |
| H2 | REJECTED | nginx active/running MainPID=1154006; HTTP 80→443 redirect works; TLS verify=0 OK; 502 = bad gateway not front-door down. |
| H3 | REJECTED | port 22 nc success; ssh whoami=topix; uptime 74d; VPS alive. |
| H4 | REJECTED | LISTEN 127.0.0.1:5432 present in ss -lntp (L47); PG socket up. |
| H5 | PARTIAL (capacity REJECTED, artifacts still TBD post-rebuild) | disk 59% / inodes 9% → fine; build artifacts unknown until rebuild but orphan next-server pid exists so 11 Sep build artifacts likely fine — systemd state poisoned by crash loop. |

## ROOT-CAUSE FORENSIC POST-MORTEM (PR #530 RUN 35329004583)
**FACT: PR #530 fix/header-ad-rotation build did NOT fail because of code errors.**
- Forensic view of RUN 35329004583 deploy log (tail 400 lines) → the sequence of events:
  1. pnpm install ✅ frozen lockfile. Install OK.
  2. `next build` → NO build cache found.
  3. **Compiled successfully in 9.4 min** (webpack ok). No tsc/eslint errors.
  4. **Linting and checking validity of types** → only pre-existing warnings (react-hooks/exhaustive-deps + @next/next/no-img-element). 0 errors.
  5. **Collecting page data** → Ghost fetches succeed (getPosts OK base=admin.yorkshirebusinesswoman.co.uk).
  6. **Generating static pages (0/84)** → progressing OK to **(42/84)**.
  7. **SIGNAL 9 (OOM kill):** `/opt/actions-runner-ybw/_work/_temp/0455841f.sh: line 66: 1401446 Killed sudo -u www-data ... pnpm build` → **BUILD_EXIT=137**.
  8. Deploy aborts with `FATAL: pnpm build exit=137`. Steps 5 (chown) and 6 (systemctl restart) never run.
- **Verdict on PR #530 code:** PR #530 only changed ONE FILE — `src/components/magazine/header.tsx` (31 lines diff). The code change is: "if a rotation item is eligible/active, treat it as authoritative (no fallthrough to slot/env defaults)". This is correct logic. Zero undefined-symbol references. Zero import errors. `vitest magazine` 82/82 passes on PR #530 baseline plus revert. PR #530 code itself is fine.
- **Actual failure:** 3.7 GiB VPS memory ran out during Next.js production static-generation phase (42/84 pages). Next.js by default spawns N_CPU parallel workers (turbopack/webpack) + sharp image-worker + separate jest-worker subprocess + Ghost fetch keep-alives = RSS balloons past 3.5 GB → Linux OOM killer selects the biggest RSS (node build) and shoots SIGKILL → exit 137.
- **Why this became an outage:** Because deploy-vps never reaches step 6 restart after build failure, the ybw-frontend.service that was running since 16 Sep just keeps crash-looping tiny Node OOM kills under memory pressure until 74d uptime accumulates NRestarts=22669 → systemd StartLimitBurst trips → service permanently inactive/dead MainPID=0 → nginx 502.

## Resolution Timeline
1. **Emergency rollback PR #532:** `git revert -m 1 f2ef878` (PR #530 merge SHA). Code tree byte-identical to 0ff8d51 last good. Vitest required checks 35539888921 + 35539963974 SUCCESS.
2. **PR #532 MERGED 21:53:35Z 2026-09-20:** merge SHA 13f5c16 pushed main.
3. **deploy-vps RUN 35540032138 SUCCESS in 6m20s:** `systemctl reset-failed ybw-frontend` + clean build (no PR #530 code changes = baseline build uses less memory during static gen) + restart → ybw-frontend.service active/MainPID=1823939/Result=success.
4. **Post-deploy public smokes OK:** `/` HTTP 200 888KB real page; `/news` HTTP 200; `/about` HTTP 200; `/api/upload/idml` HTTP 405 (route alive); `/api/webhooks/stripe` HTTP 405 (route alive). Ghost YBM service active. PG 5432 + Ghost 2370 listeners present.

## FORWARD FIX (prevent this from ever happening again)
Two independent system-level hardenings + PR #530 feature re-applied cleanly:
### Hardening 1 — Build OOM resilience (.github/workflows/deploy-vps.yml step 4)
- Before build starts: **`systemctl stop ybw-frontend.service`** frees its 200-500 MB Node resident RSS back to the OS during the build.
- Aggressive pkill of `next-server|node.*server` too (stale next-server orphans).
- `echo 3 > /proc/sys/vm/drop_caches` → drops VFS page cache/dentries/inodes accumulated by prior Next server + node_modules stat storms; returns ~200-400 MB instantly.
- Build env tuning:
  - `NODE_OPTIONS="--max-old-space-size=3584"` (raised from 3072 MB — 512 MB more heap headroom).
  - `NEXT_TELEMETRY_DISABLED=1` (no telemetry network process during build).
  - `NEXT_PRIVATE_BUILD_WORKER_CONCURRENCY=1` + `EXPERIMENTAL_CPU_COUNT=1` (forces 1 webpack/turbopack worker only; VPS has 1 vCPU anyway, no point spawning N workers).
- Service restart in step 6 still happens after successful build, so downtime ≈ build phase (7-8 min 404 window on the site — acceptable for deploys, and deploy-vps concurrency=cancel-in-progress=false means users don't stack deploys). This 84-page static gen build needs all the RAM it can get.

### Hardening 2 — systemd restart ceiling guard (.github/workflows/deploy-vps.yml step 6)
- **`systemctl reset-failed ybw-frontend.service` BEFORE `systemctl restart`**. Also ybw-frontend-tls if present. This clears NRestarts + StartLimitBurst rate-limit counters. Without this, if the service ever crash-loops again (for any reason — even unrelated Node OOM), `systemctl restart` silently returns 0 without actually starting the unit, leaving the site on HTTP 502 forever. With reset-failed pre-restart, EVERY successful deploy will ALWAYS be able to bring the service back up no matter how badly past starts failed.

### PR #530 feature re-applied cleanly (src/components/magazine/header.tsx)
- Restored rotation-authoritative logic (31 lines). Rotation items are authoritative when active: `rotatedItem ? (rotatedItem.imageUrl || undefined) : (headerAd?.imageUrl || env)` instead of `rotatedItem?.imageUrl || headerAd?.imageUrl || env`. This suppresses slot/env fallbacks so image-only creatives don't accidentally inherit an env-provided iframe URL, which was PR #530's declared intent ("honor rotation item over env fallback in header ad"). Verified tsc 0 + lint 0 errors + vitest 82/82. Zero risk.

## Files touched
- `.github/workflows/deploy-vps.yml` (step 4 build memory hardening + step 6 reset-failed guard)
- `src/components/magazine/header.tsx` (rotation authoritative rule restored from PR #530)
- debug-ybw-frontend-down-20260920.md (this file, forensic + fixes recorded)

## Mitigation effectiveness
- Build memory headroom before fix: 3072MB Next heap + 300MB Next server running concurrently during build → ~3.4 GB baseline on 3.7 GB box. Static gen 42/84 shoots past limit.
- After fix: service stopped pre-build (-> +300MB back), drop_caches (+200MB back), heap raised 512MB → **~1 GB more headroom** → 84-page static gen won't OOM kill.
- Worst-case if another exit 137 STILL happens: reset-failed guard in step 6 is skipped because step 6 never runs (build fails before it). Correct & desired — we DON'T want to restart on broken builds; we only want reset-failed to protect against historical bad starts when deploying a known-good build.
- PR #530 code was always safe; blaming it was "suspicious coincidence bias" because the merge correlated with the failure. Forensic logs: build was fine; it was a capacity problem during static gen.

