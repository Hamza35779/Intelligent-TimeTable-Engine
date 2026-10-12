from ml.feature_engineer import FeatureEngineer
from ml.preference_learner import PreferenceLearner
from ml.predictor import PreferencePredictor


def test_feature_engineering():
    """Verify 6 features are extracted accurately from feedback & teacher history."""
    fe = FeatureEngineer()
    feedback_data, teacher_history = fe.generate_synthetic_training_data(n_samples=40)
    X, y = fe.extract_features(feedback_data, teacher_history)

    assert X.shape[0] == 40
    assert X.shape[1] == 6
    assert y.shape[0] == 40


def test_model_training():
    """Verify Random Forest ML model trains and persists without errors."""
    fe = FeatureEngineer()
    feedback_data, teacher_history = fe.generate_synthetic_training_data(n_samples=80)
    X, y = fe.extract_features(feedback_data, teacher_history)

    learner = PreferenceLearner()
    stats = learner.train(X, y)

    assert learner.model is not None
    assert stats["training_samples"] >= 80
    assert 0.0 <= stats["model_accuracy"] <= 1.0
    assert "cv_accuracy" in stats
    assert 0.0 <= stats["cv_accuracy"]["mean"] <= 1.0


def test_preference_prediction():
    """Verify predicted preference probabilities are valid and sum to 1.0 (within 1e-6)."""
    predictor = PreferencePredictor(n_available_samples=120)
    teacher_features = [0.7, 0.2, 0.1, 3.5, 2.0, 1.0]
    prefs = predictor.predict_preferences(teacher_features)

    assert set(prefs.keys()) == {"Morning", "Afternoon", "Evening"}
    assert abs(sum(prefs.values()) - 1.0) <= 1e-6
    assert all(0.0 <= p <= 1.0 for p in prefs.values())
    assert predictor.preference_source == "ml_random_forest"


def test_ml_fewer_than_30_rows_returns_uniform_fallback():
    """
    Step 9 ML Test:
    With < 30 rows, returns uniform fallback and sets preference_source = "uniform_fallback".
    """
    fe = FeatureEngineer()
    feedback_data, teacher_history = fe.generate_synthetic_training_data(n_samples=15)
    X, y = fe.extract_features(feedback_data[:12], teacher_history)

    learner = PreferenceLearner()
    stats = learner.train(
        X, y, n_real_samples=12, n_synthetic_samples=0, allow_synthetic_augment=False
    )
    assert stats["preference_source"] == "uniform_fallback"
    assert stats["n_samples"] == 12

    predictor = PreferencePredictor(n_available_samples=12)
    prefs = predictor.predict_preferences([0.8, 0.1, 0.1, 4.0, 2.0, 1.0])
    assert predictor.preference_source == "uniform_fallback"
    assert abs(sum(prefs.values()) - 1.0) <= 1e-6
    assert abs(prefs["Morning"] - 1.0 / 3.0) < 0.01
    assert abs(prefs["Afternoon"] - 1.0 / 3.0) < 0.01
    assert abs(prefs["Evening"] - 1.0 / 3.0) < 0.01

    # Re-train on synthetic dataset so subsequent tests have the full trained model
    learner.retrain()
