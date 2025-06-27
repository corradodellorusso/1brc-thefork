import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

type Aggregations = Map<
  string,
  { min: number; max: number; sum: number; count: number }
>;

const FILENAME = `${process.env.PWD}/data/data.csv`;

let totalParseTime = 0;
let totalAggregationTime = 0;

const processLine = (line: string, aggregations: Aggregations) => {
  const beginParse = performance.now();
  const splitLine = line.split(",") as string[];
  // Handle lines with a comma in the station name
  const temperatureStr = splitLine.pop() as string;
  const stationName = splitLine.join(",");

  // use integers for computation to avoid loosing precision
  const temperature = Math.floor(parseFloat(temperatureStr) * 10);
  totalParseTime += performance.now() - beginParse;

  const beginAggregation = performance.now();

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
  totalAggregationTime += performance.now() - beginAggregation;
};

const computeAggregations = () => {
  const aggregations: Aggregations = new Map();
  console.time("File processing time");
  const fileStream = createReadStream(FILENAME, { encoding: "utf8" });
  const readline = createInterface({
    input: fileStream,
    crlfDelay: Infinity, // Recognize all instances of CR LF ('\r\n') as a single line break.
  });

  readline.on("line", (line) => {
    if (!line || line === "city,temp") {
      // Skip empty lines and header line
      return;
    }
    processLine(line, aggregations);
  });

  readline.on("close", () => {
    console.timeEnd("File processing time");
    console.time("Aggregations computation time");
    printCompiledResults(aggregations);
    console.timeEnd("Aggregations computation time");

    console.log(`Total parse time: ${totalParseTime.toFixed(2)} ms`);
    console.log(
      `Total aggregation time: ${totalAggregationTime.toFixed(2)} ms`,
    );
  });
};

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
}

function round(num: number) {
  return num.toFixed(1);
}

computeAggregations();
