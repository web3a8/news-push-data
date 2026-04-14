# news-push-data

`news-push-data` is a public distribution repository for prepared news data.

This repository is intentionally narrow in scope. It exists to publish already-built outputs for direct consumption, not to expose the private production pipeline that fetches, filters, ranks, and assembles those outputs.

## What This Repository Contains

- `dist/latest.json`
- `dist/latest-lite.json`
- `dist/meta.json`
- `dist/index.html`
- `src/schema/latest.schema.json`

## What This Repository Does Not Contain

- source lists
- RSSHub route configuration
- crawler code
- agent repair logic
- cookies, tokens, or private infrastructure settings
- build-time scheduling or data production workflows

Those concerns now live outside this public repository in the private or local pipeline that produces the dataset and pushes the final `dist/` contents here.

## Output Files

Published URLs:

- `https://<github-username>.github.io/<repo-name>/`
- `https://<github-username>.github.io/<repo-name>/latest.json`
- `https://<github-username>.github.io/<repo-name>/latest-lite.json`
- `https://<github-username>.github.io/<repo-name>/meta.json`

`latest.json` is the canonical full dataset.

Top-level fields:

- `dataset_id`
- `generated_at`
- `source_count`
- `article_count`
- `articles`

Each article contains:

- `id`
- `title`
- `link`
- `summary`
- `published_at`
- `source_name`
- `source_type`
- `source_url`
- `fetched_at`
- `tags`

`latest-lite.json` is the small transport-friendly subset.

`meta.json` contains operational metadata, including:

- `source_total`
- `source_succeeded`
- `source_failed`
- `warnings`
- `source_status_summary`
- `failure_breakdown`
- `sources`

## Schema

`src/schema/latest.schema.json` is the public contract for `latest.json`.

Consumers should treat that schema as the stable interface, not any internal production details.

## Pages Publishing

GitHub Pages should use `GitHub Actions` as its source.

This repository no longer builds the dataset on GitHub. Instead, an external pipeline updates `dist/` and pushes the results here. A lightweight Pages workflow then republishes the current `dist/` directory.

## Consumer Guidance

If you are building on top of this repository:

- fetch `latest.json` when you need full article data
- fetch `latest-lite.json` when you only need titles and links
- inspect `meta.json` for diagnostics and source health
- rely on the schema, not on unpublished production implementation details

## Repository Boundary

This repository is the public output layer.

The production system that gathers sources, normalizes records, retries failures, runs private adapters, or uses self-hosted RSSHub is intentionally kept elsewhere.
