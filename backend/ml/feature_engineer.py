import zlib
from typing import List, Dict, Any, Optional, Tuple
import numpy as np


TIME_PREF_MAP = {
    "morning": 0,
    "afternoon": 1,
    "evening": 2,
}

DEPT_MAP = {
    "computer science": 0,
    "information theory": 1,
    "software engineering": 2,
    "mathematics": 3,
    "engineering": 4,
}


def encode_time_preference(pref: Optional[str]) -> int:
    if not pref:
        return 0
    return TIME_PREF_MAP.get(pref.strip().lower(), 0)


def encode_department(dept: Optional[str]) -> int:
    if not dept:
        return 0
    key = dept.strip().lower()
    if key in DEPT_MAP:
        return DEPT_MAP[key]
    # Deterministic cross-process hash using CRC32
    return zlib.crc32(key.encode("utf-8")) % 5


class FeatureEngineer:
    """
    Extracts a 6-dimensional feature vector from teacher feedback and history:
      1. teaching_hours (1-6)
      2. preferred_time encoded (0=Morning, 1=Afternoon, 2=Evening)
      3. num_gaps between classes (0-5)
      4. department encoded (0-4)
      5. experience_years (1-30)
      6. previous_satisfaction average (1.0-5.0)
    """

    def extract_features(
        self,
        feedback_data: List[Dict[str, Any]],
        teacher_history: Optional[Dict[Any, Dict[str, Any]]] = None,
    ) -> Tuple[np.ndarray, np.ndarray]:
        teacher_history = teacher_history or {}
        features = []
        labels = []

        for record in feedback_data:
            t_id = record.get("teacher_id", 1)
            t_info = teacher_history.get(t_id, {})

            teaching_hours = float(record.get("teaching_hours", t_info.get("teaching_hours", 4)))
            pref_encoded = float(encode_time_preference(record.get("preferred_time", "Morning")))
            num_gaps = float(record.get("num_gaps", t_info.get("num_gaps", 1)))
            dept_encoded = float(
                encode_department(record.get("department", t_info.get("department", "Computer Science")))
            )
            exp_years = float(record.get("experience_years", t_info.get("experience_years", 5)))
            prev_scores = t_info.get("previous_satisfaction", [4.0])
            prev_avg = float(np.mean(prev_scores)) if prev_scores else 4.0

            feature_vec = [
                teaching_hours,
                pref_encoded,
                num_gaps,
                dept_encoded,
                exp_years,
                prev_avg,
            ]

            label = int(record.get("satisfaction_score", 4))
            features.append(feature_vec)
            labels.append(label)

        if not features:
            return np.empty((0, 6)), np.empty((0,), dtype=int)

        return np.array(features, dtype=float), np.array(labels, dtype=int)

    @staticmethod
    def generate_synthetic_training_data(
        n_samples: int = 150,
    ) -> Tuple[List[Dict[str, Any]], Dict[int, Dict[str, Any]]]:
        rng = np.random.default_rng(42)
        departments = list(DEPT_MAP.keys())

        teacher_history: Dict[int, Dict[str, Any]] = {}
        for tid in range(1, 21):
            exp = int(rng.integers(2, 25))
            teacher_history[tid] = {
                "department": departments[tid % len(departments)],
                "experience_years": exp,
                "previous_satisfaction": [4.0 if exp > 10 else 3.5],
            }

        feedback_data: List[Dict[str, Any]] = []
        for i in range(n_samples):
            tid = (i % 20) + 1
            t_info = teacher_history[tid]
            hours = int(rng.integers(2, 7))
            gaps = int(rng.integers(0, 4))

            if t_info["experience_years"] >= 10:
                pref_time = "Morning"
            elif tid % 2 == 0:
                pref_time = "Afternoon"
            else:
                pref_time = "Evening"

            # Structured, learnable target function for satisfaction (1-5)
            base_score = 5
            if gaps >= 2:
                base_score -= 1
            if gaps >= 3:
                base_score -= 1
            if hours >= 5:
                base_score -= 1
            if pref_time == "Evening":
                base_score -= 1
            score = int(np.clip(base_score, 1, 5))

            feedback_data.append(
                {
                    "teacher_id": tid,
                    "teaching_hours": hours,
                    "preferred_time": pref_time,
                    "num_gaps": gaps,
                    "department": t_info["department"],
                    "experience_years": t_info["experience_years"],
                    "satisfaction_score": score,
                }
            )

        return feedback_data, teacher_history
