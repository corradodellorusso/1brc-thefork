import { readFileSync } from "node:fs";

const fileName = `${process.env.PWD}/data/data.csv`;

const lines = readFileSync(fileName, "utf8").split("\n");
const aggregations: Record<
  string,
  { min: number; max: number; sum: number; count: number }
> = {};

for await (const line of lines.slice(1)) {
  const [stationName, temperatureStr] = line.split(";") as [string, string];

  // use integers for computation to avoid loosing precision
  const temperature = Math.floor(parseFloat(temperatureStr!) * 10);

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

printCompiledResults(aggregations);

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
