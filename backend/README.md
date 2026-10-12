# ShelfMind Backend

FastAPI + SQLAlchemy + Alembic backend for Shelf Mind. The configured backend uses Supabase PostgreSQL and includes its own ONNX image detector. Photo detections are evidence, not authoritative SKU identities or total inventory.

## Setup

```powershell
cd "C:\Users\zians\Downloads\SHELF MIND\backend"
python -m pip install -r requirements.txt
alembic upgrade head
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
```

The frontend runs at http://127.0.0.1:5174; see `../run.txt` for both startup commands.
Analytics reads the imported records already saved in Supabase. Upload a CSV only
for an initial import or additional history, not on every startup. The supplied
CSV has already been imported and remains labeled as simulated history.

## Supabase

The local `.env` is configured for the supplied Supabase project. `.env` is ignored by git. Keep service-role and database credentials on the backend only.

The direct Supabase database hostname for this project resolves to IPv6 from this machine. The backend therefore uses the IPv4-compatible shared pooler in session mode:

```text
postgresql+psycopg://postgres.<project-ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require
```

## Data Provenance

- Retail history: user-supplied `shelfmind_retail_history.csv`, explicitly confirmed by the user as generated/simulated. Contains 1,460 daily rows, four SKUs, one store, 2025-09-15 through 2026-09-14. Original values, dates, flags and order quantities are retained in `retail_history_rows`. Sales, demand, snapshots and latest inventory are populated from those values. This is not a live POS/ERP feed.
- CSV validation checks required columns, dates, numeric ranges, duplicate keys, opening/closing inventory balance, demand balance, capacity and weekend flags before any writes. SHA256 and import provenance are stored. Repeating an import skips unchanged rows. Conflicting rows are rejected and rolled back. Historical imports do not rewind later inventory counts.
- ShelfMind Vision: the ShelfWatch detector logic is ported into `app/services/vision_detector.py`, with the model bundled at `backend/models/best.onnx`. No external folder, Python import or ShelfWatch server is required. Display-sized original/annotated previews and inference results persist in Supabase observations. Images are limited to 10 MB and 25 megapixels; batches support 12 photos. No sample detection JSON is loaded into the dashboard. See `models/README.md` for provenance and redistribution limitations.
- Unknown supplier names use their source IDs. Reliability, expiry, delivery receipts and planogram compliance remain unknown. The CSV does not establish purchase-order delivery status, so the importer does not invent delivered orders.
- Forecasts are trailing 28-record demand means, with a first-record warm start. RL metrics come from computed model experiments using imported catalog parameters, not measured business improvements. Experiments do not overwrite imported inventory or sales.

The detector labels generic objects D001, D002, etc. These are per-image detection IDs, not catalog item IDs. The manager explicitly selects the catalog ID and confirms total available stock, including stock outside the photos and excluding repeated views. A single photo can support separate reviews for different IDs; counts are never automatically summed across photos.

## Simple Image Review

1. Upload photos, inspect numbered detections and measured quality.
2. Select an item ID, enter verified total available units, and confirm the count.
3. Evaluate using that item's saved demand history and catalog costs, MOQ, capacity and supplier lead time.
4. Inspect per-item demand/sales, verified-stock and action-value graphs, then approve, adjust or reject. Guarded auto-approval is optional in Settings.

`app/services/image_review.py` uses [pymdptoolbox value iteration](https://pymdptoolbox.readthedocs.io/en/latest/api/mdp.html) with empirical consecutive demand windows from the latest 90 saved records. The policy changes with quantity, history and catalog parameters, not hardcoded brand-specific recommendations. The period covers supplier lead time followed by one selling day; deliveries cannot cover shortages before arrival. There are no outstanding orders in this model. The target is the optimal order from zero stock, not a guarantee of service level. Supported capacities are at most 250 units and lead times at most 14 days.

Economic assumptions are exposed in the result: holding cost 2% of purchase cost per unit/day (minimum 0.01), lost-sale penalty equal to unit margin (minimum 1), order setup cost equal to one unit cost, discount 0.92. These are modeling assumptions, not measured expenses. Imported simulated history stays labeled; it does not become operational history through image upload.

Auto-approval requires explicit count confirmation, all selected photos passing quality checks, uploads within 24 hours, at least 14 complete demand windows, history within 7 days, solver convergence, and configured quantity/spend budgets. Quality uses [Laplacian variance](https://docs.opencv.org/4.x/d5/db5/tutorial_laplace_operator.html), exposure, resolution and detection-confidence thresholds; it is heuristic, not calibrated accuracy or SKU verification. Blurry/uncertain images still permit manual review. `SHELFMIND_VISION_BLUR_THRESHOLD` defaults to 60.

Reviews and approval rationale persist in existing decision tables. Request UUIDs prevent duplicate decisions on retries, image hashes deduplicate uploads, and a newer verified count supersedes older pending image reviews for that item. Identical re-uploads retain the original timestamp, not refreshed evidence. Approvals are recommendations only: no supplier dispatch, purchase-order creation, imported inventory overwrite or automatic stock removal. A human adjustment does not retrain the MDP; the original model assessment is retained for comparison. Advanced navigation retains the separate legacy research and inventory screens.

`python -m app.seed` now imports the supplied simulated CSV. Legacy scenario generation is explicit (`--scenario`) and restricted to a separate SQLite research database. The one-time `--replace-generated` importer flag only removes the original identifiable scenario and refuses cleanup when user approvals, uploads or other activity are present.

## Main Endpoints

- `GET /health`
- `GET /api/dashboard`
- `POST /api/history/import` (multipart `file`, `provenance=simulated|operational`)
- `PUT /api/settings`
- `GET /api/products`
- `GET /api/inventory`
- `GET /api/decisions`
- `POST /api/decisions/generate`
- `POST /api/decisions/{id}/approve`
- `POST /api/decisions/{id}/modify`
- `POST /api/decisions/{id}/reject`
- `GET /api/shelfwatch`
- `POST /api/shelfwatch/analyze`
- `GET /api/shelfwatch/images`
- `POST /api/shelfwatch/review`
- `GET /api/products/{product_id}/review-history`
- `GET /api/audit`
- `GET /api/analytics`
- `GET /api/rl/metrics`
- `POST /api/rl/value-iteration/run`
- `POST /api/rl/q-learning/train`
- `POST /api/rl/dqn/train`
- `POST /api/simulation/step`
- `POST /api/simulation/reset`
- `POST /api/simulation/run`
- `GET /api/agent/briefing`
- `POST /api/agent/query`

## Local Test Fallback

Tests use SQLite in a temporary file so they do not touch Supabase:

```powershell
pytest
```

The application runtime remains PostgreSQL/Supabase-oriented by default.

Browser checks (with the API and Vite servers running):

```powershell
python -m pip install playwright
python scripts/verify_browser.py
python scripts/verify_welcome.py
python scripts/verify_image_review.py
```

## Current Boundaries

The local API has no user authentication and should stay on localhost until Supabase Auth and store-scoped authorization are implemented. Purchase orders are internal records only; no supplier dispatch or receiving feed is connected. Manager identity and autonomy settings persist, but service-level targets are reporting preferences, not guarantees.

`verify_image_review.py` starts a temporary SQLite-backed API on a free port and proxies only its own browser requests to it. It tests real uploads and approvals without writing test counts to Supabase, then stops that test server. The ordinary browser checks are read-only against the configured app.

Before public deployment: add authentication and store-scoped authorization, rotate credentials shared in chat, move image blobs to private Supabase Storage, validate model redistribution rights, and replace simulated demand with actual retail history. Keep supplier execution disabled until receiving and outstanding-order tracking are connected.
