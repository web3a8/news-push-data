import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { buildDataset } from "../scripts/build-dataset.mjs";

const execFileAsync = promisify(execFile);
const EMPTY_EXTRAS = JSON.stringify({ sources: [] }, null, 2);
const OK_FEED_URL = encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Fixture RSS</title>
    <item>
      <title>RSS entry one</title>
      <link>https://example.com/rss-entry-one</link>
      <description>Hello RSS</description>
      <pubDate>Mon, 13 Apr 2026 08:00:00 GMT</pubDate>
    </item>
    <item>
      <title>RSS entry two</title>
      <link>https://example.com/rss-entry-two</link>
      <description>Second entry</description>
      <pubDate>Mon, 13 Apr 2026 07:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`);
const BAD_FEED_URL = encodeURIComponent("not xml");

function createOpml(feedEntries) {
  const outlines = feedEntries
    .map(
      (entry) =>
        `    <outline text="${entry.name}" xmlUrl="${entry.url}" />`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <body>
${outlines}
  </body>
</opml>
`;
}

test("buildDataset succeeds when one source fails and another succeeds", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "news-push-data-"));
  const feedsPath = path.join(tmpDir, "feeds.opml");
  const extrasPath = path.join(tmpDir, "extras.json");
  const distDir = path.join(tmpDir, "dist");

  await writeFile(
    feedsPath,
    createOpml([
      { name: "Fixture OK", url: `data:text/xml,${OK_FEED_URL}` },
      { name: "Fixture Fail", url: `data:text/plain,${BAD_FEED_URL}` }
    ])
  );
  await writeFile(extrasPath, `${EMPTY_EXTRAS}\n`);

  const result = await buildDataset({
    feedsPath,
    extrasPath,
    distDir,
    now: "2026-04-13T09:00:00.000Z"
  });

  assert.equal(result.dataset.article_count, 2);
  assert.equal(result.meta.source_succeeded, 1);
  assert.equal(result.meta.source_failed, 1);
  assert.equal(result.meta.warnings.length, 1);
  assert.match(result.meta.warnings[0], /Fixture Fail Unsupported XML feed/);
});

test("build script exits non-zero when all sources fail", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "news-push-data-"));
  const feedsPath = path.join(tmpDir, "feeds.opml");
  const extrasPath = path.join(tmpDir, "extras.json");
  const distDir = path.join(tmpDir, "dist");

  await writeFile(
    feedsPath,
    createOpml([
      { name: "Fixture Fail", url: `data:text/plain,${BAD_FEED_URL}` }
    ])
  );
  await writeFile(extrasPath, `${EMPTY_EXTRAS}\n`);

  const scriptPath = path.join(process.cwd(), "scripts", "build-dataset.mjs");

  await assert.rejects(
    execFileAsync(process.execPath, [
      scriptPath,
      "--feeds",
      feedsPath,
      "--extras",
      extrasPath,
      "--dist",
      distDir,
      "--now",
      "2026-04-13T09:00:00.000Z"
    ]),
    (error) => error.code !== 0
  );
});
