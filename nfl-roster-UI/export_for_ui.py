# Paste this into a new cell AFTER the notebook cell that creates current["p_keep"].
# It exports scored rows only; no model retraining or feature changes are needed.
from pathlib import Path

ui_columns = [
    "player", "position", "posteam", "season", "cap_pct",
    "rookie_deal", "war", "rate_win", "p_keep",
]
missing_ui_columns = [col for col in ui_columns if col not in current.columns]
if missing_ui_columns:
    raise ValueError(f"Run the scoring cell first. Missing columns: {missing_ui_columns}")

ui_results = current[ui_columns].copy()
if ui_results.empty:
    raise ValueError("No scored players were found in current.")
if ui_results[ui_columns].isna().any().any():
    raise ValueError("The scored results contain missing values. Check those rows before exporting.")
if ui_results.duplicated(["player", "position", "season"]).any():
    raise ValueError("Expected one row per player-position-season.")
if not ui_results["p_keep"].between(0, 1).all():
    raise ValueError("p_keep must be between 0 and 1.")
if not ui_results["cap_pct"].between(0, 100).all():
    raise ValueError("cap_pct must use percentage points: 2.6 means 2.6%.")

ui_results["rookie_deal"] = ui_results["rookie_deal"].astype(int)
ui_results["season"] = ui_results["season"].astype(int)
ui_export_path = Path("roster_results.csv")
ui_results.to_csv(ui_export_path, index=False)
print(f"Exported {len(ui_results):,} player-seasons to {ui_export_path.resolve()}")
print("Open Roster Lab, choose Import results, and select this CSV.")
