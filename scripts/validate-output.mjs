import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import { ok } from "./utils/log.mjs";

const DEFAULT_SCHEMA_PATH = "src/schema/latest.schema.json";
const DEFAULT_DATA_PATH = "dist/latest.json";

function parseArgs(argv) {
  const options = {
    dataPath: DEFAULT_DATA_PATH,
    schemaPath: DEFAULT_SCHEMA_PATH
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = argv[index + 1];

    if (argument === "--file") {
      options.dataPath = nextValue;
      index += 1;
    } else if (argument === "--schema") {
      options.schemaPath = nextValue;
      index += 1;
    }
  }

  return options;
}

function formatAjvErrors(errors) {
  return (errors || [])
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
}

export async function validateDatasetObject(dataset, { schemaPath = DEFAULT_SCHEMA_PATH } = {}) {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false
  });
  const validate = ajv.compile(schema);

  if (!validate(dataset)) {
    throw new Error(formatAjvErrors(validate.errors));
  }

  return true;
}

export async function validateDatasetFile({
  dataPath = DEFAULT_DATA_PATH,
  schemaPath = DEFAULT_SCHEMA_PATH
} = {}) {
  const data = JSON.parse(await readFile(dataPath, "utf8"));
  await validateDatasetObject(data, { schemaPath });
  return data;
}

async function runCli() {
  const options = parseArgs(process.argv.slice(2));
  await validateDatasetFile(options);
  ok(`validated ${options.dataPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(`[fatal] ${error.message || String(error)}`);
    process.exitCode = 1;
  });
}
