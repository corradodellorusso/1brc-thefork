type StationMetrics = {
  min: number;
  max: number;
  sum: number;
  count: number;
};

export type Aggregations = Map<string, StationMetrics>;

export type Chunk = {
  start: number;
  end: number;
};

export type WorkerData = {
  fileName: string;
  start: number;
  end: number;
};