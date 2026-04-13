import { toIsoString } from "./utils/dates.mjs";
import { buildArticleId, canonicalizeLink } from "./utils/ids.mjs";

const SOURCE_TAG_RULES = [
  { pattern: /openai/i, tags: ["ai"] },
  { pattern: /hugging face|deepmind|google ai|arxiv/i, tags: ["ai"] },
  { pattern: /techcrunch|verge|wired|mit technology review/i, tags: ["tech"] },
  { pattern: /rust|go blog|node\.js|react|vue|typescript/i, tags: ["dev"] },
  { pattern: /hacker news|the hacker news|freebuf|安全客|krebs|schneier/i, tags: ["security"] }
];

export function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
}

export function sanitizeSummary(value) {
  const withoutMarkup = String(value || "")
    .replace(/<!\[CDATA\[|\]\]>/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  return cleanText(decodeHtmlEntities(withoutMarkup));
}

export function normalizeTags({ sourceName, tags = [] }) {
  const collected = new Set();

  for (const tag of tags) {
    const normalized = cleanText(tag).toLowerCase();
    if (normalized) {
      collected.add(normalized);
    }
  }

  for (const rule of SOURCE_TAG_RULES) {
    if (rule.pattern.test(sourceName)) {
      for (const tag of rule.tags) {
        collected.add(tag);
      }
    }
  }

  return Array.from(collected);
}

export function normalizeArticle(rawArticle, context) {
  const title = cleanText(rawArticle.title);
  const sourceName = cleanText(context.sourceName);
  if (!title || !sourceName) {
    return null;
  }

  const link = canonicalizeLink(rawArticle.link);
  const publishedAt = toIsoString(rawArticle.publishedAt);
  const article = {
    id: buildArticleId({
      link,
      sourceName,
      title
    }),
    title,
    link,
    summary: sanitizeSummary(rawArticle.summary),
    published_at: publishedAt,
    source_name: sourceName,
    source_type: cleanText(context.sourceType) || "rss",
    source_url: cleanText(context.sourceUrl),
    fetched_at: toIsoString(context.fetchedAt) || new Date().toISOString(),
    tags: normalizeTags({
      sourceName,
      tags: [...(context.tags || []), ...(rawArticle.tags || [])]
    })
  };

  return article;
}
