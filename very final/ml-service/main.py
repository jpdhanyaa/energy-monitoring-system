"""
AI Smart Energy Management System - FastAPI ML Prediction Microservice
Exposes REST endpoints for real-time monthly kWh forecasting and tariff bill projection.
"""

import os
import json
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import numpy as np
import pandas as pd
import joblib

from train import MODEL_FILE, train_and_evaluate

app = FastAPI(
    title="AI Smart Energy Management - ML Forecasting Service",
    description="FastAPI service utilizing Random Forest Regression to predict monthly electricity usage & bills.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# PYDANTIC SCHEMAS
# -----------------------------------------------------------------------------
class HistoricalDay(BaseModel):
    date: str
    total_kwh: float
    light_hours: Optional[float] = 3.0
    fan_hours: Optional[float] = 5.0

class TariffRate(BaseModel):
    is_slab_based: bool = True
    flat_rate: float = 4.5
    fixed_charge: float = 80.0
    tax_percent: float = 9.0

class PredictionRequest(BaseModel):
    device_id: str
    month_to_date_kwh: float = Field(..., ge=0.0, description="Cumulative kWh recorded so far this month")
    recent_history: List[HistoricalDay] = Field(..., description="Last 7 to 30 days daily readings")
    tariff: Optional[TariffRate] = TariffRate()

class FeatureImportance(BaseModel):
    feature: str
    importance: float

class PredictionResponse(BaseModel):
    device_id: str
    model_name: str
    current_month_forecast_kwh: float
    remaining_days_forecast_kwh: float
    confidence_interval_kwh: List[float]
    estimated_bill_inr: float
    mae: float
    rmse: float
    r2_score: float
    data_source: str
    generated_at: str
    feature_importances: List[FeatureImportance]

# -----------------------------------------------------------------------------
# MODEL LOADER
# -----------------------------------------------------------------------------
def get_or_load_model():
    if not os.path.exists(MODEL_FILE):
        print("Model file not found. Running initial training pipeline...")
        return train_and_evaluate()
    return joblib.load(MODEL_FILE)

# -----------------------------------------------------------------------------
# BILL ESTIMATOR HELPER
# -----------------------------------------------------------------------------
def estimate_bill(units_kwh: float, tariff: TariffRate) -> float:
    if not tariff.is_slab_based:
        energy_cost = units_kwh * tariff.flat_rate
    else:
        # Standard domestic tiered slabs (BESCOM / TNEB style)
        cost = 0.0
        rem = units_kwh
        # Slab 1: 0 - 50 units @ 4.15
        s1 = min(rem, 50.0)
        cost += s1 * 4.15
        rem = max(0.0, rem - 50.0)
        # Slab 2: 51 - 100 units @ 5.60
        s2 = min(rem, 50.0)
        cost += s2 * 5.60
        rem = max(0.0, rem - 50.0)
        # Slab 3: 101 - 200 units @ 7.15
        s3 = min(rem, 100.0)
        cost += s3 * 7.15
        rem = max(0.0, rem - 100.0)
        # Slab 4: > 200 units @ 8.20
        cost += rem * 8.20
        energy_cost = cost

    subtotal = energy_cost + tariff.fixed_charge
    total = subtotal * (1.0 + (tariff.tax_percent / 100.0))
    return round(total, 2)

# -----------------------------------------------------------------------------
# REST ENDPOINTS
# -----------------------------------------------------------------------------
@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "online",
        "service": "ML Forecasting API",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/predict/monthly", response_model=PredictionResponse, tags=["Forecasting"])
def predict_monthly_energy(request: PredictionRequest):
    artifacts = get_or_load_model()
    model = artifacts["model"]
    feature_cols = artifacts["feature_cols"]
    metrics = artifacts["metrics"]

    now = datetime.now()
    day_of_month = now.day
    # Days in current month
    next_month = now.replace(day=28) + timedelta(days=4)
    days_in_month = (next_month - timedelta(days=next_month.day)).day
    remaining_days = max(0, days_in_month - day_of_month)

    # Compute rolling metrics from recent history
    history_kwhs = [d.total_kwh for d in request.recent_history]
    if not history_kwhs:
        history_kwhs = [0.65] # Fallback if history list is empty

    rolling_7d = float(np.mean(history_kwhs[-7:]))
    lag_1 = float(history_kwhs[-1])
    lag_2 = float(history_kwhs[-2]) if len(history_kwhs) > 1 else lag_1

    # Predict day-by-day for remaining days
    simulated_future_kwh = 0.0
    current_lag1 = lag_1
    current_lag2 = lag_2

    for r in range(1, remaining_days + 1):
        future_dt = now + timedelta(days=r)
        is_wknd = int(future_dt.weekday() >= 5)

        sample = pd.DataFrame([{
            "day_of_month": future_dt.day,
            "day_of_week": future_dt.weekday(),
            "is_weekend": is_wknd,
            "light_runtime_hours": 4.5 if is_wknd else 3.0,
            "fan_runtime_hours": 6.5,
            "lag_1_kwh": current_lag1,
            "lag_2_kwh": current_lag2,
            "rolling_7d_mean": rolling_7d
        }])[feature_cols]

        pred_day = float(model.predict(sample)[0])
        simulated_future_kwh += pred_day
        current_lag2 = current_lag1
        current_lag1 = pred_day

    total_projected_month_kwh = round(request.month_to_date_kwh + simulated_future_kwh, 2)
    uncertainty = round(1.96 * metrics["rmse"] * np.sqrt(max(1, remaining_days)), 2)

    bill_inr = estimate_bill(total_projected_month_kwh, request.tariff)

    return PredictionResponse(
        device_id=request.device_id,
        model_name="Random Forest Regressor (100 Estimators)",
        current_month_forecast_kwh=total_projected_month_kwh,
        remaining_days_forecast_kwh=round(simulated_future_kwh, 2),
        confidence_interval_kwh=[
            round(max(request.month_to_date_kwh, total_projected_month_kwh - uncertainty), 2),
            round(total_projected_month_kwh + uncertainty, 2)
        ],
        estimated_bill_inr=bill_inr,
        mae=metrics["mae"],
        rmse=metrics["rmse"],
        r2_score=metrics["r2"],
        data_source="physical" if "esp32" in request.device_id and not request.device_id.endswith("-sim") else "simulated",
        generated_at=datetime.now().isoformat(),
        feature_importances=artifacts["feature_importances"]
    )

@app.post("/train", tags=["Model Lifecycle"])
def trigger_retraining():
    artifacts = train_and_evaluate()
    return {
        "status": "Retraining completed successfully",
        "train_samples": artifacts["train_samples"],
        "test_samples": artifacts["test_samples"],
        "metrics": artifacts["metrics"],
        "trained_at": artifacts["trained_at"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
