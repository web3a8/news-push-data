import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { parseFeedDocument, parseOpml } from "../scripts/utils/xml.mjs";

test("parseOpml reads feed names and urls", async () => {
  const xml = await readFile(new URL("./fixtures/feeds.opml", import.meta.url), "utf8");
  const feeds = parseOpml(xml);

  assert.equal(feeds.length, 2);
  assert.deepEqual(feeds[0], {
    name: "Fixture RSS",
    feedUrl: "https://example.com/rss.xml"
  });
});

test("parseFeedDocument reads rss items", async () => {
  const xml = await readFile(new URL("./fixtures/rss.xml", import.meta.url), "utf8");
  const parsed = parseFeedDocument(xml);

  assert.equal(parsed.sourceType, "rss");
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].title, "RSS entry one");
  assert.equal(parsed.items[0].link, "https://example.com/rss-entry-one?utm_source=test");
  assert.match(parsed.items[0].summary, /Hello/);
  assert.equal(parsed.items[0].publishedAt, "Mon, 13 Apr 2026 08:00:00 GMT");
});

test("parseFeedDocument reads atom entries", async () => {
  const xml = await readFile(new URL("./fixtures/atom.xml", import.meta.url), "utf8");
  const parsed = parseFeedDocument(xml);

  assert.equal(parsed.sourceType, "atom");
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].title, "Atom entry one");
  assert.equal(parsed.items[0].link, "https://example.com/atom-entry-one");
  assert.match(parsed.items[0].summary, /Hello/);
  assert.equal(parsed.items[0].publishedAt, "2026-04-13T08:05:00Z");
});

test("parseFeedDocument tolerates heavy entity usage in summaries", () => {
  const noisySummary = "&amp;".repeat(1505);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Tom &amp; Jerry</title>
      <link>https://example.com/post?a=1&amp;b=2</link>
      <description>${noisySummary}</description>
      <pubDate>Mon, 13 Apr 2026 08:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

  const parsed = parseFeedDocument(xml);

  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].title, "Tom & Jerry");
  assert.equal(parsed.items[0].link, "https://example.com/post?a=1&b=2");
  assert.ok(parsed.items[0].summary.length > 1000);
  assert.ok(parsed.items[0].summary.startsWith("&&&&"));
});
