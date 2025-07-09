import { parentPort, workerData } from "worker_threads";
import fs from "fs";
const { start, end } = workerData;


let cities = new Map();

let position = 0;
const file = fs.openSync("data/data.csv", "r");
// read file from start to end
const buffer = Buffer.alloc(end - start);
fs.readSync(file, buffer, 0, end - start, start);

const decoder = new TextDecoder("utf-8");
const lines = decoder.decode(buffer);

fs.closeSync(file);

let new_line_index, next_semicolon, city_name, temperature, city;

function fastParseFloatToInteger(
  str: string,
  start: number,
  end: number = -1,
): number {
  let result = 0;
  let sign = 1;
  let i = start;

  if (end === -1) {
    end = str.length;
  }

  if (str[i] === "-") {
    sign = -1;
    i++;
  }

  while (i < end && str[i] !== ".") {
    result = result * 10 + (str.charCodeAt(i) - 48);
    i++;
  }

  if (i < end && str[i] === ".") {
    i++;
    if (i < end) {
      result = result * 10 + (str.charCodeAt(i) - 48);
    }
  }

  return result * sign;
}


while ((new_line_index = lines.indexOf('\n', position)) !== -1) {
    next_semicolon = lines.indexOf(';', position);
    // Extract the city name
    city_name = lines.slice(position, next_semicolon);
    
    position = new_line_index + 1;

    // Extract the temperature
    temperature = fastParseFloatToInteger(lines, next_semicolon + 1, new_line_index); //todo: parseFloat can be optimised

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
    


}

parentPort.postMessage(cities);
