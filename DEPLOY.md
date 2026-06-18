# Stream Gallery — Cloudflare Pages + R2

Mobile random-cluster viewer. The **app** ships on Cloudflare Pages; **NPZ data** lives on R2.

## Architecture

| Asset | Host |
|-------|------|
| `index.html`, JS/CSS | Cloudflare Pages (`dist/`) |
| `catalog.csv` | Cloudflare Pages (`public/` → `dist/`) |
| `tmp/{Cluster}_{omega}.npz` | Cloudflare R2 bucket |

`manifest.json` is no longer required — the catalog drives which clusters appear, and all nine Ω_b runs use a fixed naming scheme.

## Data layout (one NPZ per cluster × Ω_b)

**Filename:** `tmp/{Cluster}_{omega}.npz`

- `{Cluster}` — exact catalog name (e.g. `ASCC_110`, `Berkeley_89`)
- `{omega}` — `0` for no-bar, else `20`, `25`, `30`, `35`, `39`, `45`, `50`, `55`

**Example:** `tmp/ASCC_110_20.npz`

**Arrays inside each file** (flat float64, no pickled dicts):

| Key | Purpose |
|-----|---------|
| `stream_x`, `stream_y` | Star positions (stream view) |
| `stream_isescaper` | Optional escape-time coloring |
| `orbit_x`, `orbit_y` | Galactic-frame backward orbit |
| `bf_orbit_x`, `bf_orbit_y` | Bar-frame backward orbit |

## How the app reads files

1. Pick random row from `catalog.csv` → `cluster` name.
2. For each selected run (`nobar` → `0`, `omega-20` → `20`, …), build path `tmp/{cluster}_{omega}.npz`.
3. **Dev:** fetch from `stream_gallery/public/tmp/…` (same origin).
4. **Prod:** fetch from `VITE_DATA_BASE` + `tmp/…` on R2.
5. Unzip NPZ with `fflate`, parse each `.npy` with `npyjs`.
6. Map keys into `{ stream, orbit, bfOrbit }` bundles cached per `cluster|runId`.
7. **Stream** view uses `stream_*`; **Orbit** uses `orbit_*` (galactic centre at origin); **Bar** uses `bf_orbit_*` (bar centre at origin).

## Prerequisites

1. [Cloudflare account](https://dash.cloudflare.com/sign-up) (free)
2. GitHub repo with `stream_gallery/` pushed
3. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/): `npm install -g wrangler && wrangler login` (used for bucket creation and bulk upload)

## Local development

```bash
cd stream_gallery
# NPZ files live in public/tmp/{Cluster}_{omega}.npz

npm install
npm run dev
# → http://localhost:5173
```

Place your curated `public/catalog.csv` (`Cluster` column required; `logAge50` or `age_Gyr` for age display).

## Step 1 — Prepare files

```bash
# Required: your catalog
#   stream_gallery/public/catalog.csv

# Required: flat NPZ tree
#   stream_gallery/public/tmp/ASCC_110_0.npz
#   stream_gallery/public/tmp/ASCC_110_20.npz
#   …
```

Save in Python (flat arrays only):

```python
np.savez(
    f"public/tmp/{cl_name}_{omega}",
    stream_x=..., stream_y=...,
    orbit_x=..., orbit_y=...,
    bf_orbit_x=..., bf_orbit_y=...,
    stream_isescaper=...,  # optional
)
```

## Step 2 — Create R2 bucket and upload

```bash
wrangler r2 bucket create stream-gallery-data

# From repo root (uploads stream_gallery/public/tmp → R2 tmp/):
./scripts/upload_gallery_r2.sh
```

Or upload via the R2 dashboard (drag `tmp/` into the bucket). No CLI needed for that path.

**Wrangler v4 note:** `wrangler r2 object put` defaults to **local** dev storage. The upload script passes `--remote` so objects go to your real bucket. If you see `Resource location: local` in the output, re-run with `--remote`.

**Alternative CLIs** (optional): [rclone](https://developers.cloudflare.com/r2/get-started/cli/) or AWS CLI with an R2 API token — useful for very large trees; Wrangler uploads one file at a time.

Object keys on R2 must be:

```text
tmp/{Cluster}_{omega}.npz
```

## Step 3 — Public access + CORS

Cloudflare dashboard → **R2** → `stream-gallery-data` → **Settings**:

1. Enable **Public access** → `r2.dev` subdomain → note URL `https://pub-<id>.r2.dev/`
2. Add **CORS policy**:

```json
[
  {
    "AllowedOrigins": [
      "https://stream-gallery.pages.dev",
      "https://your-custom-domain.com",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

## Step 4 — Cloudflare Pages project

| Setting | Value |
|---------|-------|
| Project name | `stream-gallery` |
| Production branch | `main` |
| Root directory | `stream_gallery` |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist` |
| `NODE_VERSION` | `20` |

**Environment variables** (Production + Preview):

| Name | Value |
|------|-------|
| `VITE_BASE` | `/` |
| `VITE_DATA_BASE` | `https://pub-<id>.r2.dev/` |
| `VITE_DATA_PREFIX` | `tmp` (optional; default is `tmp`) |

`VITE_DATA_BASE` should be the R2 public root (trailing slash optional). The app requests `{VITE_DATA_BASE}tmp/{Cluster}_{omega}.npz`.

## Step 5 — Verify

1. Open `https://<project>.pages.dev` on mobile
2. Loading ring ≥ 1.5 s, then random cluster from your catalog
3. **Stream** / **Orbit** / **Bar** toggles work
4. Run chips on the left; escape-time coloring when `stream_isescaper` present
5. Network tab: `GET https://pub-*.r2.dev/tmp/SomeCluster_20.npz` → 200, CORS OK

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| NPZ 403/404 | Check R2 public access; filename must match catalog `Cluster` exactly + `_omega` |
| CORS error | Add Pages URL to R2 CORS `AllowedOrigins` |
| `Unsupported dtype: \|O` | Re-save NPZ with flat float arrays, not nested dicts |
| Blank plot | Check `VITE_DATA_BASE`; cluster must exist in `catalog.csv` and have NPZ files |
| Build fails | Pages root directory must be `stream_gallery` |

## Updates

| Change | Action |
|--------|--------|
| App code | `git push` → Pages auto-rebuilds |
| `catalog.csv` | Commit in `stream_gallery/public/`, push |
| NPZ data | Re-run `upload_gallery_r2.sh` (no Pages rebuild needed) |

## Production smoke test (local)

```bash
VITE_BASE=/ \
VITE_DATA_BASE=https://pub-<id>.r2.dev/ \
npm run build && npm run preview
```
