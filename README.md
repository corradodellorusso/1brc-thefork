# The One Billion Row Challenge at TheFork

## About the Challenge

The One Billion Row Challenge (1BRC) is a fun exploration of how far modern languages can be pushed for aggregating one billion rows from a text file.

Grab all your knowledge of node and create the fastest implementation for solving this task!

The csv file contains temperature values for a range of weather stations.
Each row is one measurement in the format `<string: station name>,<double: measurement>`, with the measurement value having exactly one fractional digit.
The following shows ten rows as an example:

```
Livingstone,16.3
N'Djamena,21.7
Ahvaz,19.9
Pittsburgh,3.5
Bloemfontein,19.0
Makurdi,30.8
Amsterdam,-14.0
Tbilisi,25.8
Yellowknife,-13.6
Hiroshima,18.1
```

The task is to write a program which reads the file, calculates the min, mean, and max temperature value per weather station, and emits the results on stdout like this
(i.e. sorted alphabetically by station name, and the result values per station in the format `<min>/<mean>/<max>`, rounded to one fractional digit):

```
{Abha=-23.0/18.0/59.2, Abidjan=-16.2/26.0/67.3, Abéché=-10.0/29.4/69.0, Accra=-10.1/26.4/66.4, Addis Ababa=-23.7/16.0/67.0, Adelaide=-27.8/17.3/58.5, ...}
```

## Prerequisites

1. Being a forkie 😆
2. Downloading the full [csv file](https://drive.google.com/file/d/1A_OCjRyHnCCMZbgT0Z5KN70pJXMA8TYD/view) (the one inside `data` folder is only an excerpt).
3. Having node and docker installed

## Running the Challenge

This project contains 2 main scripts:
* `npm run dev`: useful to run the program in the terminal
* `npm start`: create and starts a docker with the same setting that will be used to evaluate the results

## Rules and limits

- No external library dependencies may be used
- The computation must happen at application _runtime_, i.e. you cannot process the measurements file at _build time_ and just bake the result into the binary
- Input value ranges are as follows:
    - Station name: non null UTF-8 string of min length 1 character and max length 100 bytes (i.e. this could be 100 one-byte characters, or 50 two-byte characters, etc.)
    - Temperature value: non null double between -99.9 (inclusive) and 99.9 (inclusive), always with one fractional digit
- There is a maximum of 10,000 unique station names
- Implementations must not rely on specifics of a given data set, e.g. any valid station name as per the constraints above and any data distribution (number of measurements per station) must be supported

## Entering the Challenge

To submit your own implementation simply open a PR changing the `src/index.ts` file with your own implementation.

## Evaluating Results

For now results are determined by running the program in the provided docker container on a Apple MacBook M1 Max.
The `time` program is used for measuring execution times, i.e. end-to-end times are measured.
Each contender will be run five times in a row.
The slowest and the fastest runs are discarded.
The mean value of the remaining three runs is the result for that contender and will be added to the results table above.
The exact same _measurements.txt_ file is used for evaluating all contenders.


## Prize

The glory! 

## FAQ

_Q: Can I use a runtime different from node (i.e. bun)?_
A: Yes.

_Q: What is the encoding of the measurements.txt file?_\
A: The file is encoded with UTF-8.

_Q: Can I make assumptions on the names of the weather stations showing up in the data set?_\
A: No, while only a fixed set of station names is used by the data set generator, any solution should work with arbitrary UTF-8 station names
(for the sake of simplicity, names are guaranteed to contain no `,` character).

_Q: Can I copy code from other submissions?_\
A: Yes, you can. The primary focus of the challenge is about learning something new, rather than "winning". When you do so, please give credit to the relevant source submissions. Please don't re-submit other entries with no or only trivial improvements.

_Q: My solution runs in 2 sec on my machine. Am I the fastest 1BRC-er in the world?_\
A: Probably not :) 1BRC results are reported in wallclock time, thus results of different implementations are only comparable when obtained on the same machine. If for instance an implementation is faster on a 32 core workstation than on the 8 core evaluation instance, this doesn't allow for any conclusions. When sharing 1BRC results, you should also always share the result of running the baseline implementation on the same hardware.

## License

This code base is available under the Apache License, version 2.

## Code of Conduct

Be excellent to each other!
More than winning, the purpose of this challenge is to have fun and learn something new.
