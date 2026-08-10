import axios from "axios";
import type {
  Dataset,
  DatasetSummary,
  DetectionResult,
  DriftEventItem,
  EventExplanation,
  EventForecast,
  ImpactBreakdown,
  ImpactListItem,
  ImpactResult,
  ModelVersionItem,
  PreprocessResult,
  QualityReport,
  SeriesResponse,
  SimulationConfig,
  Stage,
  TwinState,
  ValidationReport,
} from "../types/api";

const api = axios.create({ baseURL: "/api/v1" });

export const getHealth = () => api.get<{ status: string; database: string }>("/health");

export const listDatasets = () => api.get<Dataset[]>("/datasets");

export const getDataset = (id: number) => api.get<Dataset>(`/datasets/${id}`);

export const uploadDataset = (file: File, wideFormat: boolean) => {
  const form = new FormData();
  form.append("file", file);
  return api.post<Dataset>(`/datasets/upload?wide_format=${wideFormat}`, form);
};

export const validateDataset = (id: number) =>
  api.post<ValidationReport>(`/datasets/${id}/validate`);

export const preprocessDataset = (id: number, resampleInterval: string) =>
  api.post<PreprocessResult>(`/datasets/${id}/preprocess`, {
    resample_interval: resampleInterval,
    interpolation: "linear",
    generate_features: true,
  });

export const getSummary = (id: number) => api.get<DatasetSummary>(`/datasets/${id}/summary`);

export const getQualityReport = (id: number) =>
  api.get<QualityReport>(`/datasets/${id}/quality-report`);

export const deleteDataset = (id: number) => api.delete(`/datasets/${id}`);

export const getStages = () => api.get<{ stages: Stage[] }>("/simulation/stages");

export const generateSimulation = (config: SimulationConfig) =>
  api.post("/simulation/generate", config);

// ---------- Module 2 ----------

export const getSeries = (
  datasetId: number,
  machineId: string,
  stageName: string,
  parameterName: string,
) =>
  api.get<SeriesResponse>(`/datasets/${datasetId}/series`, {
    params: { machine_id: machineId, stage_name: stageName, parameter_name: parameterName },
  });

export const getTwinStates = () => api.get<TwinState[]>("/digital-twin/state");

export const listDriftEvents = () => api.get<DriftEventItem[]>("/drift/events");

export const getDriftEvent = (id: number) => api.get<DriftEventItem>(`/drift/events/${id}`);

export const getEventExplanation = (id: number) =>
  api.get<EventExplanation>(`/drift/events/${id}/explanation`);

export const getEventForecast = (id: number) =>
  api.get<EventForecast>(`/drift/events/${id}/forecast`);

export const acknowledgeEvent = (id: number) =>
  api.post<DriftEventItem>(`/drift/events/${id}/acknowledge`);

export const resolveEvent = (id: number, falsePositive = false) =>
  api.post<DriftEventItem>(`/drift/events/${id}/resolve?false_positive=${falsePositive}`);

export const listModels = () => api.get<ModelVersionItem[]>("/drift/models");

export const activateModel = (modelId: string) =>
  api.post<ModelVersionItem>(`/drift/models/${modelId}/activate`);

export const deleteModel = (modelId: string) => api.delete(`/drift/models/${modelId}`);

export const trainModel = (req: Record<string, unknown>) =>
  api.post("/drift/models/train", req);

export const runDetection = (req: Record<string, unknown>) =>
  api.post<DetectionResult>("/drift/detect", req);

// ---------- Module 3 ----------

export const calculateImpact = (req: {
  drift_event_id: number;
  analysis_period_hours?: number | null;
  downtime_hours?: number;
  production_configuration_id?: number | null;
  persist_result?: boolean;
}) => api.post<ImpactResult>("/impact/calculate", req);

export const listImpacts = () => api.get<ImpactListItem[]>("/impact");

export const getImpact = (id: number) => api.get<ImpactResult>(`/impact/${id}`);

export const getImpactBreakdown = (id: number) =>
  api.get<ImpactBreakdown>(`/impact/${id}/breakdown`);

export const getImpactsByDrift = (driftEventId: number) =>
  api.get<ImpactListItem[]>(`/impact/by-drift/${driftEventId}`);
