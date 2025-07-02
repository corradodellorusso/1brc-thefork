import { parentPort, workerData } from "worker_threads";

const { buffer } = workerData;

let cities = new Map();

let position = 0;

const decoder = new TextDecoder();
const lines = decoder.decode(buffer);

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

    // Extract the city name
    city_name = lines.substring(position, next_semicolon);
    

    // Extract the temperature
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

parentPort.postMessage(cities);
