import os
from typing import Dict, List, Any, Optional, Union
import numpy as np
import joblib
from ml.preference_learner import (
    PreferenceLearner,
    MODEL_PATH,
    SCALER_PATH,
    META_PATH,
    MIN_SAMPLES_REQUIRED,
)
from ml.feature_engineer import CLASS_NAMES


UNIFORM_PREFERENCES = {
    "Morning": round(1.0 / 3.0, 4),
    "Afternoon": round(1.0 / 3.0, 4),
    "Evening": round(1.0 - 2 * round(1.0 / 3.0, 4), 4),
}


class PreferencePredictor:
    """
    Step 4 Preference Predictor:
    - Uses RandomForestClassifier.predict_proba directly to output
      P(Morning), P(Afternoon), P(Evening) summing to 1.0.
    - Enforces the minimum data rule: if fewer than 30 labeled feedback rows
      exist, falls back to uniform preferences and sets
      preference_source = "uniform_fallback".
    """

    def __init__(self, n_available_samples: Optional[int] = None):
        if not os.path.exists(MODEL_PATH) or not os.path.exists(SCALER_PATH) or not os.path.exists(META_PATH):
            learner = PreferenceLearner()
            learner.retrain()
        self.model = joblib.load(MODEL_PATH)
        self.scaler = joblib.load(SCALER_PATH)
        self.meta = joblib.load(META_PATH)
        self.n_available_samples = (
            n_available_samples
            if n_available_samples is not None
            else int(self.meta.get("n_samples", self.meta.get("training_samples", 120)))
        )
        self.preference_source = (
            "uniform_fallback"
            if self.n_available_samples < MIN_SAMPLES_REQUIRED
            else "ml_random_forest"
        )

    @property
    def model_source(self) -> str:
        return self.preference_source

    def predict_preferences(
        self,
        teacher_features: Union[List[float], np.ndarray],
        n_samples_override: Optional[int] = None,
    ) -> Dict[str, float]:
        """
        Predict teacher preference probabilities P(Morning), P(Afternoon), P(Evening).
        Input: 6-feature vector [morning_ratio, afternoon_ratio, evening_ratio, avg_daily_hours, consecutive_classes, free_days]
        Output: {"Morning": float, "Afternoon": float, "Evening": float} summing to 1.0.
        """
        effective_samples = (
            n_samples_override
            if n_samples_override is not None
            else self.n_available_samples
        )
        if effective_samples < MIN_SAMPLES_REQUIRED:
            self.preference_source = "uniform_fallback"
            return dict(UNIFORM_PREFERENCES)

        self.preference_source = "ml_random_forest"
        base_vec = list(teacher_features)
        if len(base_vec) < 6:
            defaults = [0.6, 0.3, 0.1, 3.5, 2.0, 1.0]
            base_vec = base_vec + defaults[len(base_vec) :]
        vec = np.array([base_vec[:6]], dtype=float)

        scaled = self.scaler.transform(vec)
        proba_row = self.model.predict_proba(scaled)[0]
        classes = list(self.model.classes_)

        raw_map = {0: 0.0, 1: 0.0, 2: 0.0}
        for cls_idx, p in zip(classes, proba_row):
            raw_map[int(cls_idx)] = float(p)

        total = sum(raw_map.values())
        if total <= 0:
            return dict(UNIFORM_PREFERENCES)

        p_morning = round(raw_map[0] / total, 4)
        p_afternoon = round(raw_map[1] / total, 4)
        p_evening = round(1.0 - p_morning - p_afternoon, 4)

        return {
            "Morning": p_morning,
            "Afternoon": p_afternoon,
            "Evening": p_evening,
        }

    def predict_for_teacher(
        self,
        teacher_info: Dict[str, Any],
        n_samples_override: Optional[int] = None,
    ) -> Dict[str, float]:
        prefs = teacher_info.get("preferences", {}) or {}
        prefer_morning = prefs.get("prefer_morning", True)
        pref_str = str(
            teacher_info.get("preferred_time") or prefs.get("preferred_time") or ""
        ).lower()

        if "morning_ratio" in teacher_info:
            m_r = float(teacher_info["morning_ratio"])
            a_r = float(teacher_info.get("afternoon_ratio", 0.3))
            e_r = float(teacher_info.get("evening_ratio", max(0.0, 1.0 - m_r - a_r)))
        elif pref_str == "afternoon" or prefer_morning is False:
            m_r, a_r, e_r = 0.25, 0.65, 0.10
        elif pref_str == "evening":
            m_r, a_r, e_r = 0.15, 0.25, 0.60
        else:
            m_r, a_r, e_r = 0.70, 0.22, 0.08

        feature_vec = [
            m_r,
            a_r,
            e_r,
            float(teacher_info.get("avg_daily_hours", teacher_info.get("max_hours_per_day", 3.5))),
            float(teacher_info.get("consecutive_classes", teacher_info.get("num_gaps", 2.0))),
            float(teacher_info.get("free_days", 1.0)),
        ]
        return self.predict_preferences(feature_vec, n_samples_override=n_samples_override)
