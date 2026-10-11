import os
from typing import Dict, List, Any, Union
import numpy as np
import joblib
from ml.preference_learner import PreferenceLearner, MODEL_PATH, SCALER_PATH
from ml.feature_engineer import encode_department


class PreferencePredictor:
    def __init__(self):
        if not os.path.exists(MODEL_PATH) or not os.path.exists(SCALER_PATH):
            learner = PreferenceLearner()
            learner.retrain()
        self.model = joblib.load(MODEL_PATH)
        self.scaler = joblib.load(SCALER_PATH)

    def predict_preferences(self, teacher_features: Union[List[float], np.ndarray]) -> Dict[str, float]:
        """
        Predict teacher preference probabilities for Morning, Afternoon, and Evening.
        Input: 6-feature vector [teaching_hours, preferred_time_enc, num_gaps, dept_enc, experience_years, prev_satisfaction]
        Output: {"Morning": float, "Afternoon": float, "Evening": float} in [0, 1]
        """
        base_vec = list(teacher_features)
        if len(base_vec) < 6:
            # Pad with sensible defaults if shorter vector passed
            defaults = [4.0, 0.0, 1.0, 0.0, 5.0, 4.0]
            base_vec = base_vec + defaults[len(base_vec) :]

        # Evaluate expected high-satisfaction probability across time periods (0=Morning, 1=Afternoon, 2=Evening)
        candidates = []
        for time_code in (0.0, 1.0, 2.0):
            vec = list(base_vec[:6])
            vec[1] = time_code
            candidates.append(vec)

        scaled = self.scaler.transform(candidates)
        probas = self.model.predict_proba(scaled)
        classes = list(self.model.classes_)

        scores = []
        for row_proba in probas:
            # Weighted expected satisfaction normalized to [0, 1]
            expected_sat = sum(c * p for c, p in zip(classes, row_proba))
            norm_prob = float(np.clip((expected_sat - 1.0) / 4.0, 0.15, 0.95))
            scores.append(round(norm_prob, 3))

        # Apply slight boost to the teacher's stated time code in base_vec[1]
        stated_code = int(base_vec[1]) if 0 <= int(base_vec[1]) <= 2 else 0
        scores[stated_code] = round(float(np.clip(scores[stated_code] + 0.15, 0.2, 0.95)), 3)

        return {
            "Morning": scores[0],
            "Afternoon": scores[1],
            "Evening": scores[2],
        }

    def predict_for_teacher(self, teacher_info: Dict[str, Any]) -> Dict[str, float]:
        prefs = teacher_info.get("preferences", {}) or {}
        prefer_morning = prefs.get("prefer_morning", True)
        time_code = 0.0 if prefer_morning else 1.0
        if str(teacher_info.get("preferred_time", "")).lower() == "afternoon":
            time_code = 1.0
        elif str(teacher_info.get("preferred_time", "")).lower() == "evening":
            time_code = 2.0

        feature_vec = [
            float(teacher_info.get("max_hours_per_day", 4)),
            time_code,
            float(teacher_info.get("num_gaps", 1)),
            float(encode_department(teacher_info.get("department", "Computer Science"))),
            float(teacher_info.get("experience_years", 5)),
            float(teacher_info.get("previous_satisfaction", 4.2)),
        ]
        return self.predict_preferences(feature_vec)
