# Verification log

This log records checks run on an Apple M1 Pro with 16 GB of memory, running macOS. The repo does
not use provider API keys, so no checks involved live keys.

## 2025-12-23

| Check | Command | Result |
|---|---|---|
| Engine + dataset unit tests | `pnpm test` | 55 passed |
| ETL tests | `cd etl && uv run pytest` | 27 passed |
| Lint / types | `pnpm lint`, `pnpm typecheck`, `ruff check`, `ruff format --check` | clean |
| Snapshot build from live sources | `uv run college-etl build --snapshot-id 2025-12-23` | 1,532 schools; all validation gates and spot checks passed (BU faculty 1,994, BU R&D $784.4M, JHU $4.13B, OSU $1.58B, UMich 1,983 clubs) |
| Engage crawl | `uv run college-etl engage-discover` | 1,496 subdomains probed at ≤2 req/s; 305 found, 5 errors (non-JSON responses), kept as unknown |
| Engine timing (compute lease) | `pnpm engine:bench` | rank p50 1.12 ms for 2,500 × 28; see `docs/results/engine-bench.json` and its manifest |
| Web export | `pnpm export:web` | builds under `/college-rankings`, with `404.html` and `.nojekyll` |
| Native bundle | `npx expo export -p android` | Hermes bundle builds; not run on a device or emulator |
| Browser e2e | `pnpm e2e` | 28 passed, 2 skipped (offline-only checks), desktop 1440×900 and Pixel 7 (rerun 2025-12-24 after the final-review fixes) |
| Offline e2e | `OFFLINE_RUN=… make e2e-offline` | 30 passed (rerun 2025-12-24); preview server, Playwright and Chromium all under `offline-run`; server-side canary got EPERM for 1.1.1.1, api.openai.com, huggingface.co, collegescorecard.ed.gov |
| Canary control | `make canary` | unsandboxed canary connects to all four targets; sandboxed one is blocked |

## Supabase

The captured `pnpm supabase:test` log (2025-12-25 05:08 UTC, Supabase CLI 2.117.0,
HEAD `a9cd134`, no uncommitted source files recorded) reports **61 pgTAP checks and 12 Auth API
integration checks passed**. The test script resets the local database before running the checks,
but the captured log does not include the reset output. The log hash and all 13 source hashes in the
manifest match the current files. This is a verified historical capture; the database was not
rerun during this verification pass.

The run covers:
- the signup hook and OTP confirmation;
- school-scoped review access and blocked edits to roles, affiliations and status;
- email changes to gmail rejected, with the email left unchanged;
- a school-to-school move that needs both confirmations;
- flags from reporters surviving author edits;
- withdraw instead of delete;
- plus-addressed aliases refused;
- a sticky admin revoke;
- author ids hidden from anon;
- three distinct reporters flagging a review.

See [`docs/results/supabase-tests.txt`](results/supabase-tests.txt) and its
[manifest](results/supabase-tests.manifest.json). The manifest's per-file sha256 values identify
the exact files tested. This verifies the local stack, not a hosted Supabase project.

An earlier run on 2025-12-24 failed 2 of 58 pgTAP checks because the test looked up reports
through the wrong table. After the privacy change, those lookups must use `public_reviews`. Commit
`736dd7a` fixes the test.

## 2025-12-25 local verification

After the profile-filter validation commits and the wording pass:

| Check | Command | Result |
|---|---|---|
| Engine + dataset | `pnpm test` | 56 passed |
| ETL | `cd etl && uv run pytest -q` | 27 passed |
| TypeScript and ESLint | `pnpm typecheck`, `pnpm lint` | clean |
| Python lint and formatting | `uv run ruff check .`, `uv run ruff format --check .` | clean; 28 files formatted |
| Static export and offline browser | `OFFLINE_RUN="$PWD/scripts/offline-run" make e2e-offline` | 34 Playwright checks passed on desktop and phone viewports, including server egress denial |
| Generated outputs | `pnpm engine:report`; `coverage_markdown` from the committed snapshot | `docs/results/report.md` regenerates byte-for-byte; `coverage.md` matches except for the order of the HERD counts, which follows the build's insertion order |

This pass did not rerun Supabase (no SQL changed) or test a hosted backend or native app.
