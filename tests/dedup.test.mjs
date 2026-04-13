import test from "node:test";
import assert from "node:assert/strict";

import { deduplicateArticles } from "../scripts/dedup.mjs";
import { normalizeArticle } from "../scripts/normalize.mjs";

test("deduplicateArticles keeps a single record for the same canonical link", () => {
  const context = {
    fetchedAt: "2026-04-13T09:00:00.000Z",
    sourceName: "Fixture RSS",
    sourceType: "rss",
    sourceUrl: "https://example.com/rss.xml"
  };

  const first = normalizeArticle(
    {
      title: "Same story",
      link: "https://example.com/post?utm_source=newsletter",
      summary: "short",
      publishedAt: "2026-04-13T08:00:00Z"
    },
    context
  );
  const second = normalizeArticle(
    {
      title: "Same story",
      link: "https://example.com/post",
      summary: "a much longer summary that should win",
      publishedAt: "2026-04-13T08:00:00Z"
    },
    context
  );

  const deduped = deduplicateArticles([first, second]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].summary, "a much longer summary that should win");
});

test("normalizeArticle falls back to source name plus title when link is missing", () => {
  const first = normalizeArticle(
    {
      title: "Linkless story",
      link: "",
      summary: "one",
      publishedAt: "2026-04-13T08:00:00Z"
    },
    {
      fetchedAt: "2026-04-13T09:00:00.000Z",
      sourceName: "Fixture Feed",
      sourceType: "rss",
      sourceUrl: "https://example.com/rss.xml"
    }
  );
  const second = normalizeArticle(
    {
      title: "Linkless story",
      link: "",
      summary: "two",
      publishedAt: "2026-04-13T08:00:00Z"
    },
    {
      fetchedAt: "2026-04-13T09:00:00.000Z",
      sourceName: "Fixture Feed",
      sourceType: "rss",
      sourceUrl: "https://example.com/rss.xml"
    }
  );

  const deduped = deduplicateArticles([first, second]);
  assert.equal(deduped.length, 1);
  assert.equal(first.id, second.id);
});
