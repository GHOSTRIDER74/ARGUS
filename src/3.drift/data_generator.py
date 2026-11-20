import numpy as np
import pandas as pd

def generate_pcb_data(n_samples=2000, drift_start=1200, seed=42):
    """
    Simulates the four plasma-etch parameters used across ARGUS
    (same names as the processed SECOM etch channels).
    Injects gradual drift after drift_start timestep.
    """
    np.random.seed(seed)
    t = np.arange(n_samples)

    # Normal operating ranges (mean, std), in engineering units
    params = {
        "rf_power":         (1500.0, 15.0),   # W
        "etch_rate":        (320.0,  4.0),    # nm/min
        "chamber_pressure": (40.0,   0.5),    # mTorr
        "etchant_gas_flow": (100.0,  1.5),    # sccm
    }

    data = {}
    for name, (mu, sigma) in params.items():
        signal = np.random.normal(mu, sigma, n_samples)
        # Gradual linear drift injected after drift_start
        drift = np.where(
            t >= drift_start,
            (t - drift_start) * (sigma * 0.04),  # 4% of std per step
            0.0
        )
        data[name] = signal + drift

    df = pd.DataFrame(data)
    df["timestep"] = t
    df["drift_injected"] = t >= drift_start  # ground truth label
    df["Pass/Fail"] = np.where(df["drift_injected"], 1, -1)  # SECOM convention: 1 = fail
    return df


if __name__ == "__main__":
    df = generate_pcb_data()
    df.to_csv("pcb_data.csv", index=False)
    print(df.tail())