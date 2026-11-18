# NFL Roster Lab — Recommender update

Interactive UI for `Studio2_code(2).ipynb`. The model stays in Python; the website filters and ranks its scored player output.

## Install in your team's existing repository

Copy all eight files from this package into the existing `nfl-roster-UI` folder: index.html, styles.css, app.js, engine.js, recommender.js, data.json, export_for_ui.py, and README.md. Keep the notebook in the main project folder.

From the repository's main folder, run:

```bash
python3 -m http.server 8000 --directory nfl-roster-UI
```

Open [this](https://nfl-roster-lab-parsa.truepatio4.chatgpt.site). No JavaScript dependencies or build step are required. Use a web server because the UI loads data.json with fetch. Google Fonts is optional and has system-font fallbacks.

## Use the recommender

- **Rank a position:** select QB/RB/WR/TE, choose a budget, and rank by next-season value score. This matches `recommend_players(position, n, max_cap_pct)` in the notebook.
- **Compare alternatives:** choose a player from the latest loaded season, select a budget, and compare same-position peers. Higher scores only is on by default. Turn it off to inspect lower-scoring peers too, as in the notebook's first comparison plot.
- **Rank by WAR:** choose a baseline and budget, then rank same-position alternatives by WAR. This mode can include players whose WAR is below the baseline, matching the notebook's final cell.
- Choose cap-share percentage points, recorded cap hit in $ millions, or no budget limit. Limits are inclusive. The comparison player is excluded from candidates; its own cap hit can exceed the budget.
- Results are always based on the latest season in the loaded data, independent of the explorer's season/team filters. Team is a historical label, not current availability.
- Export shortlist downloads just the selected recommendations, with the baseline name and score change in percentage points (or WAR change).
- Player profiles offer **Find alternatives**, and recommendations can be added to the existing three-player comparison panel.

Budgets filter recorded costs. They do not change the model scores, simulate a new contract, estimate release savings, or establish trade/free-agent availability.

## Load all qualified players and exact costs

The notebook file saves displayed output, not every row of the runtime DataFrames. The bundled sample therefore contains 40 actual displayed 2024 score rows and only 3 documented dollar cap hits. All values were refreshed from the new notebook. Missing dollar costs are not estimated; those players are excluded only when using a dollar budget. Cap-share budgets work for all 40 rows.

1. Run the notebook through the cell fitting `final_sc` and `final_lg` (the scoring cell).
2. Paste the contents of `export_for_ui.py` into a new cell and run it. It scores all qualified players in the latest season using the already fitted model and writes `roster_results.csv`, including exact `cap_number` values, GSIS IDs, and plays.
3. Click **Import results** and choose the CSV. The recommender and player board update immediately.

Imports are processed in browser memory, without sending the CSV to a server. Reloading restores data.json. To share the full data as the default for everyone, use the optional code at the bottom of the export cell to replace `nfl-roster-UI/data.json` with the exported records, then commit it to the team repository.

## CSV contract

Required fields:

```csv
player,position,posteam,season,cap_pct,rookie_deal,war,rate_win,p_keep
```

Additional supported fields: `cap_number`, `gsis_id`, `plays`.

- cap_pct is percentage points: 2.6 means 2.6% of that season's cap.
- cap_number is recorded cap hit in $ millions, not dollars or annual contract salary. Blank means unknown; zero is a real zero and is accepted.
- p_keep is 0–1, the model output for positive surplus next season. It does not model actual team retention.
- rookie_deal is 0/1, the notebook's first-four-seasons proxy.
- rate_win is shrunk EPA above replacement per play over up to three seasons.
- position follows the notebook's contract-position map.
- One row per GSIS-ID/position/season, or name/position/season when GSIS ID is unavailable.

The notebook recommender's aliases are accepted: team → posteam, cap_share_pct → cap_pct, probability_positive_next_season → p_keep, cap_hit_$M or salary_$M → cap_number. Imports are limited to 5 MB and 20,000 player-seasons. Older nine-column CSVs still work for cap-share and unbudgeted rankings.

## Refreshed model report

The new saved outputs report smoothed logistic AUC **0.625** (95% bootstrap interval **0.564–0.690**), accuracy **59.5%**, and majority baseline **52.1%** on 284 held-out examples. AUC gain over the original is **0.034** (interval **−0.016 to +0.081**). The original logistic AUC is 0.591. The pooled conversion is approximately **0.02634 wins per EPA**.

The notebook's explanatory markdown still mentions older metrics. The website uses its latest saved numeric outputs. Model-report metrics are fixed to this supplied notebook and are not recalculated when importing a player CSV.

The gain interval includes zero. Calibration was not evaluated, so value scores are ranking signals rather than verified probabilities. Pooled replacement baselines, wins-per-EPA, and shrinkage priors need training-fold isolation for a stronger forecasting evaluation. Future contracts, injuries, guarantees, and roster fit are outside this model.
