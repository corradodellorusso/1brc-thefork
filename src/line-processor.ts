export type StationData = {
  min: number;
  max: number;
  sum: number;
  count: number;
};

export type Aggregations = Record<string, StationData>;

export function processLine(line: string, aggregations: Aggregations): void {
  if (!line.trim()) return;

  const commaIndex = line.indexOf(",");
  if (commaIndex === -1) return;

  const stationName = line.slice(0, commaIndex).trim();
  const temperatureStr = line.slice(commaIndex + 1).trim();

  if (!stationName || !temperatureStr) return;

  const temperature = Math.floor(parseFloat(temperatureStr) * 10);
  if (Number.isNaN(temperature)) return;

  const existing = aggregations[stationName];

  if (existing) {
    existing.min = Math.min(existing.min, temperature);
    existing.max = Math.max(existing.max, temperature);
    existing.sum += temperature;
    existing.count++;
  } else {
    aggregations[stationName] = {
      min: temperature,
      max: temperature,
      sum: temperature,
      count: 1,
    };
  }
}

export function mergeAggregations(
  target: Aggregations,
  source: Aggregations,
): void {
  for (const [station, data] of Object.entries(source)) {
    const existing = target[station];
    if (existing) {
      existing.min = Math.min(existing.min, data.min);
      existing.max = Math.max(existing.max, data.max);
      existing.sum += data.sum;
      existing.count += data.count;
    } else {
      target[station] = {
        min: data.min,
        max: data.max,
        sum: data.sum,
        count: data.count,
      };
    }
  }
}
