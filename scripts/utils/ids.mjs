import { createHash } from "node:crypto";

const TRACKING_QUERY_KEYS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
  "source",
  "spm",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term"
]);

export function canonicalizeLink(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw);
    url.hash = "";
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();

    const keptEntries = [];
    for (const [key, itemValue] of url.searchParams.entries()) {
      if (TRACKING_QUERY_KEYS.has(key) || key.startsWith("utm_")) {
        continue;
      }

      keptEntries.push([key, itemValue]);
    }

    keptEntries.sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      const left = `${leftKey}=${leftValue}`;
      const right = `${rightKey}=${rightValue}`;
      return left.localeCompare(right);
    });

    url.search = "";
    for (const [key, itemValue] of keptEntries) {
      url.searchParams.append(key, itemValue);
    }

    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    return raw.replace(/#.*$/, "");
  }
}

export function stableHash(value) {
  return createHash("sha1").update(String(value)).digest("hex");
}

export function buildArticleId({ link, sourceName, title }) {
  const canonicalLink = canonicalizeLink(link);
  if (canonicalLink) {
    return stableHash(`link:${canonicalLink}`);
  }

  return stableHash(`fallback:${String(sourceName || "").trim()}|${String(title || "").trim()}`);
}
