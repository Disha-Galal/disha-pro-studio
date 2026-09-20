# ParseFlow (Disha Pro Studio)

Browser-first document processing: PDF · DOCX · TXT → cleaned, structured output. No uploads — everything runs in your tab.

**Private repo:** https://github.com/Disha-Galal/disha-pro-studio

## Requirements

| Tool | Version |
|------|---------|
| Node.js | **22.13+** |
| pnpm | **11.25.0** (see `packageManager` in `package.json`) |

## Local run (Next.js static export)

```bash
git clone https://github.com/Disha-Galal/disha-pro-studio.git
cd disha-pro-studio
corepack enable && corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm run dev          # http://localhost:3000
```

Production build (writes `out/`):

```bash
pnpm run build
pnpm start            # serves ./out via `serve`
```

Checks:

```bash
pnpm exec tsc --noEmit
pnpm run lint
pnpm run build
```

## ChatGPT Sites

This tree builds as a **static Next export** (`output: 'export'`). Redeploying the ChatGPT Site still needs a separate **@Sites** publish from your ChatGPT / Sites workflow — pushing to GitHub alone does not update the Sites URL.

`.openai/hosting.json` `project_id` is preserved for Sites tooling.

## Termux + Ubuntu (proot)

```bash
# inside proot Ubuntu
apt update && apt install -y curl ca-certificates git build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
corepack enable && corepack prepare pnpm@11.25.0 --activate
git clone https://github.com/Disha-Galal/disha-pro-studio.git
cd disha-pro-studio
pnpm install --frozen-lockfile
pnpm run dev
```

Open the printed `localhost` URL from the phone browser. OCR and large PDFs are heavy on mobile RAM — prefer a desktop for big batches.

## Limits (crash / hang guards)

- Max **20 MB** per file, **10** files per run, **2M** characters merged.
- PDF text extract: **200** pages/file.
- OCR: **20** pages/file, **40** pages/batch; canvas pixel cap; worker released after each run.
- DOCX export capped at **50 000** paragraphs (choose TXT for huge text).

## Deploy

Static `out/` works on Vercel, Netlify, Cloudflare Pages, GitHub Pages. See `DEPLOY_AR.md`. The Pages workflow uses **pnpm** (not npm).
