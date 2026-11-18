# Paste into a new notebook cell after fitting final_sc and final_lg.
# This mirrors the notebook's latest-season recommender scoring step.
from pathlib import Path
import numpy as np

ui_latest_season = int(ps2["season"].max())
ui_scored = ps2.loc[qual2 & (ps2["season"] == ui_latest_season)].copy()
if ui_scored.empty:
    raise ValueError("No qualified players in the latest season. Run the analysis cells first.")
ui_scored["p_keep"] = final_lg.predict_proba(
    final_sc.transform(design(ui_scored, final_cols))
)[:, 1]

ui_required = [
    "player", "position", "posteam", "season", "cap_pct",
    "rookie_deal", "war", "rate_win", "p_keep", "cap_number",
]
ui_missing = [col for col in ui_required if col not in ui_scored.columns]
if ui_missing:
    raise ValueError(f"Missing columns: {ui_missing}. Run the salary merge and scoring cells.")
ui_columns = ui_required + [c for c in ["gsis_id", "plays"] if c in ui_scored.columns]
ui_results = ui_scored[ui_columns].copy()
ui_numbers = ["season", "cap_pct", "rookie_deal", "war", "rate_win", "p_keep"]
if not np.isfinite(ui_results[ui_numbers].to_numpy(dtype=float)).all():
    raise ValueError("Required score fields contain missing or infinite values.")
if ui_results[["player", "position", "posteam"]].isna().any().any():
    raise ValueError("Some players have missing names, positions, or teams.")
ui_identity = "gsis_id" if "gsis_id" in ui_results.columns else "player"
if ui_results.duplicated([ui_identity, "position", "season"]).any():
    raise ValueError("Expected one row per player-position-season.")
if not ui_results["p_keep"].between(0, 1).all():
    raise ValueError("p_keep must be between 0 and 1.")
if not ui_results["cap_pct"].between(0, 100).all():
    raise ValueError("cap_pct must use percentage points: 2.6 means 2.6%.")
ui_known_cap = ui_results["cap_number"].dropna()
if not np.isfinite(ui_known_cap.to_numpy(dtype=float)).all() or (ui_known_cap < 0).any():
    raise ValueError("Known cap_number values must be finite and nonnegative ($ millions).")

ui_results["season"] = ui_results["season"].astype(int)
ui_results["rookie_deal"] = ui_results["rookie_deal"].astype(int)
ui_export_path = Path("roster_results.csv")
ui_results.to_csv(ui_export_path, index=False)
print(f"Exported {len(ui_results):,} qualified players for {ui_latest_season}.")
print(f"Exact dollar cap hits available: {ui_results['cap_number'].notna().sum():,}.")
print(f"File: {ui_export_path.resolve()}")
print("Open Roster Lab, select Import results, and choose this CSV.")

# Optional: update the team's default dashboard data for everyone.
# Point ui_folder at the website folder relative to this notebook.
# ui_folder = Path("nfl-roster-UI")
# if not (ui_folder / "index.html").exists():
#     raise FileNotFoundError("Set ui_folder to the folder containing index.html.")
# (ui_folder / "data.json").write_text(
#     ui_results.to_json(orient="records", double_precision=10), encoding="utf-8"
# )
# Commit the updated data.json along with the UI files to share the new defaults.
