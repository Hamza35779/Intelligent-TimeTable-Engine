import os
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from ml.feature_engineer import FeatureEngineer

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH = os.path.join(MODELS_DIR, "preference_model.pkl")
SCALER_PATH = os.path.join(MODELS_DIR, "scaler.pkl")
META_PATH = os.path.join(MODELS_DIR, "model_meta.pkl")


class PreferenceLearner:
    def __init__(self):
        os.makedirs(MODELS_DIR, exist_ok=True)
        self.model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
        self.scaler = StandardScaler()

    def train(self, X_features: np.ndarray, y_labels: np.ndarray) -> Dict[str, Any]:
        """
        Train Random Forest model on historical/synthetic teacher feedback.
        """
        if len(X_features) < 5:
            fe = FeatureEngineer()
            syn_fb, syn_hist = fe.generate_synthetic_training_data(n_samples=120)
            X_syn, y_syn = fe.extract_features(syn_fb, syn_hist)
            if len(X_features) > 0:
                X_features = np.vstack([X_syn, X_features])
                y_labels = np.concatenate([y_syn, y_labels])
            else:
                X_features, y_labels = X_syn, y_syn

        X_scaled = self.scaler.fit_transform(X_features)

        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y_labels, test_size=0.2, random_state=42
        )

        self.model.fit(X_train, y_train)

        train_accuracy = float(self.model.score(X_train, y_train))
        test_accuracy = float(self.model.score(X_test, y_test))

        prev_version = 0
        if os.path.exists(META_PATH):
            try:
                old_meta = joblib.load(META_PATH)
                prev_version = int(old_meta.get("model_version", 0))
            except Exception:
                prev_version = 0

        now_iso = datetime.now(timezone.utc).isoformat()
        meta = {
            "model_version": prev_version + 1,
            "trained_on": now_iso,
            "training_samples": int(len(X_features)),
            "train_accuracy": round(train_accuracy, 4),
            "model_accuracy": round(test_accuracy, 4),
            "last_retrain": now_iso,
        }

        joblib.dump(self.model, MODEL_PATH)
        joblib.dump(self.scaler, SCALER_PATH)
        joblib.dump(meta, META_PATH)

        return meta

    def retrain(
        self,
        new_feedback_data: Optional[List[Dict[str, Any]]] = None,
        teacher_history: Optional[Dict[Any, Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        fe = FeatureEngineer()
        syn_fb, syn_hist = fe.generate_synthetic_training_data(n_samples=120)
        if teacher_history:
            syn_hist.update(teacher_history)
        combined_fb = syn_fb + (new_feedback_data or [])
        X, y = fe.extract_features(combined_fb, syn_hist)
        return self.train(X, y)

    @staticmethod
    def get_model_stats() -> Dict[str, Any]:
        if not os.path.exists(META_PATH):
            learner = PreferenceLearner()
            return learner.retrain()
        try:
            return joblib.load(META_PATH)
        except Exception:
            learner = PreferenceLearner()
            return learner.retrain()
