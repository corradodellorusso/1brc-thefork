import { Worker } from "node:worker_threads";
import { statSync } from "node:fs";
import { cpus } from "node:os";

const numWorkers = cpus().length; // Use all CPU cores
const fileName = `${process.env.PWD}/data/data.csv`;

const aggregations: Record<
  string,
  { min: number; max: number; sum: number; count: number }
> = {};

async function processFile() {
  const fileSize = statSync(fileName).size;
  const chunkSize = Math.floor(fileSize / numWorkers);

  const promises: Promise<any>[] = [];

  for (let i = 0; i < numWorkers; i++) {
    const startByte = i * chunkSize;
    const endByte =
      i === numWorkers - 1 ? fileSize - 1 : (i + 1) * chunkSize - 1;

    const promise = new Promise((resolve, reject) => {
      const worker = new Worker("./dist/worker.js", {
        workerData: { fileName, startByte, endByte },
      });

      worker.on("message", (workerAggregations: Record<string, any>) => {
        for (const [station, data] of Object.entries(workerAggregations)) {
          const existing = aggregations[station];
          if (existing) {
            existing.min = Math.min(existing.min, data.min);
            existing.max = Math.max(existing.max, data.max);
            existing.sum += data.sum;
            existing.count += data.count;
          } else {
            aggregations[station] = {
              min: data.min,
              max: data.max,
              sum: data.sum,
              count: data.count,
            };
          }
        }
        resolve(workerAggregations);
      });

      worker.on("error", reject);
      worker.on("exit", (code) => {
        if (code !== 0)
          reject(new Error(`Worker stopped with exit code ${code}`));
      });
    });

    promises.push(promise);
  }

  await Promise.all(promises);
}

processFile().then(() => {
  printCompiledResults(aggregations);
});

/**
 * @param {Map} aggregations
 *
 * @returns {void}
 */
function printCompiledResults(
  aggregations: Record<
    string,
    { min: number; max: number; sum: number; count: number }
  >,
) {
  const sortedStations = Object.keys(aggregations).sort();

  let result =
    "{" +
    sortedStations
      .map((station) => {
        const data = aggregations[station]!;
        return `${station}=${round(data.min / 10)}/${round(
          data.sum / 10 / data.count,
        )}/${round(data.max / 10)}`;
      })
      .join(", ") +
    "}";

  console.log(result);
}

/**
 * @example
 * round(1.2345) // "1.2"
 * round(1.55) // "1.6"
 * round(1) // "1.0"
 *
 * @param {number} num
 *
 * @returns {string}
 */
function round(num: number) {
  const fixed = Math.round(10 * num) / 10;

  return fixed.toFixed(1);
}
