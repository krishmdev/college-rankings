# Verification log

What was run on this machine (Apple M1 Pro, 16 GB, macOS), and what it showed. No provider API keys
are used anywhere in this repo, so there are no live-key runs.

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

`pnpm supabase:test` under the compute lease (2025-12-25 01:31 UTC, Supabase CLI 2.117.0, HEAD
`736dd7a`, no uncommitted sources): all three migrations and the seed applied, **58 pgTAP checks
and 11 Auth API integration checks passed**, and the stack was stopped afterward.

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
[manifest](results/supabase-tests.manifest.json), whose per-file sha256 values are the binding
record of what was tested. This verifies the local stack, not a hosted Supabase project.

An earlier run on 2025-12-24 failed 2 of 58 pgTAP checks. It was a test bug: after the privacy
change, report lookups have to go through `public_reviews`. The fix is `736dd7a`.
