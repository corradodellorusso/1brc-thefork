import fs from "node:fs";
import {
  Worker,
  isMainThread,
  workerData,
} from 'node:worker_threads';

const fileName = process.env.PWD + "/data/data.csv";
const fd = fs.openSync(fileName, "r");

if (isMainThread && process.argv.length == 2) {
  const nbThreads = 10;
  const fileSize = fs.statSync(fileName).size;
  const CUSOR = fileSize / nbThreads;
  const BUFFER_SIZE = 512;

  let previous = 0;

  for (let i = 0; i < nbThreads; i++) {
    const buffer = Buffer.alloc(BUFFER_SIZE);

    fs.readSync(fd, buffer, 0, BUFFER_SIZE, Math.min(fileSize, (i+1)*CUSOR));

    const position = buffer.indexOf("\n") + (i+1)*CUSOR;

    console.log("Run split", previous, position);


    const worker = new Worker(new URL(import.meta.url), {
      workerData: {start: previous, end: position},
    });

    worker.on('message', (message) => {
      console.log("finish process", message);
    });

    previous = position;
  }
} else {
  let currentWorkerData = workerData;

  if (process.argv.length == 4) {
    const start = parseInt(process.argv[2]!);
    const end = parseInt(process.argv[3]!);

    currentWorkerData = {
      start: start,
      end: end,
    }
  }
  let cities = new Map<string, {min: number, max: number, sum: number, count: number}>();

  function process_lines(lines: string) {
    let position = 0;
    let new_line_index, next_semicolon, city_name, temperature, city;

    city = {
      min: Infinity,
      max: -Infinity,
      sum: 0,
      count: 0
    };

    while (true) {
      new_line_index = lines.indexOf('\n', position);

      if (new_line_index == -1) break;

      next_semicolon = lines.indexOf(';', position);

      city_name = lines.substring(position, next_semicolon);
      temperature = parseFloat(lines.substring(next_semicolon + 1, new_line_index)); //todo: parseFloat can be optimised

      city = cities.get(city_name);
      if (!city) {
          city = {
              min: Infinity,
              max: -Infinity,
              sum: 0,
              count: 0
          };
          cities.set(city_name, city);
      }


      if (temperature < city.min) {
          city.min = temperature;
      }
      if (temperature > city.max) {
          city.max = temperature;
      }
      
      city.sum += temperature;
      city.count += 1;
      

      position = new_line_index + 1;
    }
  }

  const BIG_BUFFER_SIZE = 32*1024*1024;
  let buffer = Buffer.alloc(BIG_BUFFER_SIZE);

  let position = 0;
  let cursor = currentWorkerData.start;

  while (cursor < currentWorkerData.end) {
    const readSize = Math.min(BIG_BUFFER_SIZE - position, currentWorkerData.end - cursor);
    const read_size = fs.readSync(fd, buffer, position, readSize, cursor);

    if (read_size == 0) break;
    
    const new_line_index = buffer.lastIndexOf('\n', position + read_size)

    process_lines(buffer.toString("utf-8", 0, new_line_index));
    
    buffer.copy(buffer, 0, new_line_index + 1, buffer.length);

    position = buffer.length - new_line_index - 1;
    cursor = cursor + read_size;
  }
} 