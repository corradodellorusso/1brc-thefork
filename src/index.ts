import { isMainThread } from "node:worker_threads";
import { processFileChunk } from "./processFileChunk.js";
import { processFile } from "./processFile.js";

const FILE_NAME = `${process.env.PWD}/data/data.csv`;

if (isMainThread) {
  await processFile(FILE_NAME);
} else {
  processFileChunk();
}
