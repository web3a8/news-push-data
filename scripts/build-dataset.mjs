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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildIndexPage({ dataset, meta }) {
  const warnings = meta.warnings.slice(0, 8);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>news-push-data</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f3f1eb;
        --panel: #fffdf8;
        --ink: #16202a;
        --muted: #5b6670;
        --line: #d7d1c4;
        --accent: #0d6b5d;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
        background:
          radial-gradient(circle at top left, rgba(13, 107, 93, 0.12), transparent 28rem),
          linear-gradient(180deg, #faf7f0 0%, var(--bg) 100%);
        color: var(--ink);
      }

      main {
        max-width: 52rem;
        margin: 0 auto;
        padding: 3rem 1.25rem 4rem;
      }

      .hero {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 1.25rem;
        padding: 1.5rem;
        box-shadow: 0 20px 50px rgba(22, 32, 42, 0.06);
      }

      h1, h2 {
        margin: 0 0 0.75rem;
        line-height: 1.1;
      }

      h1 { font-size: clamp(2.2rem, 5vw, 3.6rem); }
      h2 { font-size: 1.1rem; margin-top: 2rem; }

      p {
        margin: 0.5rem 0 0;
        color: var(--muted);
        line-height: 1.6;
      }

      .grid {
        display: grid;
        gap: 0.9rem;
        grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
        margin-top: 1.5rem;
      }

      .stat, .panel {
        background: rgba(255, 253, 248, 0.9);
        border: 1px solid var(--line);
        border-radius: 1rem;
        padding: 1rem;
      }

      .label {
        font: 600 0.78rem/1.2 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }

      .value {
        margin-top: 0.5rem;
        font: 700 1.8rem/1 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      ul {
        margin: 0.8rem 0 0;
        padding-left: 1.1rem;
      }

      li + li { margin-top: 0.45rem; }

      a {
        color: var(--accent);
        text-decoration-thickness: 0.08em;
        text-underline-offset: 0.16em;
      }

      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.95em;
      }

      .files a {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="label">GitHub Pages Dataset</p>
        <h1>news-push-data</h1>
        <p>Raw news dataset output for the local <code>news-push</code> skill. This site publishes stable JSON files, not a web app.</p>
        <div class="grid">
          <div class="stat">
            <div class="label">Generated At</div>
            <div class="value">${escapeHtml(dataset.generated_at)}</div>
          </div>
          <div class="stat">
            <div class="label">Articles</div>
            <div class="value">${dataset.article_count}</div>
          </div>
          <div class="stat">
            <div class="label">Sources</div>
            <div class="value">${dataset.source_count}</div>
          </div>
        </div>
      </section>

      <section class="panel files">
        <h2>Published Files</h2>
        <ul>
          <li><a href="./latest.json">latest.json</a></li>
          <li><a href="./latest-lite.json">latest-lite.json</a></li>
          <li><a href="./meta.json">meta.json</a></li>
        </ul>
      </section>

      <section class="panel">
        <h2>Run Summary</h2>
        <ul>
          <li><strong>dataset_id:</strong> <code>${escapeHtml(dataset.dataset_id)}</code></li>
          <li><strong>source_total:</strong> ${meta.source_total}</li>
          <li><strong>source_succeeded:</strong> ${meta.source_succeeded}</li>
          <li><strong>source_failed:</strong> ${meta.source_failed}</li>
        </ul>
      </section>

      <section class="panel">
        <h2>Warnings</h2>
        ${warnings.length === 0
          ? "<p>No warnings in the latest successful build.</p>"
          : `<ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>`}
      </section>
    </main>
  </body>
</html>
`;
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
  await writeFile(path.join(distDir, "index.html"), buildIndexPage({ dataset, meta }), "utf8");

  ok(`fetched ${dataset.article_count} articles from ${dataset.source_count} sources`);
  ok(`wrote ${path.join(distDir, "latest.json")}`);
  ok(`wrote ${path.join(distDir, "latest-lite.json")}`);
  ok(`wrote ${path.join(distDir, "meta.json")}`);
  ok(`wrote ${path.join(distDir, "index.html")}`);

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
