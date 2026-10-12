import os
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import StratifiedKFold, cross_val_score
from ml.feature_engineer import FeatureEngineer

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH = os.path.join(MODELS_DIR, "preference_model.pkl")
SCALER_PATH = os.path.join(MODELS_DIR, "scaler.pkl")
META_PATH = os.path.join(MODELS_DIR, "model_meta.pkl")

MIN_SAMPLES_REQUIRED = 30


class PreferenceLearner:
    def __init__(self):
        os.makedirs(MODELS_DIR, exist_ok=True)
        self.model = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
        self.scaler = StandardScaler()
        from ml.feature_engineer import get_synthetic_csv_paths
        self.synthetic_csv_path = get_synthetic_csv_paths()[0]

    def train_from_feedback_rows(
        self,
        feedback_rows: Optional[List[Dict[str, Any]]] = None,
        include_synthetic_baseline: bool = True,
    ) -> Dict[str, Any]:
        return self.retrain(
            new_feedback_data=feedback_rows,
            use_synthetic_if_needed=include_synthetic_baseline,
        )

    def train(
        self,
        X_features: np.ndarray,
        y_labels: np.ndarray,
        n_real_samples: int = 0,
        n_synthetic_samples: Optional[int] = None,
        allow_synthetic_augment: bool = True,
    ) -> Dict[str, Any]:
        """
        Train RandomForestClassifier with fixed random_state=42 and evaluate
        5-fold cross-validation accuracy (Step 4).
        """
        if len(X_features) < MIN_SAMPLES_REQUIRED and allow_synthetic_augment:
            fe = FeatureEngineer()
            syn_fb, syn_hist = fe.generate_synthetic_training_data(n_samples=120)
            X_syn, y_syn = fe.extract_features(syn_fb, syn_hist)
            n_real_samples = len(X_features)
            n_synthetic_samples = len(X_syn)
            if len(X_features) > 0:
                X_features = np.vstack([X_syn, X_features])
                y_labels = np.concatenate([y_syn, y_labels])
            else:
                X_features, y_labels = X_syn, y_syn
        else:
            if n_synthetic_samples is None:
                n_synthetic_samples = max(0, len(X_features) - n_real_samples)

        total_samples = int(len(X_features))
        prev_version = 0
        if os.path.exists(META_PATH):
            try:
                old_meta = joblib.load(META_PATH)
                prev_version = int(
                    old_meta.get("version") or old_meta.get("model_version") or 0
                )
            except Exception:
                prev_version = 0

        now_iso = datetime.now(timezone.utc).isoformat()

        if total_samples < MIN_SAMPLES_REQUIRED:
            meta = {
                "version": prev_version + 1,
                "model_version": prev_version + 1,
                "n_samples": total_samples,
                "training_samples": total_samples,
                "n_real_samples": int(n_real_samples),
                "n_synthetic_samples": int(n_synthetic_samples or 0),
                "cv_accuracy": {"mean": 0.0, "std": 0.0},
                "model_accuracy": 0.0,
                "train_accuracy": 0.0,
                "trained_at": now_iso,
                "trained_on": now_iso,
                "last_retrain": now_iso,
                "preference_source": "uniform_fallback",
                "data_source_label": (
                    "INSUFFICIENT DATA (<30 ROWS) - UNIFORM FALLBACK"
                    if n_synthetic_samples == 0
                    else "SYNTHETIC TRAINING DATA"
                ),
            }
            joblib.dump(meta, META_PATH)
            return meta

        X_scaled = self.scaler.fit_transform(X_features)

        # 5-fold Stratified Cross-Validation
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        cv_scores = cross_val_score(self.model, X_scaled, y_labels, cv=cv, scoring="accuracy")
        cv_mean = round(float(np.mean(cv_scores)), 4)
        cv_std = round(float(np.std(cv_scores)), 4)

        self.model.fit(X_scaled, y_labels)
        train_acc = round(float(self.model.score(X_scaled, y_labels)), 4)

        meta = {
            "version": prev_version + 1,
            "model_version": prev_version + 1,
            "n_samples": total_samples,
            "training_samples": total_samples,
            "n_real_samples": int(n_real_samples),
            "n_synthetic_samples": int(n_synthetic_samples or 0),
            "cv_accuracy": {
                "mean": cv_mean,
                "std": cv_std,
            },
            "model_accuracy": cv_mean,
            "train_accuracy": train_acc,
            "trained_at": now_iso,
            "trained_on": now_iso,
            "last_retrain": now_iso,
            "preference_source": "ml_random_forest",
            "data_source_label": (
                "SYNTHETIC TRAINING DATA"
                if (n_synthetic_samples or 0) > 0
                else "REAL FEEDBACK DATA"
            ),
        }

        joblib.dump(self.model, MODEL_PATH)
        joblib.dump(self.scaler, SCALER_PATH)
        joblib.dump(meta, META_PATH)

        return meta

    def retrain(
        self,
        new_feedback_data: Optional[List[Dict[str, Any]]] = None,
        teacher_history: Optional[Dict[Any, Dict[str, Any]]] = None,
        use_synthetic_if_needed: bool = True,
    ) -> Dict[str, Any]:
        fe = FeatureEngineer()
        real_rows = [
            r for r in (new_feedback_data or []) if r.get("source") != "synthetic"
        ]
        syn_rows = [
            r for r in (new_feedback_data or []) if r.get("source") == "synthetic"
        ]

        if not use_synthetic_if_needed:
            X, y = fe.extract_features(real_rows, teacher_history or {})
            return self.train(
                X,
                y,
                n_real_samples=len(real_rows),
                n_synthetic_samples=0,
                allow_synthetic_augment=False,
            )

        syn_fb, syn_hist = fe.generate_synthetic_training_data(n_samples=120)
        if teacher_history:
            syn_hist.update(teacher_history)
        combined_fb = syn_fb + syn_rows + real_rows
        X, y = fe.extract_features(combined_fb, syn_hist)
        return self.train(
            X,
            y,
            n_real_samples=len(real_rows),
            n_synthetic_samples=len(syn_fb) + len(syn_rows),
            allow_synthetic_augment=True,
        )

    @staticmethod
    def get_model_stats() -> Dict[str, Any]:
        if not os.path.exists(META_PATH):
            learner = PreferenceLearner()
            return learner.retrain()
        try:
            meta = joblib.load(META_PATH)
            if "cv_accuracy" not in meta or "n_synthetic_samples" not in meta:
                learner = PreferenceLearner()
                return learner.retrain()
            return meta
        except Exception:
            learner = PreferenceLearner()
            return learner.retrain()
