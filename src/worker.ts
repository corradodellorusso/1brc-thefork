import { parentPort, workerData } from "node:worker_threads";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { processLine, type Aggregations } from "./line-processor.js";

const { fileName, startByte, endByte } = workerData;

const aggregations: Aggregations = {};

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
    processLine(line, aggregations);
  }

  // Send results back to main thread
  parentPort?.postMessage(aggregations);
}

processChunk().catch(console.error);
