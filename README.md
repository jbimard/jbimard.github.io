# jbimard.github.io

This repository hosts my personal portfolio website, built to showcase projects, goals, and technical content. The website leverages modern frontend technologies and integrates Notion for dynamic content rendering.

It also includes `/jobs`, a private multi-user job pipeline dashboard backed by Supabase (Auth + Postgres with RLS).

## Features

- **React + TypeScript:** A robust frontend framework with strict typing for scalable and maintainable code.
- **Vite:** Fast development and build tooling for optimal performance.
- **Tailwind CSS:** Utility-first styling for quick and responsive UI design.
- **PrismJS:** Syntax highlighting for code blocks (theme: `prism-tomorrow.css`).
- **KaTeX:** Render complex math formulas seamlessly.
- **react-notion-x:** Rich Notion page rendering with support for collections, code, and equations.
- **Notion Embed Iframes:** Simple embedding of Notion pages using v2-embednotion.com.
- **Supabase:** Auth and database for the `/jobs` dashboard (row-level security scoped per user).

## Development Tools

- **ESLint:** Enforces consistent coding standards and formatting.
- **TypeScript Compiler (tsc):** Builds `.ts` and `.tsx` files.
- **concurrently (optional):** Run Vite alongside an API server during development.
- **npm:** Manages project dependencies.

## Environment Variables

The `/jobs` dashboard requires Supabase credentials at build time:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

- **Local development:** copy `.env.example` to `.env.local` and fill in your project's values.
- **Deployment:** this repo deploys via GitHub Actions (`.github/workflows/deploy.yml`) to GitHub Pages. The `build` job runs under the `github-pages` environment, so set these two as **Environment secrets** under Settings → Environments → `github-pages` (not repository secrets).

Without these set, the site falls back to a "Supabase is not configured" notice instead of failing the build.

