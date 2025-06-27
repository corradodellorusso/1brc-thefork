import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { expectedBigFile } from "./expected.js";

type Aggregations = Map<
  string,
  { min: number; max: number; sum: number; count: number }
>;

const FILENAME = `${process.env.PWD}/data/data.csv`;

// Add this optimized parsing function
function fastParseFloatToInteger(str: string): number {
  let result = 0;
  let sign = 1;
  let i = 0;

  if (str[0] === "-") {
    sign = -1;
    i = 1;
  }

  // Parse integer part
  while (i < str.length && str[i] !== ".") {
    result = result * 10 + (str.charCodeAt(i) - 48);
    i++;
  }

  // Parse decimal part (always one digit)
  if (i < str.length && str[i] === ".") {
    i++;
    if (i < str.length) {
      result = result * 10 + (str.charCodeAt(i) - 48);
    }
  }

  return result * sign;
}

const computeAggregations = async () => {
  const aggregations: Aggregations = new Map();
  console.time("File processing time");
  const fileStream = createReadStream(FILENAME, { encoding: "utf8" });
  const readline = createInterface({
    input: fileStream,
    crlfDelay: Infinity, // Recognize all instances of CR LF ('\r\n') in input as a single line break.
  });

  readline.on("line", (line) => {
    const lastCommaIndex = line.lastIndexOf(",");
    const stationName = line.slice(0, lastCommaIndex);
    const temperatureStr = line.slice(lastCommaIndex + 1);

    // use integers for computation to avoid loosing precision
    const temperature = fastParseFloatToInteger(temperatureStr);

    const existing = aggregations.get(stationName);

    if (existing) {
      existing.min = existing.min < temperature ? existing.min : temperature;
      existing.max = existing.max > temperature ? existing.max : temperature;
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
  });

  readline.on("close", () => {
    console.timeEnd("File processing time");
    console.time("Aggregations computation time");
    printCompiledResults(aggregations);
    console.timeEnd("Aggregations computation time");
  });
};

function printCompiledResults(aggregations: Aggregations) {
  // TODO: I still have a sorting issue because stationNames like "Washington, D.C." end up first because of the quote
  const sortedStations = Array.from(aggregations.keys())
    // We've kept the first line of headers and remove it only here to avoid having if statement in the loop
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

  console.log("isCorrect: ", result === expectedBigFile);
}

function round(num: number) {
  return num.toFixed(1);
}

computeAggregations();
