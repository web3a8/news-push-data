import { readFile } from "node:fs/promises";

import { normalizeArticle } from "./normalize.mjs";
import { chunk, fetchText, runConcurrent, sleep } from "./utils/http.mjs";
import { formatError, info, warn } from "./utils/log.mjs";
import { classifyFetchFailure } from "./utils/source-diagnostics.mjs";
import { parseFeedDocument, parseOpml } from "./utils/xml.mjs";

export const DEFAULT_RSS_BATCH_SIZE = 20;
export const DEFAULT_RSS_CONCURRENCY = 6;
export const DEFAULT_RSS_BATCH_PAUSE_MS = 100;
export const DEFAULT_RSS_TIMEOUT_MS = 12000;

export async function loadFeedsFromOpml(opmlPath) {
  const xml = await readFile(opmlPath, "utf8");
  return parseOpml(xml);
}

async function fetchSingleFeed(feed, options) {
  const startedAt = Date.now();

  try {
    const xml = await fetchText(feed.feedUrl, {
      timeoutMs: options.timeoutMs
    });
    const parsed = parseFeedDocument(xml);
    const rawItemCount = parsed.items.length;
    const articles = parsed.items
      .map((item) =>
        normalizeArticle(item, {
          fetchedAt: options.fetchedAt,
          sourceName: feed.name,
          sourceType: parsed.sourceType,
          sourceUrl: feed.feedUrl,
          tags: feed.tags || []
        })
      )
      .filter(Boolean);

    if (articles.length === 0) {
      const warning = `${feed.name} returned 0 articles`;
      warn(warning);
      return {
        sourceName: feed.name,
        sourceUrl: feed.feedUrl,
        sourceType: parsed.sourceType,
        status: "reachable_empty",
        reachable: true,
        rawItemCount,
        durationMs: Date.now() - startedAt,
        failureCategory: "",
        failureDetail: "",
        httpStatus: null,
        articles,
        warnings: [warning]
      };
    }

    return {
      sourceName: feed.name,
      sourceUrl: feed.feedUrl,
      sourceType: parsed.sourceType,
      status: "with_data",
      reachable: true,
      rawItemCount,
      durationMs: Date.now() - startedAt,
      failureCategory: "",
      failureDetail: "",
      httpStatus: null,
      articles,
      warnings: []
    };
  } catch (error) {
    const warning = `${feed.name} ${formatError(error)}`;
    const failure = classifyFetchFailure(error);
    warn(warning);
    return {
      sourceName: feed.name,
      sourceUrl: feed.feedUrl,
      sourceType: "rss",
      status: "failed",
      reachable: false,
      rawItemCount: 0,
      durationMs: Date.now() - startedAt,
      failureCategory: failure.category,
      failureDetail: failure.detail,
      httpStatus: failure.httpStatus,
      articles: [],
      warnings: [warning]
    };
  }
}

export async function fetchRssFeeds(feeds, options = {}) {
  const batchSize = options.batchSize || DEFAULT_RSS_BATCH_SIZE;
  const concurrency = options.concurrency || DEFAULT_RSS_CONCURRENCY;
  const batchPauseMs = options.batchPauseMs ?? DEFAULT_RSS_BATCH_PAUSE_MS;
  const timeoutMs = options.timeoutMs || DEFAULT_RSS_TIMEOUT_MS;
  const batches = chunk(feeds, batchSize);
  const results = [];

  for (const [index, batch] of batches.entries()) {
    info(`[batch ${index + 1}/${batches.length}] fetching ${batch.length} feeds`);
    const batchResults = await runConcurrent(batch, concurrency, (feed) =>
      fetchSingleFeed(feed, {
        fetchedAt: options.fetchedAt,
        timeoutMs
      })
    );

    results.push(...batchResults);

    if (index < batches.length - 1) {
      await sleep(batchPauseMs);
    }
  }

  return results;
}

export async function fetchRssFeedsFromFile(opmlPath, options = {}) {
  const feeds = await loadFeedsFromOpml(opmlPath);
  return fetchRssFeeds(feeds, options);
}
