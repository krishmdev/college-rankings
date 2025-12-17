# Two-phase contract: `make setup` needs the network; everything after it runs offline.
OFFLINE_RUN ?= $(HOME)/Developer/portfolio/.tools/offline-run

.PHONY: setup models test lint typecheck web export e2e e2e-offline demo canary etl bench report

setup:
	pnpm install --frozen-lockfile
	cd apps/mobile && npx playwright install chromium
	cd etl && uv sync --locked
	$(MAKE) models

# No ML models in this repo; the dataset snapshot is committed, so there is nothing to download.
models:
	@echo "no model artifacts needed (snapshot is committed in packages/dataset/data)"

test:
	pnpm test
	cd etl && uv run pytest -q

lint:
	pnpm lint
	cd etl && uv run ruff check . && uv run ruff format --check .

typecheck:
	pnpm typecheck

export:
	pnpm export:web

# Offline demo: static export served under /college-rankings on localhost, network denied.
demo: export
	$(OFFLINE_RUN) pnpm preview:web

e2e: export
	pnpm e2e

e2e-offline: export
	cd apps/mobile && $(OFFLINE_RUN) env CI=1 EXPECT_OFFLINE=1 EGRESS_CANARY=1 npx playwright test

canary:
	node apps/mobile/scripts/egress-canary.mjs open
	$(OFFLINE_RUN) node apps/mobile/scripts/egress-canary.mjs blocked

# Rebuilds the snapshot from the public sources (network, about 32 MB of downloads the first time).
etl:
	cd etl && uv run college-etl build

bench:
	pnpm engine:bench

report:
	pnpm engine:report
