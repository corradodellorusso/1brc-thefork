import { readFileSync } from "node:fs";
import { expectedSmallFile } from "./expected.js";

type Aggregations = Map<
  string,
  { min: number; max: number; sum: number; count: number }
>;

const fileName = `${process.env.PWD}/data/data.csv`;

const lines = readFileSync(fileName, "utf8").split("\n");
const aggregations: Aggregations = new Map();

// Skip first line (header) and last line (empty line)
for (let lineIndex = 1; lineIndex <= lines.length - 2; lineIndex++) {
  const line = lines[lineIndex] as string;
  const splitLine = line.split(",") as string[];
  // Handle lines with a comma in the station name
  const temperatureStr = splitLine.pop() as string;
  const stationName = splitLine.join(",");

  // use integers for computation to avoid loosing precision
  const temperature = Math.floor(parseFloat(temperatureStr) * 10);

  const existing = aggregations.get(stationName);

  if (existing) {
    existing.min = Math.min(existing.min, temperature);
    existing.max = Math.max(existing.max, temperature);
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

const result = printCompiledResults(aggregations);

const isCorrect = result === expectedSmallFile;

console.log("Result is correct:", isCorrect);

/**
 * @param {Map} aggregations
 *
 * @returns {void}
 */
function printCompiledResults(aggregations: Aggregations) {
  // TODO: I still have a sorting issue because stationNames like "Washington, D.C." end up first because of the quote
  const sortedStations = Array.from(aggregations.keys()).sort();

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
  return result;
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
  return num.toFixed(1);
}
