import numpy as np
import pandas as pd

def generate_pcb_data(n_samples=2000, drift_start=1200, seed=42):
    """
    Simulates 4-stage PCB process parameters.
    Injects gradual drift after drift_start timestep.
    """
    np.random.seed(seed)
    t = np.arange(n_samples)

    # Normal operating ranges (mean, std)
    params = {
        "reflow_temp_c":      (245.0, 1.5),
        "solder_viscosity_pa": (180.0, 3.0),
        "etch_concentration":  (0.85,  0.01),
        "inspection_defect_rate": (0.02, 0.005),
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
    return df


if __name__ == "__main__":
    df = generate_pcb_data()
    df.to_csv("pcb_data.csv", index=False)
    print(df.tail())