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


def test_preference_prediction():
    """Verify predicted preference probabilities are valid and normalized in [0, 1]."""
    predictor = PreferencePredictor()
    teacher_features = [4.0, 0.0, 1.0, 0.0, 8.0, 4.5]
    prefs = predictor.predict_preferences(teacher_features)

    assert set(prefs.keys()) == {"Morning", "Afternoon", "Evening"}
    assert sum(prefs.values()) <= 3.0
    assert all(0.0 <= p <= 1.0 for p in prefs.values())
