import { parentPort, workerData } from "node:worker_threads";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const { fileName, startByte, endByte } = workerData;

const aggregations: Record<
  string,
  { min: number; max: number; sum: number; count: number }
> = {};

async function processChunk() {
  const fileStream = createReadStream(fileName, {
    start: startByte,
    end: endByte,
  });

  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    const commaIndex = line.indexOf(",");
    if (commaIndex === -1) continue;

    const stationName = line.slice(0, commaIndex).trim();
    const temperatureStr = line.slice(commaIndex + 1).trim();

    if (!stationName || !temperatureStr) continue;

    const temperature = Math.floor(parseFloat(temperatureStr) * 10);
    if (Number.isNaN(temperature)) continue;

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

  // Send results back to main thread
  parentPort?.postMessage(aggregations);
}

processChunk().catch(console.error);
