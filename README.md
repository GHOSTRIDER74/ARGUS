# Argus Module 3 — Drift Detection Pipeline

A machine learning pipeline for real-time anomaly and data drift detection, combining statistical (CUSUM) and deep learning (LSTM Autoencoder) approaches with built-in explainability.

## Pipeline Overview

```
data_generator.py       ← Step 1: Simulate / ingest streaming data
preprocessor.py         ← Step 2: Clean, scale, and window the data
cusum_detector.py       ← Step 3a: Statistical drift detection (CUSUM)
lstm_autoencoder.py     ← Step 3b: Deep learning anomaly detection
drift_explainer.py      ← Step 5: Explain detected drift / anomalies
pipeline.py             ← Runs all steps end-to-end
```

## Quickstart

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/argus_module3.git
cd argus_module3

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the full pipeline
python pipeline.py
```

## Project Structure

```
argus_module3/
├── data_generator.py       # Synthetic / real data ingestion
├── preprocessor.py         # Feature engineering & preprocessing
├── cusum_detector.py       # CUSUM change-point detection
├── lstm_autoencoder.py     # LSTM Autoencoder for anomaly scoring
├── drift_explainer.py      # SHAP / feature-level drift explanation
├── pipeline.py             # End-to-end orchestration
└── requirements.txt        # Python dependencies
```

## Requirements

- Python 3.9+
- See `requirements.txt` for full dependency list

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

MIT