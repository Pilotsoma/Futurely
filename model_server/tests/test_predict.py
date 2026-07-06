"""
QA test suite for the College Probability Model Server.

Tests the FastAPI /predict and /health endpoints using FastAPI's built-in
TestClient (httpx-backed, no running server required). The trained model
artifact at model/college_probability_model.joblib must exist before running
these tests — generate it with: python model/train_model.py

Run with:
    cd model_server
    python -m pytest tests/test_predict.py -v

Coverage:
    - Happy path: high-stats applicant vs. highly selective college → low probability
    - Happy path: high-stats applicant vs. open-admission college → high probability
    - Low stats vs. selective college → very low probability
    - studentAct=null → does not crash, returns valid 0-100 probability
    - Out-of-range input → 422 Unprocessable Entity (Pydantic validation)
    - /health returns ok with model_loaded=true
    - No student PII ever reaches the model server (structural assertion)
    - acceptanceRate 0-1 decimal is passed through correctly (not multiplied by 100)
"""

import pytest
from fastapi.testclient import TestClient

import sys
import os

# Allow import of main.py from the model_server directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app  # noqa: E402  (import after sys.path manipulation)

# Use the context-manager form of TestClient so that the FastAPI lifespan hook
# fires (the lifespan loads the .joblib model bundle into _bundle). Without
# entering the context manager, _bundle stays None and all /predict calls crash.
@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------

class TestHealth:
    def test_health_returns_ok_with_model_loaded(self, client):
        """GET /health should return status=ok and model_loaded=true after startup."""
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["model_loaded"] is True


# ---------------------------------------------------------------------------
# Happy path — direction-of-effect assertions
# ---------------------------------------------------------------------------

class TestPredictHappyPath:
    def test_high_stats_vs_highly_selective_college_gives_low_probability(self, client):
        """
        A student with strong stats (SAT 1500, GPA 3.8) applying to a highly
        selective college (avg SAT 1520, avg GPA 3.9, 3.2% acceptance rate)
        should receive a probability BELOW 50%. The model's synthetic training
        data calibrates baseline probability to the acceptance rate, so an
        above-average applicant at a 3.2%-admit-rate school should still score
        well below 50%.
        """
        resp = client.post("/predict", json={
            "studentSat": 1500,
            "studentAct": 33,
            "studentGpa": 3.8,
            "avgSat": 1520,
            "avgAct": 34,
            "avgGpa": 3.9,
            "acceptanceRate": 0.032,  # Harvard-tier: 3.2%
        })
        assert resp.status_code == 200
        probability = resp.json()["probability"]
        assert 0 <= probability <= 100, f"Probability {probability} is outside 0-100"
        assert probability < 50, (
            f"Expected probability < 50 for a highly selective school (3.2% accept rate), "
            f"got {probability}"
        )

    def test_high_stats_vs_high_acceptance_rate_college_gives_high_probability(self, client):
        """
        A strong student (SAT 1400, GPA 3.7) applying to a school with a 70%
        acceptance rate and modest averages (SAT 1050, GPA 3.0) should receive
        a probability ABOVE 70%.
        """
        resp = client.post("/predict", json={
            "studentSat": 1400,
            "studentAct": 30,
            "studentGpa": 3.7,
            "avgSat": 1050,
            "avgAct": 22,
            "avgGpa": 3.0,
            "acceptanceRate": 0.70,
        })
        assert resp.status_code == 200
        probability = resp.json()["probability"]
        assert 0 <= probability <= 100, f"Probability {probability} is outside 0-100"
        assert probability > 70, (
            f"Expected probability > 70 for a strong student at a 70%-accept-rate school, "
            f"got {probability}"
        )

    def test_low_stats_vs_selective_college_gives_very_low_probability(self, client):
        """
        A below-average student (SAT 900, GPA 2.5) applying to a selective
        college (avg SAT 1480, avg GPA 3.85, 7.5% acceptance rate) should
        receive a very low probability (< 10%).
        """
        resp = client.post("/predict", json={
            "studentSat": 900,
            "studentAct": 19,
            "studentGpa": 2.5,
            "avgSat": 1480,
            "avgAct": 32,
            "avgGpa": 3.85,
            "acceptanceRate": 0.075,
        })
        assert resp.status_code == 200
        probability = resp.json()["probability"]
        assert 0 <= probability <= 100, f"Probability {probability} is outside 0-100"
        assert probability < 10, (
            f"Expected probability < 10 for low-stats vs. selective college, got {probability}"
        )

    def test_null_student_act_does_not_crash(self, client):
        """
        studentAct=null must not crash the model server. The model's act_diff
        imputation path handles missing ACT by substituting the training mean
        and setting has_act=0. This test verifies the result is a valid 0-100
        float, not an error.
        """
        resp = client.post("/predict", json={
            "studentSat": 1200,
            "studentAct": None,  # explicitly null
            "studentGpa": 3.4,
            "avgSat": 1200,
            "avgAct": 27,
            "avgGpa": 3.4,
            "acceptanceRate": 0.50,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "probability" in data
        probability = data["probability"]
        assert isinstance(probability, float), f"Expected float, got {type(probability)}"
        assert 0 <= probability <= 100, f"Probability {probability} is outside 0-100"

    def test_omitted_student_act_also_does_not_crash(self, client):
        """
        studentAct can also be omitted from the request body entirely (optional
        field in Pydantic schema). Verify this is accepted and returns valid output.
        """
        resp = client.post("/predict", json={
            "studentSat": 1200,
            "studentGpa": 3.4,
            "avgSat": 1200,
            "avgAct": 27,
            "avgGpa": 3.4,
            "acceptanceRate": 0.50,
        })
        assert resp.status_code == 200
        probability = resp.json()["probability"]
        assert 0 <= probability <= 100, f"Probability {probability} is outside 0-100"

    def test_probability_is_in_0_to_100_range(self, client):
        """
        The model server multiplies the raw logistic probability by 100 before
        returning it. Verify the endpoint always returns a value in [0, 100]
        for a typical well-formed request.
        """
        resp = client.post("/predict", json={
            "studentSat": 1350,
            "studentAct": 29,
            "studentGpa": 3.6,
            "avgSat": 1300,
            "avgAct": 28,
            "avgGpa": 3.5,
            "acceptanceRate": 0.40,
        })
        assert resp.status_code == 200
        probability = resp.json()["probability"]
        assert 0 <= probability <= 100


# ---------------------------------------------------------------------------
# Input validation — 422 Unprocessable Entity
# ---------------------------------------------------------------------------

class TestInputValidation:
    def test_sat_above_1600_returns_422(self, client):
        """studentSat > 1600 violates Field(le=1600) — Pydantic must reject with 422."""
        resp = client.post("/predict", json={
            "studentSat": 1700,
            "studentGpa": 3.5,
            "avgSat": 1300,
            "avgAct": 28,
            "avgGpa": 3.4,
            "acceptanceRate": 0.35,
        })
        assert resp.status_code == 422

    def test_sat_below_400_returns_422(self, client):
        """studentSat < 400 violates Field(ge=400)."""
        resp = client.post("/predict", json={
            "studentSat": 200,
            "studentGpa": 3.5,
            "avgSat": 1300,
            "avgAct": 28,
            "avgGpa": 3.4,
            "acceptanceRate": 0.35,
        })
        assert resp.status_code == 422

    def test_act_above_36_returns_422(self, client):
        """studentAct > 36 violates Field(le=36)."""
        resp = client.post("/predict", json={
            "studentSat": 1200,
            "studentAct": 37,
            "studentGpa": 3.0,
            "avgSat": 1200,
            "avgAct": 27,
            "avgGpa": 3.0,
            "acceptanceRate": 0.40,
        })
        assert resp.status_code == 422

    def test_gpa_above_5_returns_422(self, client):
        """studentGpa > 5 violates Field(le=5)."""
        resp = client.post("/predict", json={
            "studentSat": 1200,
            "studentGpa": 5.5,
            "avgSat": 1200,
            "avgAct": 27,
            "avgGpa": 3.0,
            "acceptanceRate": 0.40,
        })
        assert resp.status_code == 422

    def test_acceptance_rate_above_1_returns_422(self, client):
        """acceptanceRate > 1 (e.g. 0.06 passed as 6 instead of 0.06) returns 422."""
        resp = client.post("/predict", json={
            "studentSat": 1200,
            "studentGpa": 3.0,
            "avgSat": 1200,
            "avgAct": 27,
            "avgGpa": 3.0,
            "acceptanceRate": 6.0,  # caller bug: sent percentage not decimal
        })
        assert resp.status_code == 422

    def test_missing_required_field_returns_422(self, client):
        """Request missing studentSat (required field) returns 422."""
        resp = client.post("/predict", json={
            "studentGpa": 3.5,
            "avgSat": 1300,
            "avgAct": 28,
            "avgGpa": 3.4,
            "acceptanceRate": 0.35,
        })
        assert resp.status_code == 422

    def test_wrong_type_for_sat_returns_422(self, client):
        """studentSat sent as a string (not a number) returns 422."""
        resp = client.post("/predict", json={
            "studentSat": "twelve hundred",
            "studentGpa": 3.5,
            "avgSat": 1300,
            "avgAct": 28,
            "avgGpa": 3.4,
            "acceptanceRate": 0.35,
        })
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Security: no PII reaches the model server
# ---------------------------------------------------------------------------

class TestNoPiiReachesModelServer:
    """
    Structural test verifying the /predict request schema contains only numeric
    fields, never student identity fields (name, email, userId, schoolId, etc.).
    This mirrors the FERPA requirement that student PII must not leave the Node
    backend's trust boundary.
    """

    IDENTITY_FIELDS = {
        "userId", "studentId", "name", "email", "firstName", "lastName",
        "schoolId", "districtId", "phone", "address",
    }

    def test_predict_schema_contains_no_identity_fields(self):
        """
        The PredictRequest Pydantic model's field names must not include any
        identity or PII field names. Only numeric academic score fields are allowed.
        """
        from main import PredictRequest
        model_fields = set(PredictRequest.model_fields.keys())
        pii_intersection = model_fields & self.IDENTITY_FIELDS
        assert pii_intersection == set(), (
            f"PredictRequest contains PII fields: {pii_intersection}. "
            "Student identity data must never be sent to the model server."
        )

    def test_predict_request_only_contains_numeric_academic_fields(self):
        """
        All fields in PredictRequest should be numeric (float/int/Optional[float]).
        This asserts no string or free-text field can carry student identity.
        """
        from main import PredictRequest
        import typing
        for field_name, field_info in PredictRequest.model_fields.items():
            annotation = field_info.annotation
            # Unwrap Optional[X] → X
            origin = getattr(annotation, "__origin__", None)
            if origin is typing.Union:
                inner_types = [t for t in annotation.__args__ if t is not type(None)]
                annotation = inner_types[0] if inner_types else annotation
            assert annotation in (float, int), (
                f"Field '{field_name}' has type {annotation!r} — "
                "only numeric types are allowed in PredictRequest (no string/PII fields)."
            )
