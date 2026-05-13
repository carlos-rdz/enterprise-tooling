# enterprise-coordination docs site

Astro Starlight docs for [`enterprise-tooling`](https://github.com/carlos-rdz/enterprise-tooling). Published at https://carlos-rdz.github.io/enterprise-tooling/.

## Run locally

```bash
cd docs-site
npm ci
npm run dev      # http://localhost:4321/enterprise-tooling/
```

## Build

```bash
npm run build    # outputs to docs-site/dist/
npm run preview  # serve the built site locally
```

## Where the pages live

All page content is in `src/content/docs/`, organized by sidebar section:

```
src/content/docs/
├── index.mdx                 # landing page
├── getting-started/          # setup + credentials
├── concepts/                 # why / architecture / three modes
├── workflows/                # one page per workflow (4)
├── mcp-servers/              # overview + one page per server (4)
├── gateway/                  # gateway overview + auth + audit log
├── evals/                    # eval harness + writing cases
├── hooks/                    # PreToolUse hooks
├── guides/                   # adding-an-mcp-server + observability
└── reference/                # changelog / contributing / security / landscape
```

The sidebar order is configured in `astro.config.mjs`.

## Adding a page

1. Drop an `.mdx` (or `.md`) file under `src/content/docs/<section>/`.
2. Add it to the `sidebar` array in `astro.config.mjs` if it should appear in nav.
3. `npm run build` to verify no broken links.

## Deploys

Pushed to GitHub Pages by `.github/workflows/docs-site.yml` on every push to `main`.
