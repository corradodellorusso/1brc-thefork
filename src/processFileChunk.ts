import { parentPort, workerData } from "node:worker_threads";
import { openSync, readSync, closeSync } from "node:fs";
import {
  DOT_CHAR,
  MINUS_CHAR,
  NEWLINE_CHAR,
  SEMICOLON_CHAR,
  WORKER_BUFFER_SIZE,
  ZERO_CHAR,
} from "./constants.js";
import { Aggregations, WorkerData } from "./types.js";
import { StringDecoder } from "node:string_decoder";

export const processFileChunk = () => {
  const { fileName, start, end } = workerData as WorkerData;
  const aggregations: Aggregations = new Map();
  const decoder = new StringDecoder("utf8");
  const fd = openSync(fileName, "r");
  const buffer = Buffer.alloc(WORKER_BUFFER_SIZE);

  let offset = start;
  let incompleteLine = "";

  try {
    while (offset < end) {
      const bytesToRead = Math.min(WORKER_BUFFER_SIZE, end - offset);
      const bytesRead = readSync(fd, buffer, 0, bytesToRead, offset);

      if (!bytesRead) {
        break;
      }

      const chunk =
        incompleteLine + decoder.write(buffer.subarray(0, bytesRead));
      processChunk(chunk, aggregations, offset + bytesRead >= end);

      const lastNewline = chunk.lastIndexOf("\n");
      incompleteLine =
        lastNewline !== -1 && offset + bytesRead < end
          ? chunk.slice(lastNewline + 1)
          : "";
      offset += bytesRead;
    }

    const lastLine = incompleteLine + decoder.end();

    if (lastLine.trim()) {
      processLine(lastLine, aggregations);
    }
  } finally {
    closeSync(fd);
  }

  const result = Array.from(aggregations.entries());
  parentPort?.postMessage(result);
};

const processChunk = (
  chunk: string,
  aggregations: Aggregations,
  isLastChunk: boolean,
) => {
  let i = 0;
  const chunkLength = chunk.length;

  while (i < chunkLength) {
    const lineEnd = findNewline(chunk, i, chunkLength);

    if (lineEnd === chunkLength && !isLastChunk) {
      break;
    }

    if (lineEnd > i) {
      const semicolonIndex = findSemicolon(chunk, i, lineEnd);

      if (semicolonIndex < lineEnd) {
        const stationName = chunk.slice(i, semicolonIndex);
        const temperature = parseTemperature(chunk, semicolonIndex + 1);

        updateAggregations(stationName, temperature, aggregations);
      }
    }

    i = lineEnd + 1;
  }
};

const processLine = (line: string, aggregations: Aggregations) => {
  let semicolonIndex = 0;
  const lineLength = line.length;

  while (
    semicolonIndex < lineLength &&
    line.charCodeAt(semicolonIndex) !== SEMICOLON_CHAR
  ) {
    semicolonIndex++;
  }

  if (semicolonIndex >= lineLength) {
    return;
  }

  const stationName = line.slice(0, semicolonIndex);
  const temperature = parseTemperature(line, semicolonIndex + 1);

  updateAggregations(stationName, temperature, aggregations);
};

const updateAggregations = (
  stationName: string,
  temperature: number,
  aggregations: Aggregations,
) => {
  const station = aggregations.get(stationName);

  if (station) {
    station.min = temperature < station.min ? temperature : station.min;
    station.max = temperature > station.max ? temperature : station.max;
    station.sum += temperature;
    station.count++;
  } else {
    aggregations.set(stationName, {
      min: temperature,
      max: temperature,
      sum: temperature,
      count: 1,
    });
  }
};

const parseTemperature = (str: string, start: number): number => {
  let sign = 1;
  let i = start;

  if (str.charCodeAt(start) === MINUS_CHAR) {
    sign = -1;
    i++;
  }

  let result = str.charCodeAt(i++) - ZERO_CHAR;

  const nextChar = str.charCodeAt(i);
  if (nextChar !== DOT_CHAR) {
    result = result * 10 + (nextChar - ZERO_CHAR);
    i++;
  }

  // Temperatures are stored as integers
  result = result * 10 + (str.charCodeAt(++i) - ZERO_CHAR);

  return result * sign;
};

const findSemicolon = (chunk: string, start: number, end: number): number => {
  let index = start;
  while (index < end && chunk.charCodeAt(index) !== SEMICOLON_CHAR) {
    index++;
  }
  return index;
};
const findNewline = (chunk: string, start: number, end: number): number => {
  let index = start;
  while (index < end && chunk.charCodeAt(index) !== NEWLINE_CHAR) {
    index++;
  }
  return index;
};
