import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_EXTRA_BATCH_PAUSE_MS,
  DEFAULT_EXTRA_CONCURRENCY,
  DEFAULT_EXTRA_TIMEOUT_MS,
  fetchExtrasFromFile
} from "./fetch-extras.mjs";
import {
  DEFAULT_RSS_BATCH_PAUSE_MS,
  DEFAULT_RSS_BATCH_SIZE,
  DEFAULT_RSS_CONCURRENCY,
  DEFAULT_RSS_TIMEOUT_MS,
  fetchRssFeedsFromFile
} from "./fetch-rss.mjs";
import { RECENT_WINDOW_HOURS, prepareArticles } from "./dedup.mjs";
import { toIsoString } from "./utils/dates.mjs";
import { formatError, ok, section } from "./utils/log.mjs";

const DEFAULT_FEEDS_PATH = "feeds/feeds.opml";
const DEFAULT_EXTRAS_PATH = "feeds/extras.json";
const DEFAULT_DIST_DIR = "dist";

function parseArgs(argv) {
  const options = {
    feedsPath: DEFAULT_FEEDS_PATH,
    extrasPath: DEFAULT_EXTRAS_PATH,
    distDir: DEFAULT_DIST_DIR,
    rssBatchSize: DEFAULT_RSS_BATCH_SIZE,
    rssConcurrency: DEFAULT_RSS_CONCURRENCY,
    rssBatchPauseMs: DEFAULT_RSS_BATCH_PAUSE_MS,
    rssTimeoutMs: DEFAULT_RSS_TIMEOUT_MS,
    extraConcurrency: DEFAULT_EXTRA_CONCURRENCY,
    extraBatchPauseMs: DEFAULT_EXTRA_BATCH_PAUSE_MS,
    extraTimeoutMs: DEFAULT_EXTRA_TIMEOUT_MS,
    recentWindowHours: RECENT_WINDOW_HOURS
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = argv[index + 1];

    if (argument === "--feeds") {
      options.feedsPath = nextValue;
      index += 1;
    } else if (argument === "--extras") {
      options.extrasPath = nextValue;
      index += 1;
    } else if (argument === "--dist") {
      options.distDir = nextValue;
      index += 1;
    } else if (argument === "--now") {
      options.now = nextValue;
      index += 1;
    } else if (argument === "--window-hours") {
      options.recentWindowHours = Number(nextValue);
      index += 1;
    }
  }

  return options;
}

async function writeJsonFile(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildLiteDataset(dataset) {
  return {
    dataset_id: dataset.dataset_id,
    generated_at: dataset.generated_at,
    article_count: dataset.article_count,
    articles: dataset.articles.map((article) => ({
      id: article.id,
      title: article.title,
      link: article.link,
      source_name: article.source_name,
      published_at: article.published_at
    }))
  };
}

export async function buildDataset(options = {}) {
  const generatedAt = toIsoString(options.now || new Date()) || new Date().toISOString();

  section("fetching rss feeds");
  const rssResults = await fetchRssFeedsFromFile(options.feedsPath || DEFAULT_FEEDS_PATH, {
    batchPauseMs: options.rssBatchPauseMs ?? DEFAULT_RSS_BATCH_PAUSE_MS,
    batchSize: options.rssBatchSize || DEFAULT_RSS_BATCH_SIZE,
    concurrency: options.rssConcurrency || DEFAULT_RSS_CONCURRENCY,
    fetchedAt: generatedAt,
    timeoutMs: options.rssTimeoutMs || DEFAULT_RSS_TIMEOUT_MS
  });

  section("fetching extras");
  const extraResults = await fetchExtrasFromFile(options.extrasPath || DEFAULT_EXTRAS_PATH, {
    batchPauseMs: options.extraBatchPauseMs ?? DEFAULT_EXTRA_BATCH_PAUSE_MS,
    concurrency: options.extraConcurrency || DEFAULT_EXTRA_CONCURRENCY,
    fetchedAt: generatedAt,
    timeoutMs: options.extraTimeoutMs || DEFAULT_EXTRA_TIMEOUT_MS
  });

  section("deduplicating and filtering");
  const sourceResults = [...rssResults, ...extraResults];
  const articles = prepareArticles(
    sourceResults.flatMap((result) => result.articles),
    {
      nowIsoString: generatedAt,
      recentWindowHours: options.recentWindowHours ?? RECENT_WINDOW_HOURS
    }
  );

  const successfulSources = sourceResults.filter((result) => result.articles.length > 0);
  const warnings = sourceResults.flatMap((result) => result.warnings);
  const dataset = {
    dataset_id: generatedAt,
    generated_at: generatedAt,
    source_count: successfulSources.length,
    article_count: articles.length,
    articles
  };
  const liteDataset = buildLiteDataset(dataset);
  const meta = {
    dataset_id: generatedAt,
    generated_at: generatedAt,
    source_total: sourceResults.length,
    source_succeeded: successfulSources.length,
    source_failed: sourceResults.length - successfulSources.length,
    article_count: articles.length,
    warnings
  };

  section("writing output files");
  const distDir = options.distDir || DEFAULT_DIST_DIR;
  await mkdir(distDir, { recursive: true });
  await writeJsonFile(path.join(distDir, "latest.json"), dataset);
  await writeJsonFile(path.join(distDir, "latest-lite.json"), liteDataset);
  await writeJsonFile(path.join(distDir, "meta.json"), meta);

  ok(`fetched ${dataset.article_count} articles from ${dataset.source_count} sources`);
  ok(`wrote ${path.join(distDir, "latest.json")}`);
  ok(`wrote ${path.join(distDir, "latest-lite.json")}`);
  ok(`wrote ${path.join(distDir, "meta.json")}`);

  if (dataset.article_count === 0) {
    throw new Error("No usable articles fetched from any source");
  }

  return {
    dataset,
    liteDataset,
    meta,
    sourceResults
  };
}

async function runCli() {
  await buildDataset(parseArgs(process.argv.slice(2)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(`[fatal] ${formatError(error)}`);
    process.exitCode = 1;
  });
}
