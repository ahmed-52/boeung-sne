# DataBirdLab – Boeung Sne Monitoring Platform

DataBirdLab is an end-to-end monitoring stack that turns field data gathered at the Boeung Sne bird colony into actionable insights. It combines:

- a FastAPI backend that ingests drone orthomosaics, tiles them, runs YOLOv8 detections, and stores visual/acoustic detections in SQLite via SQLModel,
- a React + Tailwind dashboard that visualizes survey coverage, activity trends, species breakdowns, and acoustic
- a `research/` workspace that captures BirdNET experiments, YOLO training data, species lists, and recorder metadata collected in the field.

---

## Backend (FastAPI + Pipeline)

### Requirements

- Python 3.11+
- GDAL prerequisites for `rasterio` (already satisfied on macOS via `brew install gdal` or equivalent)
- Optional GPU w/ CUDA for faster YOLO inference (CPU also works thanks to Ultralytics)

Install dependencies:

```bash
cd DataBirdLab/backend
python -m venv .venv && source .venv/bin/activate 
pip install --upgrade pip
pip install -r requirements.txt
```

Key dependencies include FastAPI, SQLModel, Rasterio/OpenCV for tiling, and Ultralytics for detection.

### Running the API

```bash
cd DataBirdLab/backend
uvicorn app.main:app --reload
```

The server boots against `data/db.sqlite`. `app.database.create_db_and_tables()` runs on startup, so a fresh database is created automatically. Static tiles and uploads live under `backend/static/`.

### Ingestion Pipeline

1. **Upload** (`POST /api/surveys/import`): accepts a survey name and GeoTIFF, saves the file to `static/uploads/survey_<id>/`.
2. **Tiling** (`pipeline/drone/slicer.py`): slices the orthomosaic into 1280×1280 JPG tiles, captures lat/lon bounds via Rasterio → WGS84 transforms, and stores metadata for each tile.
3. **Registration**: each tile is stored as a `MediaAsset` row with geographic bounds and processing flags.
4. **Inference** (`pipeline/drone/detector.py`): runs YOLOv8 (`weights/best.pt`) on each tile, writing `VisualDetection` rows with class names, confidences, and bounding boxes.
5. **Map projection**: `GET /api/surveys/{id}/map_data` interpolates bounding boxes back to lat/lon for the front-end Leaflet map.
6. **Analytics**: aggregate endpoints expose daily activity, species distribution, and acoustic stats.

Sample data seeding for demos is available via `python populate_acoustic_data.py`, which fabricates recent surveys, media assets, and acoustic detections.

### Core API Surface

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `POST` | `/api/surveys/import` | Create a survey, upload a GeoTIFF, and kick off the background pipeline. |
| `GET` | `/api/surveys` | List surveys with bounding boxes for the dashboard map & filters. |
| `GET` | `/api/surveys/{id}/status` | Poll processing progress based on processed tiles. |
| `GET` | `/api/surveys/{id}/map_data` | Return visual detections with interpolated lat/lon. |
| `GET` | `/api/stats/daily` | Detections per day (supports `days` + `survey_id` filters). |
| `GET` | `/api/stats/species` | Species breakdown for charts. |
| `GET` | `/api/stats/acoustic` | Acoustic class counts sourced from `AcousticDetection`. |
| `GET` | `/api/stats/overview` | Aggregate KPIs (area monitored, unique species, totals). |

All endpoints hang off the FastAPI app defined in `backend/app/main.py`.

### Data & Assets

- `backend/static/uploads/` – raw orthomosaics grouped by survey id.
- `backend/static/tiles/` – processed tiles consumed by YOLO and, optionally, the UI.
- `backend/weights/best.pt` – Ultralytics model tuned for the colony (replace with newer weights as needed).
- `backend/app/models.py` – SQLModel definitions for `Survey`, `MediaAsset`, `VisualDetection`, and `AcousticDetection`.

---

## Frontend (Vite + React)

The dashboard (`DataBirdLab/frontend`) provides colony situational awareness:

- Survey coverage map powered by `react-leaflet` with bounds supplied by the API.
- Time & survey filters that drive every widget.
- KPI cards (area, unique species, total detections) populated via `/api/stats/overview`.
- Charts built with Recharts (daily detections, species distribution, acoustic class histogram).
- `NewSurveyModal` that POSTs against `/api/surveys/import` for one-click uploads.

### Setup

```bash
cd DataBirdLab/frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to `http://localhost:8000` (see `vite.config.js`), so running both dev servers side-by-side just works. TailwindCSS is preconfigured, and component styling lives under `src/App.css` and `src/index.css`.

Production builds use `npm run build`, which outputs to `frontend/dist/`.

---

## Research Workspace

Everything under `research/` documents data collection and modeling experiments:

- `research/acoustic/` – BirdNET notebooks (`birdnet.ipynb`, `AudioPipeline.ipynb`), raw WAV clips, CSV exports (`detections_master.csv`, `birdnet_to_raven.csv`), and helper scripts (`Audio.py`). Use the `birdc/` virtual environment to reproduce those notebooks.
- `research/drones/` – YOLO training data and scripts for improving the aerial model.
- `research/species_lists/` – canonical species subsets consumed by both the YOLO labels and BirdNET post-processing.
- `research/metadata.csv` – deployment log for recorders (gain, duty cycle, lat/lon) that can be joined with detections for QA.

None of the notebooks run inside the FastAPI/React stack, but they provide the provenance for the deployed models.

---

## Development & Utilities

- `DataBirdLab/test/` contains quick-and-dirty experiments (CLAHE demos, sample `.tif` files, YOLO smoke tests). Use it as a scratchpad when iterating on the pipeline.
- `DataBirdLab/backend/populate_acoustic_data.py` seeds acoustic detections for demos.
- `birdc/` is a Python virtual environment referenced in `research/acoustic/README.md`—feel free to delete it and recreate your own env via `python3 -m venv birdc`.
- `req.txt` is intentionally empty; populate it if you ever need a top-level requirements list for monorepo tooling.

---

## Getting Started Checklist

1. **Clone & install** – set up the backend (`pip install -r requirements.txt`) and frontend (`npm install`).
2. **Run services** – start `uvicorn app.main:app --reload` and `npm run dev`.
3. **Upload a survey** – use the “New Survey” button in the UI or `curl -F` against `/api/surveys/import` to feed a GeoTIFF. Tiles, detections, and stats should appear in seconds/minutes.
4. **Confirm analytics** – visit the dashboard at `http://localhost:5173` to verify the map, charts, and cards respond to your new data.
5. **Dive into research** – open the notebooks under `research/` to understand or extend BirdNET/YOLO training flows.

With this workflow you can go from raw drone imagery or acoustic WAV files to a fully visualized conservation report in a single afternoon.

---

Need something that is not documented yet? Open an issue or drop a note in the README so future contributors can build on top of your work.
