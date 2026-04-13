# news-push-data

`news-push-data` is the cloud-side raw news dataset producer for the local `news-push` skill.

It only does five things:

1. Fetch RSS/Atom feeds on a schedule.
2. Read a small set of non-RSS extras from explicit config.
3. Normalize, deduplicate, and time-filter articles.
4. Write stable JSON files to `dist/`.
5. Publish those files through GitHub Pages.

It does not do AI summarization, user preference handling, email delivery, local HTML UI, or agent orchestration.

## Relationship To `news-push`

This repository is the upstream raw data producer.

The local `news-push` skill should only:

1. Pull `latest.json` or `latest-lite.json` from GitHub Pages.
2. Render the original article stream locally.
3. Apply user preferences.
4. Let the local agent summarize or transform the data.

## Repository Layout

```text
.
├── feeds/
│   ├── feeds.opml
│   └── extras.json
├── scripts/
│   ├── build-dataset.mjs
│   ├── dedup.mjs
│   ├── fetch-extras.mjs
│   ├── fetch-rss.mjs
│   ├── normalize.mjs
│   ├── validate-output.mjs
│   └── utils/
├── src/
│   └── schema/latest.schema.json
├── dist/
└── .github/workflows/
```

## Manual Run

```bash
npm install
npm run build
npm run validate
```

The default build reads:

- `feeds/feeds.opml`
- `feeds/extras.json`

And writes:

- `dist/latest.json`
- `dist/latest-lite.json`
- `dist/meta.json`

## Output Contract

`dist/latest.json` is the canonical dataset consumed by the local skill.

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

`src/schema/latest.schema.json` is the source of truth for this contract. `npm run validate` must pass before publishing.

## Failure Rule

The build tolerates partial source failures.

- If at least one usable article is produced, the run is treated as successful.
- If zero usable articles are produced, the build exits non-zero.

Warnings are written to `dist/meta.json` and printed to stdout with explicit source names.

## GitHub Pages Setup

1. Push this repository to GitHub as a public repository.
2. In repository settings, set Pages source to `GitHub Actions`.
3. Keep `update-news.yml` enabled for schedule or manual dispatch.
4. Keep `publish-pages.yml` enabled so pushes that update `dist/` are deployed.

When Pages is enabled, files are published at:

- `https://<github-username>.github.io/<repo-name>/latest.json`
- `https://<github-username>.github.io/<repo-name>/latest-lite.json`
- `https://<github-username>.github.io/<repo-name>/meta.json`

Because the Pages artifact uploads the contents of `dist/`, the final URL does not include `/dist/`.

## Extras Config

`feeds/extras.json` is separate from `feeds/feeds.opml` on purpose.

RSS and Atom remain the default source path. Non-RSS sources should be added as explicit entries with:

- `name`
- `enabled`
- `type`
- `fetcher`
- `url`

The local skill should never read these config files directly.

## Logging

Logs are intentionally short and operational:

- `[stage] ...`
- `[batch x/y] ...`
- `[warn] ...`
- `[ok] ...`

The scripts avoid agent-style prose so CI logs stay readable.

## Tests

The test suite uses fixture data and local HTTP servers.

Covered cases:

- OPML parsing
- RSS and Atom parsing
- deduplication
- partial failures
- all-source failure exit behavior
- schema validation failure
