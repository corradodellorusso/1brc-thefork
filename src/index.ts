import fs from "fs";
import { Worker } from "worker_threads";
let total_cities = 0;

//TODO: a worker pool may help to reduce too much worker at the same time, and so too much memory pressure / slowness
function runWorker(buffer: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./src/worker.ts", { workerData: { buffer } });
    worker.on("message", resolve);      // Quand le worker envoie un message, on résout la promesse
    worker.on("error", reject);         // En cas d’erreur, on rejette la promesse
    worker.on("exit", (code) => {
      if (code !== 0)
        reject(new Error(`Le worker s'est arrêté avec le code ${code}`));
    });
  });
}

async function read_lines() {
    //Wet finger estimation of good parameter. Sadly this can be mac dependant. Not sur the mac of corra will need the same value
    const READ_AHEAD = 32*1024*1024;
    const buffer = Buffer.alloc(READ_AHEAD);
    const file = fs.openSync("data/data.csv", "r");

    let position = 0

    // Skip of headers
    fs.readSync(file, buffer, 0, 10);

    let start = Date.now();

    let tasks = [];

    while (true) { // ~ 500 loops
        const read_size = fs.readSync(file, buffer, position, READ_AHEAD - position, -1);

        if (read_size == 0) break;

        const new_line_index = buffer.lastIndexOf('\n', position + read_size)

        // Todo: optimize by not sending full buffer view but only position. This will save reading from parent thread and memory copy and move it to worker-thread
        const shared_array_view = new Uint8Array(new SharedArrayBuffer(new_line_index + 1 - position));
        buffer.copy(shared_array_view, 0, 0, new_line_index + 1 - position); // Copy are bad

        tasks.push(runWorker(shared_array_view));

        position = buffer.length - new_line_index - 1;
        // move all unused part (after the last \n) for the next loop
        buffer.copy(buffer, 0, new_line_index + 1, buffer.length);
    }

    fs.closeSync(file);

    let cities = new Map();

    for (const task of tasks) {
        const cities_task = await task;
        
        cities_task.forEach((city, key) => {
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
            total_cities += city.count;
        });
    }

    console.log(" -- ", (Date.now() - start) / 1000, "s")
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
  aggregations: Record<
    string,
    { min: number; max: number; sum: number; count: number }
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
