import { expectedRealFile } from "./expected.js";
import { createReadStream } from "node:fs";
import { cpus } from "node:os";
import { Worker } from "node:worker_threads";
import { Aggregations } from "./workers.js";

// https://github.com/corradodellorusso/1brc-thefork

const FILENAME = `${process.env.PWD}/data/data.csv`;
const NUM_WORKERS = cpus().length;

function printCompiledResults(aggregations: Aggregations) {
  // TODO: Is it a sorting issue if names like "Washington, D.C." end up first because of the quote?
  const sortedStations = Array.from(aggregations.keys())
    // I've kept the first line of headers and remove it only here to avoid having if statement in the loop
    // TODO: this does not seem to save much time
    .filter((key) => key !== "city")
    .sort();

  let result =
    "{" +
    sortedStations
      .map((station) => {
        const data = aggregations.get(station)!;
        return `${station}=${round(data.min / 10)}/${round(
          data.sum / 10 / data.count,
        )}/${round(data.max / 10)}`;
      })
      .join(", ") +
    "}";

  console.log(result);

  console.log("isCorrect: ", result === expectedRealFile);
}

function round(num: number) {
  return num.toFixed(1);
}

type Task = {
  message: string;
  resolve: (result: Aggregations) => void;
  reject: (error: any) => void;
};

class WorkerPool {
  private workers: Worker[];
  private availableWorkers: Worker[];
  private queue: Task[];

  constructor(poolSize: number) {
    this.workers = [];
    this.availableWorkers = [];
    this.queue = [];

    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(`${process.env.PWD}/dist/workers.js`);
      this.workers.push(worker);
      this.availableWorkers.push(worker);
    }
  }

  async processMessage(message: string): Promise<Aggregations> {
    return new Promise((resolve, reject) => {
      const task = { message, resolve, reject };

      if (this.availableWorkers.length > 0) {
        this.executeTask(task);
      } else {
        this.queue.push(task);
      }
    });
  }

  private executeTask(task: Task) {
    const worker = this.availableWorkers.pop()!;

    const onMessage = (result: Aggregations) => {
      worker.off("message", onMessage);
      worker.off("error", onError);
      this.availableWorkers.push(worker);

      // Process next task in queue
      if (this.queue.length > 0) {
        // We don't care about task order so pop() is more efficient
        this.executeTask(this.queue.pop()!);
      }

      task.resolve(result);
    };

    const onError = (error: any) => {
      worker.off("message", onMessage);
      worker.off("error", onError);
      this.availableWorkers.push(worker);
      task.reject(error);
    };

    worker.on("message", onMessage);
    worker.on("error", onError);
    worker.postMessage(task.message);
  }

  async terminate() {
    await Promise.all(this.workers.map((worker) => worker.terminate()));
  }
}

const workerPool = new WorkerPool(NUM_WORKERS);

const promises: Promise<Aggregations>[] = [];
const fileStream = createReadStream(FILENAME, {
  encoding: "utf8",
  highWaterMark: 32 * 1024 * 1024, // Size of each chunk
});
let buffer = "";

fileStream.on("data", (chunk) => {
  buffer += chunk;
  const lastLineEnd = buffer.lastIndexOf("\n");
  promises.push(workerPool.processMessage(buffer.slice(0, lastLineEnd)));
  buffer = buffer.slice(lastLineEnd + 1);
});

fileStream.on("end", async () => {
  if (buffer.length > 0) {
    console.log("Remaining buffer: ", buffer);
  }
  const results = await Promise.all(promises);

  console.log("Number of chunks: ", results.length);

  const mergedAggregations: Aggregations = new Map();
  for (let i = 0; i < results.length; i++) {
    for (const [station, data] of results[i]!) {
      const existing = mergedAggregations.get(station);
      if (existing) {
        if (data.min < existing.min) existing.min = data.min;
        if (data.max > existing.max) existing.max = data.max;
        existing.sum += data.sum;
        existing.count += data.count;
      } else {
        mergedAggregations.set(station, { ...data });
      }
    }
  }

  printCompiledResults(mergedAggregations);

  await workerPool.terminate();
});
