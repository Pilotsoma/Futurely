"""
FastAPI microservice serving college admission probability predictions.

This is a standalone Python service - the Node/Express backend calls it over
HTTP (see backend/src/services/collegeProbability.ts) rather than
reimplementing the trained model's math in JS. It receives only raw
SAT/ACT/GPA score values and college averages, never a student's identity.

Development: two processes run side by side.
  1. Node backend:  cd backend && npm run dev            (port 3001)
  2. Model server:   cd model_server && pip install -r requirements.txt
                      uvicorn main:app --reload --port 8001
The Node backend's MODEL_SERVER_URL env var should point at
http://localhost:8001 in dev (this is the default if unset).

Production: Vercel (where the Node backend deploys) cannot host a Python
process alongside its serverless functions, so this service must be deployed
separately (e.g. Railway, Fly.io, Cloud Run, or a small VM) and reachable from
the Node backend over a private/internal network, with MODEL_SERVER_URL
pointed at that deployment. This is a real infrastructure gap to resolve
before this feature ships to production, not just a local dev convenience.
"""

import os
from contextlib import asynccontextmanager
from typing import Literal, Optional

import joblib
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel, Field, model_validator

MODEL_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "model", "college_probability_model.joblib"
)

# Bounds mirror the Field(ge=..., le=...) constraints below, keyed by the
# student-stat field name so /predict-batch can validate ad-hoc adjustments
# against the same range each field normally has on PredictRequest.
STAT_BOUNDS = {
    "studentSat": (400, 1600),
    "studentAct": (1, 36),
    "studentGpa": (0, 5),
}

_bundle: Optional[dict] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _bundle
    _bundle = joblib.load(MODEL_PATH)
    yield


app = FastAPI(title="College Probability Model Server", lifespan=lifespan)


class PredictRequest(BaseModel):
    studentSat: float = Field(ge=400, le=1600)
    studentAct: Optional[float] = Field(default=None, ge=1, le=36)
    studentGpa: float = Field(ge=0, le=5)
    avgSat: float = Field(ge=400, le=1600)
    avgAct: float = Field(ge=1, le=36)
    avgGpa: float = Field(ge=0, le=5)
    acceptanceRate: float = Field(ge=0, le=1)


class PredictResponse(BaseModel):
    probability: float


def _predict_probability(
    student_sat: float,
    student_act: Optional[float],
    student_gpa: float,
    avg_sat: float,
    avg_act: float,
    avg_gpa: float,
    acceptance_rate: float,
) -> float:
    feature_cols = _bundle["feature_cols"]
    has_act = student_act is not None
    act_diff = (student_act - avg_act) if has_act else _bundle["act_diff_impute"]

    row = pd.DataFrame([{
        "sat_diff": student_sat - avg_sat,
        "act_diff": act_diff,
        "gpa_diff": student_gpa - avg_gpa,
        "acceptance_rate": acceptance_rate,
        "has_act": int(has_act),
    }])[feature_cols]

    probability = _bundle["model"].predict_proba(row)[0][1]
    return round(float(probability) * 100, 1)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model_loaded": _bundle is not None}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    probability = _predict_probability(
        req.studentSat, req.studentAct, req.studentGpa,
        req.avgSat, req.avgAct, req.avgGpa, req.acceptanceRate,
    )
    return PredictResponse(probability=probability)


class Adjustment(BaseModel):
    field: Literal["studentSat", "studentAct", "studentGpa"]
    newValue: float

    @model_validator(mode="after")
    def check_new_value_in_bounds(self) -> "Adjustment":
        low, high = STAT_BOUNDS[self.field]
        if not (low <= self.newValue <= high):
            raise ValueError(f"newValue for {self.field} must be between {low} and {high}")
        return self


class PredictBatchRequest(PredictRequest):
    adjustments: list[Adjustment]


class AdjustmentResult(BaseModel):
    field: Literal["studentSat", "studentAct", "studentGpa"]
    newValue: float
    probability: float


class PredictBatchResponse(BaseModel):
    baseline: float
    results: list[AdjustmentResult]


@app.post("/predict-batch", response_model=PredictBatchResponse)
def predict_batch(req: PredictBatchRequest) -> PredictBatchResponse:
    baseline = _predict_probability(
        req.studentSat, req.studentAct, req.studentGpa,
        req.avgSat, req.avgAct, req.avgGpa, req.acceptanceRate,
    )

    results: list[AdjustmentResult] = []
    for adj in req.adjustments:
        sat = adj.newValue if adj.field == "studentSat" else req.studentSat
        act = adj.newValue if adj.field == "studentAct" else req.studentAct
        gpa = adj.newValue if adj.field == "studentGpa" else req.studentGpa

        probability = _predict_probability(
            sat, act, gpa, req.avgSat, req.avgAct, req.avgGpa, req.acceptanceRate,
        )
        results.append(AdjustmentResult(field=adj.field, newValue=adj.newValue, probability=probability))

    return PredictBatchResponse(baseline=baseline, results=results)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("MODEL_SERVER_PORT", 8001)))
