import { parentPort } from "worker_threads";

export type Aggregations = Map<
  string,
  { min: number; max: number; sum: number; count: number }
>;

function fastParseFloatToInteger(
  str: string,
  start: number,
  end: number,
): number {
  let result = 0;
  let sign = 1;
  let i = start;

  if (str[i] === "-") {
    sign = -1;
    i++;
  }

  while (i < end && str[i] !== ".") {
    result = result * 10 + (str.charCodeAt(i) - 48);
    i++;
  }

  if (i < end && str[i] === ".") {
    i++;
    if (i < end) {
      result = result * 10 + (str.charCodeAt(i) - 48);
    }
  }

  return result * sign;
}

function processChunk(chunk: string, aggregations: Aggregations): void {
  let start = 0;
  const len = chunk.length;
  while (start < len) {
    let lineEnd = start;
    while (lineEnd < len && chunk[lineEnd] !== "\n") {
      lineEnd++;
    }

    if (lineEnd === start) {
      start++;
      continue;
    }

    let commaIndex = lineEnd - 1;
    while (commaIndex > start && chunk[commaIndex] !== ";") {
      commaIndex--;
    }

    if (commaIndex === start) {
      start = lineEnd + 1;
      continue;
    }

    const stationName = chunk.slice(start, commaIndex);

    const temperature = fastParseFloatToInteger(chunk, commaIndex + 1, lineEnd);

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

    start = lineEnd + 1;
  }
}

parentPort?.on("message", async (chunk: string) => {
  const aggregations: Aggregations = new Map();
  processChunk(chunk, aggregations);
  parentPort?.postMessage(aggregations);
});
