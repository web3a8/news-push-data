export class HttpStatusError extends Error {
  constructor(status, url) {
    super(`HTTP ${status}`);
    this.name = "HttpStatusError";
    this.status = status;
    this.url = url;
  }
}

export function classifyFetchFailure(error) {
  const message = error?.message || String(error);
  const status = typeof error?.status === "number" ? error.status : null;

  if (error?.name === "AbortError" || error?.name === "TimeoutError") {
    return {
      category: "timeout",
      detail: "Request timed out",
      httpStatus: status
    };
  }

  if (status === 401 || status === 403 || status === 451) {
    return {
      category: "access_denied",
      detail: `HTTP ${status}`,
      httpStatus: status
    };
  }

  if (status === 408) {
    return {
      category: "timeout",
      detail: "HTTP 408",
      httpStatus: status
    };
  }

  if (status === 429) {
    return {
      category: "rate_limited",
      detail: "HTTP 429",
      httpStatus: status
    };
  }

  if (status !== null && status >= 500) {
    return {
      category: "upstream_server_error",
      detail: `HTTP ${status}`,
      httpStatus: status
    };
  }

  if (status !== null) {
    return {
      category: "http_error",
      detail: `HTTP ${status}`,
      httpStatus: status
    };
  }

  if (/Unsupported XML feed/i.test(message)) {
    return {
      category: "invalid_feed",
      detail: "Unsupported XML feed",
      httpStatus: null
    };
  }

  if (/Entity expansion limit exceeded/i.test(message)) {
    return {
      category: "xml_entity_limit",
      detail: message,
      httpStatus: null
    };
  }

  if (/invalid payload/i.test(message)) {
    return {
      category: "invalid_payload",
      detail: message,
      httpStatus: null
    };
  }

  if (/unsupported fetcher/i.test(message)) {
    return {
      category: "unsupported_fetcher",
      detail: message,
      httpStatus: null
    };
  }

  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|fetch failed/i.test(message)) {
    return {
      category: "network_error",
      detail: message,
      httpStatus: null
    };
  }

  return {
    category: "unknown",
    detail: message,
    httpStatus: null
  };
}

export function sourceKey({ sourceName, sourceUrl }) {
  return `${sourceName}::${sourceUrl}`;
}

export function buildSourceSummary(sourceResults, publishedArticles) {
  const publishedCountByKey = new Map();

  for (const article of publishedArticles) {
    const key = sourceKey({
      sourceName: article.source_name,
      sourceUrl: article.source_url
    });
    publishedCountByKey.set(key, (publishedCountByKey.get(key) || 0) + 1);
  }

  const sources = sourceResults
    .map((result) => {
      const key = sourceKey(result);
      return {
        source_name: result.sourceName,
        source_url: result.sourceUrl,
        source_type: result.sourceType,
        status: result.status,
        reachable: result.reachable,
        raw_item_count: result.rawItemCount,
        fetched_article_count: result.articles.length,
        published_article_count: publishedCountByKey.get(key) || 0,
        duration_ms: result.durationMs,
        failure_category: result.failureCategory || "",
        failure_detail: result.failureDetail || "",
        http_status: result.httpStatus ?? null,
        warnings: result.warnings
      };
    })
    .sort((left, right) => left.source_name.localeCompare(right.source_name));

  const statusSummary = {
    with_data: sources.filter((source) => source.status === "with_data").length,
    reachable_empty: sources.filter((source) => source.status === "reachable_empty").length,
    failed: sources.filter((source) => source.status === "failed").length
  };

  const breakdownMap = new Map();
  for (const source of sources) {
    if (source.status !== "failed") {
      continue;
    }

    const key = source.failure_category || "unknown";
    const current = breakdownMap.get(key) || {
      category: key,
      count: 0,
      examples: []
    };
    current.count += 1;

    if (current.examples.length < 3) {
      current.examples.push({
        source_name: source.source_name,
        detail: source.failure_detail
      });
    }

    breakdownMap.set(key, current);
  }

  const failureBreakdown = Array.from(breakdownMap.values()).sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return left.category.localeCompare(right.category);
  });

  return {
    sources,
    statusSummary,
    failureBreakdown
  };
}
