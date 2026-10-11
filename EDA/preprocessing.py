import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from pathlib import Path

# 1. Load Data with Corrected Pathing
script_dir = Path(__file__).resolve().parent

# Go up ONLY ONE level from EDA/ to Major_Project/, then into data/raw/
data_dir = script_dir.parent / "data" / "raw"

# The standard UCI SECOM dataset comes in two files. 
# Read the 590 feature columns
df_features = pd.read_csv(data_dir / "secom.data", sep=" ", header=None)

# Read the labels file. Because the timestamp has a space ("19/07/2008 11:55:00"), 
# pandas splits it into three columns: Label, Date, and Time.
df_labels = pd.read_csv(data_dir / "secom_labels.data", sep=" ", header=None, 
                        names=['Pass/Fail', 'Date', 'TimeStr'])

# 2. Time Handling & Recombining
# Recombine the date and time strings into a single datetime column
df_labels['Time'] = pd.to_datetime(df_labels['Date'] + ' ' + df_labels['TimeStr'], format="%d/%m/%Y %H:%M:%S")
df_labels.drop(columns=['Date', 'TimeStr'], inplace=True)

# Merge features and labels into a single DataFrame
df = pd.concat([df_features, df_labels], axis=1)

# Sort chronologically
df = df.sort_values(by='Time').reset_index(drop=True)

# 3. Feature Selection
# Drop sensors with > 50% missing values
thresh = len(df) * 0.5
df.dropna(thresh=thresh, axis=1, inplace=True)

# Drop sensors with zero variance (single unique value)
cols_to_drop = [col for col in df.columns if df[col].nunique() <= 1]
df.drop(columns=cols_to_drop, inplace=True)

# 4. Schema Mapping (Relabeling)
# Isolating the continuous sensors, excluding labels
remaining_sensors = [col for col in df.columns if col not in ['Time', 'Pass/Fail']]

schema_mapping = {
    remaining_sensors[0]: 'rf_power',
    remaining_sensors[1]: 'etch_rate',
    remaining_sensors[2]: 'chamber_pressure',
    remaining_sensors[3]: 'etchant_gas_flow',
    remaining_sensors[4]: 'dep_temp',
    remaining_sensors[5]: 'gas_flow_rate',
    remaining_sensors[6]: 'film_thickness',
    remaining_sensors[7]: 'chamber_vacuum',
    remaining_sensors[8]: 'pad_pressure',
    remaining_sensors[9]: 'slurry_flow',
    remaining_sensors[10]: 'rotation_speed',
    remaining_sensors[11]: 'friction_coefficient',
    remaining_sensors[12]: 'focus_offset',
    remaining_sensors[13]: 'exposure_dose',
    remaining_sensors[14]: 'alignment_error',
    remaining_sensors[15]: 'lens_temp',
    remaining_sensors[16]: 'bath_temp',
    remaining_sensors[17]: 'chemical_ph',
    remaining_sensors[18]: 'rinse_flow',
    remaining_sensors[19]: 'particle_count',
}
df.rename(columns=schema_mapping, inplace=True)

# ---------------- ADD THESE TWO LINES ----------------
# Convert all integer column names to strings to prevent the sklearn TypeError
df.columns = df.columns.astype(str)

# Consolidate memory to prevent the pandas PerformanceWarning
df = df.copy()
# -----------------------------------------------------

# 5. Imputation & Outlier Clipping
num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
if 'Pass/Fail' in num_cols:
    num_cols.remove('Pass/Fail') 

# Forward-fill and median impute
df[num_cols] = df[num_cols].ffill().fillna(df[num_cols].median())

# Clip extreme outliers (1st to 99th percentile)
for col in num_cols:
    lower = df[col].quantile(0.01)
    upper = df[col].quantile(0.99)
    df[col] = df[col].clip(lower, upper)

# 6. Dynamic LCA and Cost Mapping
target_rf_power = df['rf_power'].median()

# Energy and Carbon footprint calculation
df['energy_loss_kwh'] = np.abs(df['rf_power'] - target_rf_power) * 0.05 
df['co2_emission_kg'] = df['energy_loss_kwh'] * 0.42

# Financial impact calculation ($0.15/kWh + $500 scrap penalty for failures)
df['operational_cost_usd'] = df['energy_loss_kwh'] * 0.15
df['scrap_cost_usd'] = df['Pass/Fail'].apply(lambda x: 500 if x == 1 else 0)
df['total_impact_cost_usd'] = df['operational_cost_usd'] + df['scrap_cost_usd']

# 7. Normalization for the Analytics Core
scaler = StandardScaler()
df_scaled = df.copy()
df_scaled[num_cols] = scaler.fit_transform(df[num_cols])

print(f"Initial Merge Shape: (1567, 592) | Cleaned Shape: {df.shape}")

# 8. Save the Processed Data
output_dir = script_dir.parent / "data" / "processed"
output_dir.mkdir(parents=True, exist_ok=True) # Ensures the folder exists

output_filepath = output_dir / "secom_processed.csv"
df_scaled.to_csv(output_filepath, index=False)

print(f"Processed data successfully saved to: {output_filepath}")