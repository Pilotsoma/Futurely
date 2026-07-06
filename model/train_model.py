"""
Train a synthetic-data logistic regression model that estimates a student's
admission probability at a given college, based on how their SAT/ACT/GPA
compare to that college's published averages and its overall acceptance rate.

LIMITATION (read before trusting this model): there is no real student-level
admit/deny outcome data available to this project. To get any training signal
at all, this script *simulates* ~200 applicants per college (drawn from normal
distributions centered on that college's data/colleges.csv averages) and
*derives* a synthetic admit/deny label from a logistic function of how far
above/below average each simulated applicant is, calibrated so that an
average-stats applicant's simulated admit probability roughly equals the
college's real acceptance rate. This approximates realistic admissions
behavior (better relative stats raise probability, more selective schools
have a lower baseline) but the model has NEVER seen a real admissions
decision. Treat its output as a statistical estimate for planning purposes,
not a validated predictor of real outcomes.
"""

import os

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.model_selection import train_test_split

RANDOM_SEED = 42
APPLICANTS_PER_COLLEGE = 200
SAT_STD = 90.0
ACT_STD = 2.5
GPA_STD = 0.2
ACT_MISSING_RATE = 0.3  # share of simulated applicants with no ACT score, mirroring real test-optional behavior
LOGISTIC_SLOPE = 1.5    # how strongly relative stats move an applicant's simulated odds

FEATURE_COLS = ["sat_diff", "act_diff", "gpa_diff", "acceptance_rate", "has_act"]


def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def logit(p: float) -> float:
    p = min(max(p, 1e-4), 1 - 1e-4)
    return float(np.log(p / (1 - p)))


def simulate_college_applicants(college: "pd.Series", rng: np.random.Generator) -> pd.DataFrame:
    n = APPLICANTS_PER_COLLEGE
    sat = rng.normal(college.avg_sat, SAT_STD, n)
    act = rng.normal(college.avg_act, ACT_STD, n)
    gpa = rng.normal(college.avg_gpa, GPA_STD, n)

    has_act = rng.random(n) >= ACT_MISSING_RATE
    act = np.where(has_act, act, np.nan)

    sat_z = (sat - college.avg_sat) / SAT_STD
    gpa_z = (gpa - college.avg_gpa) / GPA_STD
    act_z = np.where(has_act, (act - college.avg_act) / ACT_STD, 0.0)

    # GPA and SAT carry most of the weight; ACT contributes when present, and
    # its weight is redistributed to SAT/GPA when absent so missing an ACT
    # score never itself penalizes an applicant.
    z = np.where(
        has_act,
        0.4 * sat_z + 0.4 * gpa_z + 0.2 * act_z,
        0.5 * sat_z + 0.5 * gpa_z,
    )

    # Calibrate so an average applicant (z=0) has a simulated admit
    # probability equal to the college's real acceptance rate; applicants
    # above/below average shift up/down from that baseline.
    intercept = logit(college.acceptance_rate)
    admit_prob = sigmoid(LOGISTIC_SLOPE * z + intercept)
    admitted = rng.random(n) < admit_prob

    return pd.DataFrame({
        "sat_diff": sat - college.avg_sat,
        "act_diff": act - college.avg_act,
        "gpa_diff": gpa - college.avg_gpa,
        "acceptance_rate": college.acceptance_rate,
        "has_act": has_act.astype(int),
        "admitted": admitted.astype(int),
    })


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(here, "..", "data", "colleges.csv")
    colleges = pd.read_csv(csv_path, comment="#")
    colleges.columns = [c.strip() for c in colleges.columns]

    rng = np.random.default_rng(RANDOM_SEED)
    data = pd.concat(
        [simulate_college_applicants(row, rng) for row in colleges.itertuples(index=False)],
        ignore_index=True,
    )

    # Impute missing act_diff with the mean act_diff among applicants who did
    # report an ACT score. has_act=0 tells the model this value is a neutral
    # placeholder rather than a genuine above/below-average signal.
    act_diff_impute = float(data.loc[data["has_act"] == 1, "act_diff"].mean())
    data["act_diff"] = data["act_diff"].fillna(act_diff_impute)

    X = data[FEATURE_COLS]
    y = data["admitted"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
    )

    model = LogisticRegression(max_iter=1000)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]
    accuracy = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba)

    print(f"Trained on {len(colleges)} colleges, {len(data)} synthetic applicants")
    print(f"Test accuracy: {accuracy:.4f}")
    print(f"Test AUC:      {auc:.4f}")

    out_path = os.path.join(here, "college_probability_model.joblib")
    joblib.dump(
        {"model": model, "feature_cols": FEATURE_COLS, "act_diff_impute": act_diff_impute},
        out_path,
    )
    print(f"Model saved to {out_path}")


if __name__ == "__main__":
    main()
