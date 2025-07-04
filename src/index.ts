import { isMainThread, Worker, workerData, parentPort } from "worker_threads";
import { open } from "fs/promises";
import { cpus } from "os";
import { createReadStream } from "fs";

type Temps = {
  min: number;
  max: number;
  sum: number;
  count: number;
};
type State = "READING_STATION" | "READING_TEMPERATURE";

const CHAR_SEMICOLON = ";".charCodeAt(0);
const CHAR_NEWLINE = "\n".charCodeAt(0);
const MAX_LINE_LENGTH = 100 + 1 + 4 + 1;
const LINE_BREAK = "\n".charCodeAt(0);
const FILE_NAME = `${process.env.PWD}/data/data.csv`;

if (isMainThread) {
  const file = await open(FILE_NAME);
  const stat = await file.stat();
  const threads = cpus().length;
  const idealChunkSize = Math.floor(stat.size / threads);
  const chunkOffsets = [];
  const buffer = Buffer.alloc(MAX_LINE_LENGTH);
  let offset = 0;
  while (true) {
    offset += idealChunkSize;
    if (offset > stat.size) {
      chunkOffsets.push(stat.size);
      break;
    }

    await file.read(buffer, 0, MAX_LINE_LENGTH, offset);
    const index = buffer.indexOf(LINE_BREAK);
    buffer.fill(0);
    if (index === -1) {
      chunkOffsets.push(stat.size);
      break;
    } else {
      offset = offset + index + 1;
      chunkOffsets.push(offset);
    }
  }

  await file.close();

  const aggregated = new Map<string, Temps>();
  let completed = 0;

  for (let i = 0; i < chunkOffsets.length; i++) {
    const url = new URL("./index.js", import.meta.url);
    const worker = new Worker(url, {
      workerData: {
        id: i,
        start: i === 0 ? 0 : chunkOffsets[i - 1],
        end: chunkOffsets[i],
      },
    });

    worker.on("message", (message) => {
      const results = message.results as Map<string, Temps>;
      for (const [key, value] of results) {
        const existing = aggregated.get(key);
        if (!existing) {
          aggregated.set(key, value);
        } else {
          existing.min = existing.min <= value.min ? existing.min : value.min;
          existing.max = existing.max >= value.max ? existing.max : value.max;
          existing.sum += value.sum;
          existing.count += value.count;
        }
      }
    });
    worker.on("error", (error) => {
      console.error(error);
      process.exit(1);
    });
    worker.on("exit", (code) => {
      if (code > 0) {
        console.error(`Worker exited with code: ${code}`);
        process.exit(code);
      }

      completed++;

      if (completed === chunkOffsets.length) {
        const array = Array.from(aggregated);
        array.sort(([a], [b]) => (a > b ? 1 : -1));
        const formatted: string[] = [];
        for (const [city, temps] of array) {
          const avg = (temps.sum / 10 / temps.count).toFixed(1);
          const max = (temps.max / 10).toFixed(1);
          const min = (temps.min / 10).toFixed(1);
          formatted.push(`${city}=${min}/${avg}/${max}`);
        }
        console.log(`{${formatted.join(", ")}}`);
      }
    });
  }
} else {
  const { start, end, id } = workerData;
  let state: State = "READING_STATION";
  const stationBuffer = Buffer.allocUnsafe(100);
  let stationBufferLength = 0;
  const temperatureBuffer = Buffer.allocUnsafe(5);
  let temperatureBufferLength = 0;

  const results = new Map<string, any>();
  const stream = createReadStream(FILE_NAME, {
    start,
    end,
    highWaterMark: 1024 * 1024,
  });
  stream.on("data", (chunk) => {
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] === CHAR_SEMICOLON) {
        state = "READING_TEMPERATURE";
        continue;
      }
      if (chunk[i] === CHAR_NEWLINE) {
        const station = stationBuffer.toString("utf8", 0, stationBufferLength);
        const temperatureString = temperatureBuffer.toString(
          "utf8",
          0,
          temperatureBufferLength,
        );
        const temperature = Math.floor(parseFloat(temperatureString) * 10);

        const existing = results.get(station);
        if (!existing) {
          results.set(station, {
            min: temperature,
            max: temperature,
            sum: temperature,
            count: 1,
          });
        } else {
          existing.min =
            existing.min <= temperature ? existing.min : temperature;
          existing.max =
            existing.max >= temperature ? existing.max : temperature;
          existing.sum += temperature;
          existing.count += 1;
        }
        stationBufferLength = 0;
        temperatureBufferLength = 0;
        state = "READING_STATION";
        continue;
      }
      if (state === "READING_STATION") {
        // @ts-ignore
        stationBuffer[stationBufferLength] = chunk[i];
        stationBufferLength++;
        continue;
      }

      if (state === "READING_TEMPERATURE") {
        // @ts-ignore
        temperatureBuffer[temperatureBufferLength] = chunk[i];
        temperatureBufferLength++;
      }
    }
  });
  stream.on("end", () => {
    parentPort!.postMessage({
      id,
      results,
    });
  });
}
