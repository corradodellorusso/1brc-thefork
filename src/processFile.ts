import { Worker } from "node:worker_threads";
import { openSync, readSync, closeSync, statSync } from "node:fs";
import { cpus } from "node:os";
import { Chunk, Aggregations, WorkerData } from "./types.js";
import { BOUNDARY_BUFFER_SIZE, NEWLINE_CHAR } from "./constants.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const processFile = async (fileName: string): Promise<void> => {
  const numCores = cpus().length;
  const numWorkers = Math.max(2, numCores - 1); // Leaves one core for the main thread
  const workerPath = join(dirname(fileURLToPath(import.meta.url)), "index.js");

  const chunks = await findChunkBoundaries(fileName, numWorkers);

  const workers = chunks.map(
    (chunk) =>
      new Worker(workerPath, {
        workerData: {
          fileName,
          start: chunk.start,
          end: chunk.end,
        } satisfies WorkerData,
      }),
  );

  const promises = workers.map(
    (worker) =>
      new Promise<Aggregations>((resolve, reject) => {
        worker.on("message", (result) => resolve(new Map(result)));
        worker.on("error", reject);
        worker.on(
          "exit",
          (code) =>
            code !== 0 && reject(new Error(`Worker exited with code: ${code}`)),
        );
      }),
  );

  const results = await Promise.all(promises);
  workers.forEach((worker) => worker.terminate());

  printResults(mergeResults(results));
};

const findChunkBoundaries = async (
  fileName: string,
  numWorkers: number,
): Promise<Chunk[]> => {
  const { size: fileSize } = statSync(fileName);
  const chunkSize = Math.ceil(fileSize / numWorkers);
  const buffer = Buffer.alloc(BOUNDARY_BUFFER_SIZE); // Small buffer to find newlines
  const fd = openSync(fileName, "r");
  const chunks: Chunk[] = [];

  try {
    for (let i = 0, start = 0; i < numWorkers; i++) {
      let end = start + chunkSize;

      if (i === numWorkers - 1 || end >= fileSize) {
        chunks.push({ start, end: fileSize }); //Read until the end of the file
        break;
      }

      while (end < fileSize) {
        const bytesToRead = Math.min(buffer.length, fileSize - end);
        const bytesRead = readSync(fd, buffer, 0, bytesToRead, end);
        const newlineIndex = buffer.indexOf(NEWLINE_CHAR, 0);

        if (newlineIndex !== -1 && newlineIndex < bytesRead) {
          end += newlineIndex + 1;
          break;
        }
        end += bytesRead;
      }

      chunks.push({ start, end });
      start = end;
    }
  } finally {
    closeSync(fd);
  }

  return chunks;
};

const mergeResults = (results: Aggregations[]): Aggregations => {
  const mergedResults: Aggregations = new Map();

  for (const result of results) {
    for (const [station, data] of result) {
      const stationMetrics = mergedResults.get(station);

      if (stationMetrics) {
        if (data.min < stationMetrics.min) {
          stationMetrics.min = data.min;
        }
        if (data.max > stationMetrics.max) {
          stationMetrics.max = data.max;
        }
        stationMetrics.sum += data.sum;
        stationMetrics.count += data.count;
      } else {
        mergedResults.set(station, data);
      }
    }
  }

  return mergedResults;
};

const printResults = (aggregations: Aggregations) => {
  const sortedStations = Array.from(aggregations.keys()).sort();

  const result = sortedStations
    .map((station) => {
      const data = aggregations.get(station)!;
      const mean = data.sum / data.count;
      return `${station}=${formatNumber(data.min)}/${formatNumber(mean)}/${formatNumber(data.max)}`;
    })
    .join(", ");

  console.log(`{${result}}`);
};

const formatNumber = (num: number): string => {
  const formattedNumber = (num / 10).toFixed(1);
  return formattedNumber === "-0.0" ? "0.0" : formattedNumber;
};
