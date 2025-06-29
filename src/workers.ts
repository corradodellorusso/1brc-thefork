import { parentPort } from "worker_threads";

export type Aggregations = Map<
  string,
  { min: number; max: number; sum: number; count: number }
>;

function fastParseFloatToInteger(str: string): number {
  let result = 0;
  let sign = 1;
  let i = 0;

  if (str[0] === "-") {
    sign = -1;
    i = 1;
  }

  // Parse integer part
  while (i < str.length && str[i] !== ".") {
    result = result * 10 + (str.charCodeAt(i) - 48);
    i++;
  }

  // Parse decimal part (always one digit)
  if (i < str.length && str[i] === ".") {
    i++;
    if (i < str.length) {
      result = result * 10 + (str.charCodeAt(i) - 48);
    }
  }

  return result * sign;
}

function processLine(line: string, aggregations: Aggregations): void {
  const lastCommaIndex = line.lastIndexOf(",");
  const stationName = line.slice(0, lastCommaIndex);
  const temperatureStr = line.slice(lastCommaIndex + 1);

  // use integers for computation to avoid losing precision (this returns parsed float * 10)
  const temperature = fastParseFloatToInteger(temperatureStr);
  const existing = aggregations.get(stationName);

  if (existing) {
    if (temperature < existing.min) existing.min = temperature;
    if (temperature > existing.max) existing.max = temperature;
    existing.sum += temperature;
    existing.count++;
  } else {
    aggregations.set(stationName, {
      min: temperature,
      max: temperature,
      sum: temperature,
      count: 1,
    });
  }
}

parentPort?.on("message", async (chunk: string) => {
  const aggregations: Aggregations = new Map();
  let buffer = chunk;
  let lineEnd;
  while ((lineEnd = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, lineEnd);
    buffer = buffer.slice(lineEnd + 1);

    processLine(line, aggregations);
  }

  if (buffer.length > 0) {
    processLine(buffer, aggregations);
  }

  parentPort?.postMessage(aggregations);
});
