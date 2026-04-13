import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { validateDatasetFile } from "../scripts/validate-output.mjs";

test("validateDatasetFile fails when latest.json does not match schema", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "news-push-data-schema-"));
  const dataPath = path.join(tmpDir, "latest.json");

  await writeFile(
    dataPath,
    JSON.stringify(
      {
        dataset_id: "2026-04-13T09:00:00.000Z",
        generated_at: "2026-04-13T09:00:00.000Z",
        source_count: 1,
        article_count: 1,
        articles: [
          {
            id: "abc",
            title: "broken record"
          }
        ]
      },
      null,
      2
    )
  );

  await assert.rejects(
    validateDatasetFile({
      dataPath,
      schemaPath: path.join(process.cwd(), "src", "schema", "latest.schema.json")
    }),
    /must have required property|minLength/
  );
});
