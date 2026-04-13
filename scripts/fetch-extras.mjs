import { readFile } from "node:fs/promises";

import { normalizeArticle } from "./normalize.mjs";
import { chunk, fetchJson, runConcurrent, sleep } from "./utils/http.mjs";
import { formatError, info, warn } from "./utils/log.mjs";

export const DEFAULT_EXTRA_BATCH_SIZE = 20;
export const DEFAULT_EXTRA_CONCURRENCY = 4;
export const DEFAULT_EXTRA_BATCH_PAUSE_MS = 100;
export const DEFAULT_EXTRA_TIMEOUT_MS = 20000;

function getByPath(value, pathExpression) {
  if (!pathExpression) {
    return value;
  }

  return String(pathExpression)
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => current?.[key], value);
}

export async function loadExtrasConfig(extrasPath) {
  const content = await readFile(extrasPath, "utf8");
  const parsed = JSON.parse(content);
  const sources = Array.isArray(parsed) ? parsed : parsed.sources || [];
  return sources.filter((source) => source.enabled !== false);
}

function mapJsonItem(rawItem, extra) {
  const fields = extra.fields || {};
  return {
    title: getByPath(rawItem, fields.title || "title"),
    link: getByPath(rawItem, fields.link || "link"),
    summary: getByPath(rawItem, fields.summary || "summary"),
    publishedAt: getByPath(rawItem, fields.published_at || "published_at"),
    tags: getByPath(rawItem, fields.tags || "tags")
  };
}

async function fetchJsonExtra(extra, options) {
  const payload = await fetchJson(extra.url, {
    timeoutMs: options.timeoutMs,
    headers: extra.headers || {}
  });
  const itemPath = extra.itemPath || "items";
  const items = getByPath(payload, itemPath);

  if (!Array.isArray(items)) {
    throw new Error(`invalid payload at ${itemPath}`);
  }

  return items
    .map((item) =>
      normalizeArticle(mapJsonItem(item, extra), {
        fetchedAt: options.fetchedAt,
        sourceName: extra.name,
        sourceType: extra.type || "api",
        sourceUrl: extra.url,
        tags: extra.tags || []
      })
    )
    .filter(Boolean);
}

async function fetchSingleExtra(extra, options) {
  try {
    if (extra.fetcher !== "json") {
      throw new Error(`unsupported fetcher ${extra.fetcher}`);
    }

    const articles = await fetchJsonExtra(extra, options);
    if (articles.length === 0) {
      const warning = `${extra.name} returned 0 articles`;
      warn(warning);
      return {
        sourceName: extra.name,
        sourceUrl: extra.url,
        sourceType: extra.type || "api",
        articles,
        warnings: [warning]
      };
    }

    return {
      sourceName: extra.name,
      sourceUrl: extra.url,
      sourceType: extra.type || "api",
      articles,
      warnings: []
    };
  } catch (error) {
    const warning = `${extra.name} ${formatError(error)}`;
    warn(warning);
    return {
      sourceName: extra.name,
      sourceUrl: extra.url,
      sourceType: extra.type || "api",
      articles: [],
      warnings: [warning]
    };
  }
}

export async function fetchExtras(sources, options = {}) {
  if (sources.length === 0) {
    return [];
  }

  const batchSize = options.batchSize || DEFAULT_EXTRA_BATCH_SIZE;
  const concurrency = options.concurrency || DEFAULT_EXTRA_CONCURRENCY;
  const batchPauseMs = options.batchPauseMs ?? DEFAULT_EXTRA_BATCH_PAUSE_MS;
  const timeoutMs = options.timeoutMs || DEFAULT_EXTRA_TIMEOUT_MS;
  const batches = chunk(sources, batchSize);
  const results = [];

  for (const [index, batch] of batches.entries()) {
    info(`[batch ${index + 1}/${batches.length}] fetching ${batch.length} extras`);
    const batchResults = await runConcurrent(batch, concurrency, (extra) =>
      fetchSingleExtra(extra, {
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

export async function fetchExtrasFromFile(extrasPath, options = {}) {
  const sources = await loadExtrasConfig(extrasPath);
  return fetchExtras(sources, options);
}
