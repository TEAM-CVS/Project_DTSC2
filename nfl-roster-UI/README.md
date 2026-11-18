# NFL Roster Lab

An interactive interface for the supplied Studio2 NFL player value notebook.

## Use with your notebook in VS Code

1. Run the notebook through the final scoring cell that creates `current["p_keep"]`.
2. Paste the contents of `export_for_ui.py` into a new notebook cell and run it.
3. Open the dashboard, choose **Import results**, and select `roster_results.csv`.
4. Filter by season, position, and historical team; search players; select up to three to compare.
5. **Export view** downloads the filtered rows as CSV.

The UI does not execute Python or retrain the model. Imported CSVs remain in browser memory for this session and are not uploaded to a server. A reload restores the 40-row notebook excerpt. Model report metrics remain the fixed metrics from the supplied notebook, even after importing new player results.

## Run the interface locally

No JavaScript dependencies or build step are needed. With Python installed, run:

```bash
cd dist
python -m http.server 8000
```

Open http://localhost:8000. If you downloaded just the contents of `dist`, run the server in that folder. Use a server rather than opening index.html directly because the interface loads data.json with fetch.

Files: index.html (layout), styles.css (appearance), app.js (interactions), data.json (selected notebook output), export_for_ui.py (bridge from the notebook). Google Fonts is optional; system fonts are the fallback.

## Data contract

CSV header:

```csv
player,position,posteam,season,cap_pct,rookie_deal,war,rate_win,p_keep
```

- `position`: QB, RB, WR, TE
- `season`: feature season, e.g. 2024
- `posteam`: historical main team from the notebook
- `cap_pct`: percentage points, e.g. 2.6 means 2.6% of cap
- `rookie_deal`: 0 or 1, the notebook's first-four-seasons proxy
- `war`: modeled wins above replacement
- `rate_win`: shrunk EPA above replacement per play, up to three seasons
- `p_keep`: model output between 0 and 1 for positive surplus next season

One row per player-position-season. Imports are limited to 5 MB and 20,000 rows. The exported field names are kept to match the Python notebook; `p_keep` is labeled Value score in the UI to avoid suggesting actual team retention is modeled.

## Interpretation

The bundled data contains 40 actual rows from the notebook's displayed top/bottom five at each position in 2024. Values preserve the HTML's rounding. This selection is not representative of the full league; means and ranks apply only to loaded players. The model uses historical season cap share, not a projected next-year contract or release savings. The teams are historical, not current rosters.

The selected logistic model reports AUC 0.623 (95% bootstrap CI 0.560–0.687), accuracy 0.616 on 284 held-out examples, and an AUC gain of 0.027 (CI −0.024–0.074). Calibration is not evaluated, so the score is a ranking signal rather than a verified probability. The UI tiers (high >=60%, monitor >=40%, review <40%) are presentation choices, not validated personnel decisions.

Further validation should fit replacement baselines, wins-per-EPA, and shrinkage priors inside training folds; the provided notebook uses pooled data for these steps. Injury forecasts, future salaries, guarantees, and roster fit are outside this model. The dashboard makes no new predictions.
