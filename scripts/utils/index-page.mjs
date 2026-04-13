function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncateText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function formatTimestamp(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return escapeHtml(String(value));
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC"
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute} UTC`;
}

function buildFileCards() {
  return [
    {
      title: "latest.json",
      href: "./latest.json",
      description: "Full dataset with normalized article fields and stable IDs."
    },
    {
      title: "latest-lite.json",
      href: "./latest-lite.json",
      description: "Compact dataset for quick previews and lightweight clients."
    },
    {
      title: "meta.json",
      href: "./meta.json",
      description: "Run statistics, source totals, failures, and warnings."
    }
  ];
}

function renderFailureBreakdown(meta) {
  const breakdown = meta.failure_breakdown || [];
  if (breakdown.length === 0) {
    return "<p class=\"feed-empty\">No failed sources in the latest successful build.</p>";
  }

  return `<ul class="record-list">${breakdown
    .map(
      (entry) => `<li>
            <strong>${escapeHtml(entry.category)}</strong> · ${entry.count} source${entry.count === 1 ? "" : "s"}
            <div class="list-note">${entry.examples
              .map((example) => `${escapeHtml(example.source_name)}: ${escapeHtml(example.detail)}`)
              .join(" · ")}
            </div>
          </li>`
    )
    .join("")}</ul>`;
}

function renderSourceList(items, { includeReason = false } = {}) {
  if (items.length === 0) {
    return "<p class=\"feed-empty\">None.</p>";
  }

  return `<ul class="record-list">
      ${items
        .map(
          (item) => `<li>
            <a href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(item.source_name)}</a>
            <span class="list-meta">${escapeHtml(item.source_type)} · fetched ${item.fetched_article_count} · published ${item.published_article_count} · ${item.duration_ms} ms</span>
            ${
              includeReason && item.failure_detail
                ? `<div class="list-note">${escapeHtml(item.failure_detail)}</div>`
                : ""
            }
          </li>`
        )
        .join("")}
    </ul>`;
}

function buildSourceGroups(articles) {
  const grouped = new Map();

  for (const article of articles) {
    const current = grouped.get(article.source_name) || [];
    current.push(article);
    grouped.set(article.source_name, current);
  }

  return Array.from(grouped.entries())
    .map(([sourceName, sourceArticles]) => ({
      sourceName,
      articles: sourceArticles
    }))
    .sort((left, right) => right.articles.length - left.articles.length)
    .slice(0, 10);
}

function renderArticleGroups(groups) {
  if (groups.length === 0) {
    return "<p class=\"feed-empty\">No articles are available in the current dataset.</p>";
  }

  return groups
    .map(
      (group) => `<div class="group-block">
        <h3>${escapeHtml(group.sourceName)} <span class="list-meta">${group.articles.length} article${group.articles.length === 1 ? "" : "s"}</span></h3>
        <ul class="record-list">
          ${group.articles
            .slice(0, 5)
            .map(
              (article) => `<li>
                <a href="${escapeHtml(article.link || "./latest.json")}" target="_blank" rel="noreferrer">${escapeHtml(article.title)}</a>
                <span class="list-meta">${formatTimestamp(article.published_at || article.fetched_at)}</span>
                <div class="list-note">${escapeHtml(truncateText(article.summary || "No summary provided.", 180))}</div>
              </li>`
            )
            .join("")}
        </ul>
      </div>`
    )
    .join("");
}

export function buildIndexPage({ dataset, meta }) {
  const fileCards = buildFileCards();
  const sourceGroups = buildSourceGroups(dataset.articles);
  const sourceDiagnostics = meta.sources || [];
  const withDataSources = sourceDiagnostics.filter((source) => source.status === "with_data");
  const emptySources = sourceDiagnostics.filter((source) => source.status === "reachable_empty");
  const failedSources = sourceDiagnostics.filter((source) => source.status === "failed");
  const summary = meta.source_status_summary || {
    with_data: 0,
    reachable_empty: 0,
    failed: 0
  };

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>News Push Data</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f1e8;
        --paper: #fffdf8;
        --ink: #1d1b18;
        --muted: #6b6258;
        --line: #ddd2c4;
        --accent: #8b5e3c;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", "Songti SC", serif;
        background: radial-gradient(circle at top, #fff8ec 0%, var(--bg) 55%, #efe8da 100%);
        color: var(--ink);
      }
      main {
        width: min(1080px, calc(100vw - 32px));
        margin: 32px auto 64px;
      }
      section {
        background: rgba(255, 253, 248, 0.92);
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 24px;
        margin-bottom: 20px;
        box-shadow: 0 20px 40px rgba(71, 54, 35, 0.08);
      }
      h1, h2, h3 { margin: 0 0 12px; }
      h1 { font-size: clamp(2rem, 4vw, 3.2rem); }
      h2 { font-size: 1.4rem; border-bottom: 1px solid var(--line); padding-bottom: 10px; }
      h3 { font-size: 1.1rem; }
      p, li { line-height: 1.7; }
      a { color: var(--accent); text-decoration: none; }
      a:hover { text-decoration: underline; }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.92em;
      }
      .meta {
        color: var(--muted);
        font-size: 0.95rem;
        margin: 6px 0 0;
      }
      .header-section {
        background: none;
        border: 0;
        box-shadow: none;
        margin-bottom: 0;
        padding: 0 4px 4px;
      }
      .eyebrow {
        margin: 0 0 10px;
        color: var(--muted);
        font-size: 0.82rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .header-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }
      .header-note {
        max-width: 300px;
        margin: 8px 0 0;
        color: var(--muted);
        text-align: right;
      }
      .global-brief {
        margin: 0;
        font-size: 1.05rem;
        line-height: 1.85;
      }
      .feed-empty {
        margin: 0;
        color: var(--muted);
      }
      .record-list {
        margin: 0;
        padding-left: 1.2rem;
      }
      .record-list li + li {
        margin-top: 0.75rem;
      }
      .list-meta {
        color: var(--muted);
        font-size: 0.92rem;
        margin-left: 0.35rem;
      }
      .list-note {
        margin-top: 0.18rem;
        color: var(--muted);
      }
      .summary-list {
        margin: 0;
        padding-left: 1.2rem;
      }
      .summary-list li + li {
        margin-top: 0.5rem;
      }
      .group-block + .group-block {
        margin-top: 1.25rem;
        padding-top: 1.25rem;
        border-top: 1px solid var(--line);
      }
      details {
        margin-top: 14px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: #fffaf2;
        overflow: hidden;
      }
      summary {
        cursor: pointer;
        padding: 14px 16px;
        font-weight: 600;
        list-style: none;
      }
      summary::-webkit-details-marker {
        display: none;
      }
      .details-body {
        padding: 0 16px 16px;
        border-top: 1px solid var(--line);
      }
      @media (max-width: 768px) {
        .header-row {
          flex-direction: column;
        }
        .header-note {
          max-width: none;
          text-align: left;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="header-section">
        <p class="eyebrow">GitHub Pages Dataset</p>
        <div class="header-row">
          <div>
            <h1>News Push Data</h1>
            <p class="meta">Generated at ${escapeHtml(dataset.generated_at)} · ${dataset.article_count} articles · ${dataset.source_count} active sources</p>
          </div>
          <p class="header-note">A stripped-down landing page inspired by <code>latest.html</code>. It keeps the visual system, but only serves the raw dataset surface.</p>
        </div>
      </section>

      <section>
        <h2>Dataset Snapshot</h2>
        <p class="global-brief">This Pages site publishes the raw dataset consumed by the local <code>news-push</code> skill. It keeps the output stable, lightweight, and easy to inspect: one full dataset, one lighter preview payload, one metadata file, and a short landing page for humans.</p>
      </section>

      <section>
        <h2>Published Files</h2>
        <ul class="record-list">
          ${fileCards
            .map(
              (card) => `<li>
            <a href="${card.href}">${card.title}</a>
            <div class="list-note">${card.description}</div>
          </li>`
            )
            .join("")}
        </ul>
      </section>

      <section>
        <h2>Build Summary</h2>
        <ul class="summary-list">
          <li><strong>Dataset ID:</strong> <code>${escapeHtml(dataset.dataset_id)}</code></li>
          <li><strong>Generated At:</strong> ${escapeHtml(dataset.generated_at)}</li>
          <li><strong>Articles:</strong> ${dataset.article_count}</li>
          <li><strong>Sources:</strong> ${meta.source_succeeded} succeeded · ${meta.source_failed} failed · ${meta.source_total} total</li>
          <li><strong>Warnings:</strong> ${meta.warnings.length}</li>
        </ul>
      </section>

      <section>
        <h2>Fetch Diagnostics</h2>
        <ul class="summary-list">
          <li><strong>With Data:</strong> ${summary.with_data}</li>
          <li><strong>Reachable But Empty:</strong> ${summary.reachable_empty}</li>
          <li><strong>Failed:</strong> ${summary.failed}</li>
        </ul>
        <h3 style="margin-top: 20px;">Failure Categories</h3>
        ${renderFailureBreakdown(meta)}

        <details open>
          <summary>Failed Sources (${failedSources.length})</summary>
          <div class="details-body">
            ${renderSourceList(failedSources, { includeReason: true })}
          </div>
        </details>

        <details>
          <summary>Reachable But Empty (${emptySources.length})</summary>
          <div class="details-body">
            ${renderSourceList(emptySources)}
          </div>
        </details>

        <details>
          <summary>With Data (${withDataSources.length})</summary>
          <div class="details-body">
            ${renderSourceList(withDataSources)}
          </div>
        </details>
      </section>

      <section>
        <h2>Latest Articles</h2>
        ${renderArticleGroups(sourceGroups)}
      </section>
    </main>
  </body>
</html>
`;
}
