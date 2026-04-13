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

function buildStatusCards({ dataset, meta }) {
  return [
    {
      title: "Dataset ID",
      meta: "Unique build identifier",
      body: `<code>${escapeHtml(dataset.dataset_id)}</code>`
    },
    {
      title: "Run Health",
      meta: "Sources processed",
      body: `${meta.source_succeeded} succeeded · ${meta.source_failed} failed · ${meta.source_total} total`
    },
    {
      title: "Warnings",
      meta: "Operational signal",
      body: `${meta.warnings.length} warning${meta.warnings.length === 1 ? "" : "s"} in the latest successful build`
    },
    {
      title: "Articles",
      meta: "Published records",
      body: `${dataset.article_count} normalized articles in the current dataset`
    }
  ];
}

function buildDiagnosticsCards(meta) {
  const summary = meta.source_status_summary || {
    with_data: 0,
    reachable_empty: 0,
    failed: 0
  };

  return [
    {
      title: "With Data",
      meta: "Fetched and yielded articles",
      body: `${summary.with_data} source${summary.with_data === 1 ? "" : "s"}`
    },
    {
      title: "Reachable But Empty",
      meta: "Fetched successfully, zero normalized articles",
      body: `${summary.reachable_empty} source${summary.reachable_empty === 1 ? "" : "s"}`
    },
    {
      title: "Failed Sources",
      meta: "Request, parse, or access failure",
      body: `${summary.failed} source${summary.failed === 1 ? "" : "s"}`
    }
  ];
}

function buildSampleCards(articles) {
  return articles.slice(0, 6).map((article) => ({
    title: article.title,
    meta: `${escapeHtml(article.source_name)} · ${formatTimestamp(article.published_at || article.fetched_at)}`,
    body: truncateText(article.summary || "No summary provided.", 180),
    href: article.link || "./latest.json"
  }));
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
      articles: sourceArticles,
      latestTime: Math.max(
        ...sourceArticles.map((article) => Date.parse(article.published_at || article.fetched_at) || 0)
      )
    }))
    .sort((left, right) => {
      if (right.articles.length !== left.articles.length) {
        return right.articles.length - left.articles.length;
      }

      return right.latestTime - left.latestTime;
    })
    .slice(0, 8);
}

function renderWarnings(warnings) {
  if (warnings.length === 0) {
    return "<p class=\"feed-empty\">No warnings in the latest successful build.</p>";
  }

  return `<div class="signal-grid">${warnings
    .slice(0, 6)
    .map(
      (warning) => `<article class="signal-card">
            <p class="signal-meta">Warning</p>
            <p>${escapeHtml(warning)}</p>
          </article>`
    )
    .join("")}</div>`;
}

function renderFailureBreakdown(meta) {
  const breakdown = meta.failure_breakdown || [];
  if (breakdown.length === 0) {
    return "<p class=\"feed-empty\">No failed sources in the latest successful build.</p>";
  }

  return `<div class="signal-grid">${breakdown
    .map(
      (entry) => `<article class="signal-card">
            <p class="signal-meta">${entry.count} source${entry.count === 1 ? "" : "s"}</p>
            <h3>${escapeHtml(entry.category)}</h3>
            <p>${entry.examples
              .map((example) => `${escapeHtml(example.source_name)}: ${escapeHtml(example.detail)}`)
              .join(" · ")}</p>
          </article>`
    )
    .join("")}</div>`;
}

function renderDiagnosticsTable(items) {
  if (items.length === 0) {
    return "<p class=\"feed-empty\">None.</p>";
  }

  return `<div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Type</th>
            <th>Fetched</th>
            <th>Published</th>
            <th>Duration</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `<tr>
              <td>
                <a href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(item.source_name)}</a>
              </td>
              <td>${escapeHtml(item.source_type)}</td>
              <td>${item.fetched_article_count}</td>
              <td>${item.published_article_count}</td>
              <td>${item.duration_ms} ms</td>
              <td>${escapeHtml(item.failure_detail || "OK")}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

export function buildIndexPage({ dataset, meta }) {
  const fileCards = buildFileCards();
  const statusCards = buildStatusCards({ dataset, meta });
  const diagnosticsCards = buildDiagnosticsCards(meta);
  const sampleCards = buildSampleCards(dataset.articles);
  const sourceGroups = buildSourceGroups(dataset.articles);
  const sourceDiagnostics = meta.sources || [];
  const withDataSources = sourceDiagnostics.filter((source) => source.status === "with_data");
  const emptySources = sourceDiagnostics.filter((source) => source.status === "reachable_empty");
  const failedSources = sourceDiagnostics.filter((source) => source.status === "failed");

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
      .domain-grid {
        display: grid;
        gap: 20px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .domain-col {
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 16px;
        background: #fffaf2;
      }
      .domain-col h3 {
        display: inline-block;
        margin-bottom: 10px;
        padding: 4px 14px;
        border-radius: 999px;
        background: #f2e2d1;
        color: #6a4429;
        font-size: 0.88rem;
      }
      .domain-brief {
        font-size: 1rem;
        color: var(--ink);
        margin: 0;
        line-height: 1.75;
      }
      .global-brief {
        margin: 0;
        font-size: 1.05rem;
        line-height: 1.85;
      }
      .signal-grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }
      .signal-card {
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 18px;
        background: #fffaf2;
      }
      .signal-card h3 {
        margin-bottom: 8px;
      }
      .signal-card p {
        margin: 0;
      }
      .signal-meta {
        margin-bottom: 10px !important;
        color: var(--muted);
        font-size: 0.85rem;
      }
      .feed-toolbar {
        display: flex;
        align-items: center;
        gap: 10px;
        position: sticky;
        top: 14px;
        z-index: 30;
        margin-bottom: 20px;
        padding: 14px 16px;
        border: 1px solid rgba(139, 94, 60, 0.14);
        border-radius: 20px;
        background: rgba(255, 250, 242, 0.9);
        backdrop-filter: blur(14px);
        box-shadow: 0 12px 30px rgba(71, 54, 35, 0.08);
      }
      .feed-toolbar-label {
        color: var(--muted);
        font-size: 0.82rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .feed-layout {
        display: flex;
        gap: 20px;
        align-items: flex-start;
      }
      .feed-sidebar {
        width: 180px;
        position: sticky;
        top: 92px;
        flex-shrink: 0;
        max-height: calc(100vh - 120px);
        overflow-y: auto;
        padding-right: 6px;
        scrollbar-width: thin;
      }
      .sidebar-link {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 12px;
        margin-bottom: 4px;
        border-radius: 999px;
        font-size: 0.85rem;
        color: var(--muted);
        text-decoration: none;
      }
      .sidebar-link:hover {
        background: rgba(139, 94, 60, 0.08);
        color: var(--ink);
      }
      .feed-content {
        flex: 1;
        min-width: 0;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 999px;
        background: rgba(107, 98, 88, 0.1);
        font-size: 0.75rem;
        color: var(--muted);
        margin-left: 6px;
      }
      .source-group {
        margin-bottom: 20px;
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 16px;
        background: #fffaf2;
        scroll-margin-top: 104px;
      }
      .source-header {
        display: flex;
        align-items: center;
        margin: 0 0 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--line);
        font-size: 1rem;
        color: var(--ink);
      }
      .feed-item + .feed-item {
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid var(--line);
      }
      .feed-empty {
        margin: 0;
        color: var(--muted);
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
      .table-wrap {
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.95rem;
      }
      th, td {
        padding: 10px 12px;
        border-bottom: 1px solid var(--line);
        text-align: left;
        vertical-align: top;
      }
      th {
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--muted);
      }
      @media (max-width: 768px) {
        .header-row {
          flex-direction: column;
        }
        .header-note {
          max-width: none;
          text-align: left;
        }
        .feed-layout { flex-direction: column; }
        .feed-sidebar {
          position: static;
          width: 100%;
          max-height: none;
          display: flex;
          overflow-x: auto;
          gap: 6px;
          padding-bottom: 8px;
          -webkit-overflow-scrolling: touch;
        }
        .sidebar-link {
          white-space: nowrap;
          flex-shrink: 0;
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
        <div class="domain-grid">
          ${fileCards
            .map(
              (card) => `<div class="domain-col">
            <h3><a href="${card.href}">${card.title}</a></h3>
            <p class="domain-brief">${card.description}</p>
          </div>`
            )
            .join("")}
        </div>
      </section>

      <section>
        <h2>Run Status</h2>
        <div class="signal-grid">
          ${statusCards
            .map(
              (card) => `<article class="signal-card">
            <p class="signal-meta">${card.meta}</p>
            <h3>${card.title}</h3>
            <p>${card.body}</p>
          </article>`
            )
            .join("")}
        </div>
      </section>

      <section>
        <h2>Fetch Diagnostics</h2>
        <div class="signal-grid">
          ${diagnosticsCards
            .map(
              (card) => `<article class="signal-card">
            <p class="signal-meta">${card.meta}</p>
            <h3>${card.title}</h3>
            <p>${card.body}</p>
          </article>`
            )
            .join("")}
        </div>
        <h3 style="margin-top: 20px;">Failure Breakdown</h3>
        ${renderFailureBreakdown(meta)}

        <details open>
          <summary>Failed Sources (${failedSources.length})</summary>
          <div class="details-body">
            ${renderDiagnosticsTable(failedSources)}
          </div>
        </details>

        <details>
          <summary>Reachable But Empty (${emptySources.length})</summary>
          <div class="details-body">
            ${renderDiagnosticsTable(emptySources)}
          </div>
        </details>

        <details>
          <summary>With Data (${withDataSources.length})</summary>
          <div class="details-body">
            ${renderDiagnosticsTable(withDataSources)}
          </div>
        </details>
      </section>

      <section>
        <h2>Latest Articles</h2>
        <div class="signal-grid">
          ${
            sampleCards.length === 0
              ? `<p class="feed-empty">No articles are available in the current dataset.</p>`
              : sampleCards
                  .map(
                    (card) => `<article class="signal-card">
            <p class="signal-meta">${card.meta}</p>
            <h3><a href="${escapeHtml(card.href)}" target="_blank" rel="noreferrer">${escapeHtml(card.title)}</a></h3>
            <p>${escapeHtml(card.body)}</p>
          </article>`
                  )
                  .join("")
          }
        </div>
      </section>

      <section>
        <h2>Warnings</h2>
        ${renderWarnings(meta.warnings)}
      </section>

      <section>
        <h2>Source Stream</h2>
        <div class="feed-toolbar">
          <div class="feed-toolbar-label">Top sources in current output</div>
        </div>
        <div class="feed-layout">
          <nav class="feed-sidebar">
            ${
              sourceGroups.length === 0
                ? `<p class="feed-empty">No sources.</p>`
                : sourceGroups
                    .map(
                      (group, index) =>
                        `<a class="sidebar-link" href="#src-${index}">${escapeHtml(group.sourceName)}<span class="badge">${group.articles.length}</span></a>`
                    )
                    .join("")
            }
          </nav>
          <div class="feed-content">
            ${
              sourceGroups.length === 0
                ? `<p class="feed-empty">No source groups are available.</p>`
                : sourceGroups
                    .map(
                      (group, index) => `<div class="source-group" id="src-${index}">
                <h3 class="source-header">${escapeHtml(group.sourceName)}<span class="badge">${group.articles.length}</span></h3>
                ${group.articles
                  .slice(0, 3)
                  .map(
                    (article) => `<article class="feed-item">
                    <h3><a href="${escapeHtml(article.link || "./latest.json")}" target="_blank" rel="noreferrer">${escapeHtml(article.title)}</a></h3>
                    <p class="meta">${formatTimestamp(article.published_at || article.fetched_at)}</p>
                    <p>${escapeHtml(truncateText(article.summary || "No summary provided.", 220))}</p>
                  </article>`
                  )
                  .join("")}
              </div>`
                    )
                    .join("")
            }
          </div>
        </div>
      </section>
    </main>
  </body>
</html>
`;
}
