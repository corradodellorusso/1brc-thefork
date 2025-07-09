import fs from "fs";
import { Worker } from "worker_threads";

const MAW_WORKERS = 16; // Maximum number of workers to run concurrently

// define type of data
interface CityData {
  min: number;
  max: number;
  sum: number;
  count: number;
}

let inProgress = 0;
async function runWorker(start: any, end: any): Promise<any> {
  while(inProgress > MAW_WORKERS) {
      await new Promise(resolve => setTimeout(resolve, 1));
  }
  inProgress++;

  let promise =  new Promise((resolve, reject) => {
    const worker = new Worker("./dist/worker.js", { workerData: { start, end } });
    worker.on("message", resolve);      // Quand le worker envoie un message, on résout la promesse
    worker.on("error", reject);         // En cas d’erreur, on rejette la promesse
    worker.on("exit", (code) => {
      if (code !== 0)
        reject(new Error(`Le worker s'est arrêté avec le code ${code}`));
    });
  });

  promise.finally(() => {
    inProgress--;
  });

  return promise
}

async function read_lines(): Promise<Map<string, CityData>> {
    const READ_AHEAD = 64*1024*1024; // Read ahead size in bytes, can be adjusted based on memory and performance needs
    //32 => 0m14.182s
    //64 => 0m14.112s
    //128 => 0m14.109s << best, but too much random due to memory pressure
    const buffer = Buffer.alloc(50);
    const file = fs.openSync("data/data.csv", "r");

    let fileCursor = 0;

    // Skip of headers
    fs.readSync(file, buffer, 0, 10, null);

    let tasks = [];

    while (true) { // ~ 500 loops
        const read_size = fs.readSync(file, buffer, 0, buffer.length, fileCursor + READ_AHEAD);

        if (read_size == 0) break;

        const new_line_index = buffer.lastIndexOf('\n', read_size)

        tasks.push(runWorker(fileCursor, fileCursor + READ_AHEAD + new_line_index + 1));

        fileCursor += new_line_index + READ_AHEAD + 1;        
    }

    fs.closeSync(file);

    let cities: Map<string, CityData> = new Map();


    // we don't want to await all tasks to finish before processing the results
    // we can process results as they come in
    for (const task of tasks) {
        const cities_task = await task; 
        
        cities_task.forEach((city: any, key: string) => {
            const current_city = cities.get(key) || {
                min: Infinity,
                max: -Infinity,
                sum: 0,
                count: 0
            };
            
            if (city.min < current_city.min) {
                current_city.min = city.min;
            }
            if (city.max > current_city.max) {
                current_city.max = city.max;
            }
            current_city.sum += city.sum;
            current_city.count += city.count;
            

            cities.set(key, current_city);
        });
    }

    return cities;
}


const cities = await read_lines();
printCompiledResults(cities);

/**
 * @param {Map} aggregations
 *
 * @returns {void}
 */
function printCompiledResults(
  aggregations: Map<
    string,
    CityData
  >,
) {
  const sortedStations = [...aggregations.keys()].sort();

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
