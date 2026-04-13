import { comparePublishedDesc, isRecentDate } from "./utils/dates.mjs";

export const RECENT_WINDOW_HOURS = 24;

// Missing timestamps are allowed only for a short allowlist of hand-picked sources.
// This keeps occasional high-signal feeds while dropping most undated noise.
export const UNDATED_SOURCE_ALLOWLIST = new Set([
  "Hacker News 最佳",
  "Hacker News 首页",
  "Product Hunt"
]);

function articleScore(article) {
  return [
    article.link ? 100 : 0,
    article.published_at ? 60 : 0,
    Math.min(article.summary.length, 300),
    article.tags.length * 10
  ].reduce((total, value) => total + value, 0);
}

function chooseBetterArticle(left, right) {
  const leftScore = articleScore(left);
  const rightScore = articleScore(right);
  if (leftScore !== rightScore) {
    return leftScore > rightScore ? left : right;
  }

  const publishedComparison = comparePublishedDesc(left.published_at, right.published_at);
  if (publishedComparison < 0) {
    return left;
  }

  if (publishedComparison > 0) {
    return right;
  }

  return left;
}

export function deduplicateArticles(articles) {
  const deduped = new Map();

  for (const article of articles) {
    const existing = deduped.get(article.id);
    if (!existing) {
      deduped.set(article.id, article);
      continue;
    }

    deduped.set(article.id, chooseBetterArticle(existing, article));
  }

  return Array.from(deduped.values());
}

export function filterArticlesByTime(
  articles,
  {
    nowIsoString,
    recentWindowHours = RECENT_WINDOW_HOURS,
    undatedSourceAllowlist = UNDATED_SOURCE_ALLOWLIST
  }
) {
  return articles.filter((article) => {
    if (!article.published_at) {
      return undatedSourceAllowlist.has(article.source_name);
    }

    return isRecentDate(article.published_at, nowIsoString, recentWindowHours);
  });
}

export function sortArticles(articles) {
  return [...articles].sort((left, right) => {
    const publishedComparison = comparePublishedDesc(left.published_at, right.published_at);
    if (publishedComparison !== 0) {
      return publishedComparison;
    }

    const fetchedComparison = comparePublishedDesc(left.fetched_at, right.fetched_at);
    if (fetchedComparison !== 0) {
      return fetchedComparison;
    }

    return left.title.localeCompare(right.title);
  });
}

export function prepareArticles(articles, options) {
  return sortArticles(filterArticlesByTime(deduplicateArticles(articles), options));
}
