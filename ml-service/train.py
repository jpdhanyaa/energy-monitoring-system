"""
AI Smart Energy Management System - ML Model Training Pipeline
Trains a Scikit-Learn Random Forest Regressor and Baseline Models on daily IoT energy profiles.
Enforces chronological split to avoid data leakage.
Outputs serialized model, metrics (MAE, RMSE, R2), and feature importances.
"""

import os
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import joblib

from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.dummy import DummyRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

MODEL_FILE = os.path.join(os.path.dirname(__file__), "model.joblib")
METRICS_FILE = os.path.join(os.path.dirname(__file__), "metrics.json")

def generate_synthetic_historical_data(days: int = 90) -> pd.DataFrame:
    """
    Generates realistic daily IoT energy consumption data for model development & validation.
    Includes seasonal trends, weekday/weekend load shifts, and appliance runtimes.
    """
    np.random.seed(42)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    dates = pd.date_range(start=start_date, end=end_date, freq='D')

    records = []
    base_kwh = 0.65 # Base daily kWh for low-voltage IoT prototype

    for i, dt in enumerate(dates):
        is_weekend = dt.weekday() >= 5
        weekend_mult = 1.28 if is_weekend else 0.96
        trend = np.sin(i / 14.0) * 0.10
        noise = np.random.normal(0, 0.05)

        total_kwh = max(0.30, (base_kwh + trend + noise) * weekend_mult)
        light_hours = np.random.uniform(3.5, 6.0) if is_weekend else np.random.uniform(2.0, 4.5)
        fan_hours = np.random.uniform(4.0, 8.5)

        records.append({
            "date": dt,
            "day_of_month": dt.day,
            "day_of_week": dt.weekday(),
            "is_weekend": int(is_weekend),
            "light_runtime_hours": round(light_hours, 2),
            "fan_runtime_hours": round(fan_hours, 2),
            "total_kwh": round(total_kwh, 4)
        })

    df = pd.DataFrame(records)
    return df

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Constructs time-series lag and rolling window features.
    """
    df = df.copy()
    # Lag features
    df["lag_1_kwh"] = df["total_kwh"].shift(1)
    df["lag_2_kwh"] = df["total_kwh"].shift(2)
    # Rolling 7-day average
    df["rolling_7d_mean"] = df["total_kwh"].shift(1).rolling(window=7, min_periods=1).mean()
    # Drop rows with NaN from lagging
    df = df.dropna().reset_index(drop=True)
    return df

def train_and_evaluate():
    """
    Main training function with strict chronological train/test split.
    """
    print("Generating training dataset...")
    raw_df = generate_synthetic_historical_data(days=120)
    feat_df = engineer_features(raw_df)

    feature_cols = [
        "day_of_month",
        "day_of_week",
        "is_weekend",
        "light_runtime_hours",
        "fan_runtime_hours",
        "lag_1_kwh",
        "lag_2_kwh",
        "rolling_7d_mean"
    ]
    target_col = "total_kwh"

    X = feat_df[feature_cols]
    y = feat_df[target_col]

    # Chronological Split (first 75% for training, final 25% for testing)
    split_index = int(len(feat_df) * 0.75)
    X_train, X_test = X.iloc[:split_index], X.iloc[split_index:]
    y_train, y_test = y.iloc[:split_index], y.iloc[split_index:]

    print(f"Dataset Split: {len(X_train)} Train Samples | {len(X_test)} Test Samples")

    # 1. Baseline Model
    baseline = DummyRegressor(strategy="mean")
    baseline.fit(X_train, y_train)
    y_pred_base = baseline.predict(X_test)
    base_mae = mean_absolute_error(y_test, y_pred_base)
    base_rmse = np.sqrt(mean_squared_error(y_test, y_pred_base))
    print(f"[Baseline] MAE: {base_mae:.4f} | RMSE: {base_rmse:.4f}")

    # 2. Linear Ridge
    ridge = Ridge(alpha=1.0)
    ridge.fit(X_train, y_train)
    y_pred_ridge = ridge.predict(X_test)
    ridge_mae = mean_absolute_error(y_test, y_pred_ridge)
    ridge_rmse = np.sqrt(mean_squared_error(y_test, y_pred_ridge))
    print(f"[Ridge Regression] MAE: {ridge_mae:.4f} | RMSE: {ridge_rmse:.4f}")

    # 3. Random Forest Regressor
    rf = RandomForestRegressor(
        n_estimators=100,
        max_depth=6,
        random_state=42,
        min_samples_split=4
    )
    rf.fit(X_train, y_train)
    y_pred_rf = rf.predict(X_test)

    rf_mae = mean_absolute_error(y_test, y_pred_rf)
    rf_rmse = np.sqrt(mean_squared_error(y_test, y_pred_rf))
    rf_r2 = r2_score(y_test, y_pred_rf)
    print(f"[Random Forest] MAE: {rf_mae:.4f} | RMSE: {rf_rmse:.4f} | R2: {rf_r2:.4f}")

    # Feature Importance
    importances = [
        {"feature": col, "importance": round(float(imp), 4)}
        for col, imp in zip(feature_cols, rf.feature_importances_)
    ]
    importances.sort(key=lambda x: x["importance"], reverse=True)

    # Save artifacts
    artifacts = {
        "model": rf,
        "feature_cols": feature_cols,
        "trained_at": datetime.now().isoformat(),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "metrics": {
            "mae": round(float(rf_mae), 4),
            "rmse": round(float(rf_rmse), 4),
            "r2": round(float(rf_r2), 4),
            "baseline_mae": round(float(base_mae), 4)
        },
        "feature_importances": importances
    }

    joblib.dump(artifacts, MODEL_FILE)
    with open(METRICS_FILE, "w") as f:
        json.dump(artifacts["metrics"], f, indent=2)

    print("Model serialized successfully to", MODEL_FILE)
    return artifacts

if __name__ == "__main__":
    train_and_evaluate()
