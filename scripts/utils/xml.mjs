import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  attributeNamePrefix: "",
  cdataPropName: "__cdata",
  htmlEntities: true,
  ignoreAttributes: false,
  parseTagValue: false,
  processEntities: {
    enabled: true,
    allowedTags: [
      "title",
      "link",
      "guid",
      "id",
      "pubDate",
      "published",
      "updated",
      "isoDate",
      "dc:date"
    ],
    maxEntityCount: 1000,
    maxExpandedLength: 200000,
    maxTotalExpansions: 5000
  },
  textNodeName: "__text",
  trimValues: true
});

const tolerantParser = new XMLParser({
  attributeNamePrefix: "",
  cdataPropName: "__cdata",
  htmlEntities: false,
  ignoreAttributes: false,
  parseTagValue: false,
  processEntities: false,
  textNodeName: "__text",
  trimValues: true
});

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

export function parseXml(xml) {
  try {
    return parser.parse(xml);
  } catch (error) {
    if (!/Entity expansion limit exceeded/i.test(error?.message || "")) {
      throw error;
    }

    return tolerantParser.parse(xml);
  }
}

export function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null) {
    return [];
  }

  return [value];
}

export function readNodeText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return decodeXmlEntities(String(value)).trim();
  }

  if (Array.isArray(value)) {
    return value.map((item) => readNodeText(item)).filter(Boolean).join(" ").trim();
  }

  if (typeof value === "object") {
    return [
      value.__text,
      value.__cdata,
      value["#text"],
      value.href,
      value.src
    ]
      .map((item) => readNodeText(item))
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  return "";
}

export function parseOpml(xml) {
  const document = parseXml(xml);
  const feeds = [];

  function visit(outlineNode) {
    for (const item of asArray(outlineNode)) {
      if (item.xmlUrl) {
        feeds.push({
          name: readNodeText(item.text || item.title || item.xmlUrl),
          feedUrl: String(item.xmlUrl).trim()
        });
      }

      if (item.outline) {
        visit(item.outline);
      }
    }
  }

  visit(document?.opml?.body?.outline);
  return feeds;
}

function pickFirst(...values) {
  for (const value of values) {
    const text = readNodeText(value);
    if (text) {
      return text;
    }
  }

  return "";
}

function pickAtomLink(linkNode) {
  for (const candidate of asArray(linkNode)) {
    if (!candidate) {
      continue;
    }

    if (typeof candidate === "string") {
      return candidate.trim();
    }

    if (candidate.rel === "alternate" && candidate.href) {
      return String(candidate.href).trim();
    }
  }

  for (const candidate of asArray(linkNode)) {
    if (candidate?.href) {
      return String(candidate.href).trim();
    }
  }

  return "";
}

export function parseFeedDocument(xml) {
  const document = parseXml(xml);

  if (document.feed) {
    return {
      sourceType: "atom",
      items: asArray(document.feed.entry).map((entry) => ({
        title: pickFirst(entry.title),
        link: pickAtomLink(entry.link),
        summary: pickFirst(entry.summary, entry.content),
        publishedAt: pickFirst(entry.published, entry.updated)
      }))
    };
  }

  const channel = document.rss?.channel || document["rdf:RDF"] || document.feedburner;
  if (!channel) {
    throw new Error("Unsupported XML feed");
  }

  const items = asArray(channel.item || channel.entry).map((item) => ({
    title: pickFirst(item.title),
    link: pickFirst(item.link, item.guid),
    summary: pickFirst(
      item.description,
      item.summary,
      item["content:encoded"],
      item.content
    ),
    publishedAt: pickFirst(
      item.pubDate,
      item.isoDate,
      item.updated,
      item.published,
      item["dc:date"]
    )
  }));

  return {
    sourceType: "rss",
    items
  };
}
