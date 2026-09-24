---
name: jeakyung-publish
description: Build, synchronize, publish, and verify updates in playskang-svg/jeakyung-assets to the jeakyung.com Cloudflare Worker. Use automatically after completing requested changes in /workspaces/jeakyung-assets unless the user says local-only, preview-only, or not to deploy. Do not use for other repositories.
---

# 재경닷컴 빠른 배포

Ship completed changes through the repository's existing static-artifact pipeline. The user has requested production publishing by default after updates in this repository, so a separate deployment confirmation is unnecessary. Stop before publishing if validation fails, the branch has diverged, or the requested change would require DNS, Cloudflare project configuration, secrets, destructive database work, or unrelated files.

## Repository invariants

- Worktree: `/workspaces/jeakyung-assets`
- Source project: `source/`
- Deployment repository: `playskang-svg/jeakyung-assets`
- Production branch: `main`
- Production pipeline: `source` build → `npm run sync` → root static assets (committed) → push `main` → Cloudflare Workers Builds auto-deploys via `npx wrangler deploy` (Git integration; `wrangler.jsonc` `assets.directory` is `.`, the repo root itself — no `dist_public/` staging step needed anymore)
- Cloudflare Worker: `jeakyung`, account `380b1bc6d94eaf5f614ceffbdd5ef479`
- Cloudflare zone: `76742882f920c70ae86e1d86a80ef7b5`
- Production URL: `https://jeakyung.com`
- The Vercel pipeline was retired on 2026-09-24 (`vercel.json`/`.vercelignore` removed from the repo); Cloudflare Workers Builds is the only deployment path now. A leftover Vercel Git integration may still comment on PRs until someone with dashboard access to the `playskang-6383s-projects` team disconnects it — ignore those comments, they say nothing about `jeakyung.com`.
- Read `source/AGENTS.md` and `docs/13_DEPLOYMENT.md` before changing the pipeline.
- Preserve unrelated dirty files. Never stage `.gitignore`, `.vscode/`, or other pre-existing changes merely because they are present.
- GitHub authentication for this repository is restored from the Codespaces Secret `JEAKYUNG_GITHUB_TOKEN`; do not substitute another repository's token.
- Do not use the `auto_pub_vercel` skill; it targets `adbles.com` and a different repository.

## Fast publish workflow

1. Run proportional tests for the requested change and `git diff --check`.
2. Confirm `git fetch origin` leaves `HEAD...origin/main` at `0 0`. If not, reconcile safely before building.
3. If `node_modules` is absent, run `npm ci` in `source/`.
4. Run `npm run release` in `source/`. This builds and runs `scripts/sync-build.mjs`, which replaces root `assets/`, copies `groupware/index.html`, and validates HTML asset references.
5. If `source/.env` is absent, reuse the already-deployed public Supabase publishable key without printing it:

   ```bash
   SUPABASE_PUBLIC_KEY="$(rg -o --no-filename 'sb_publishable_[A-Za-z0-9_-]+' ../assets/*.js | head -n 1)"
   test -n "$SUPABASE_PUBLIC_KEY"
   VITE_SUPABASE_URL='https://vzswlvumcdxnryrfwkkl.supabase.co' \
     VITE_SUPABASE_PUBLISHABLE_KEY="$SUPABASE_PUBLIC_KEY" npm run release
   ```

6. Inspect `git status`, `git diff --check`, and the changed file list. Stage only requested source files plus the generated `assets/` changes and `groupware/index.html`. Commit with a scoped message.
7. Push `main`. If the environment-provided GitHub token returns 403 while the stored `gh` account has repository scope, retry with the stored credential:

   ```bash
   env -u GITHUB_TOKEN gh auth setup-git
   env -u GITHUB_TOKEN git push origin main
   ```

8. Pushing `main` is now sufficient to trigger production deployment: Cloudflare Workers Builds is connected to this repo's `main` branch and runs `npx wrangler deploy` automatically against the pushed commit, using `wrangler.jsonc`'s `assets.directory: "."` (the repo root, filtered by `.assetsignore`). No local Wrangler credentials or manual staging are required for a normal update.
9. Confirm the GitHub check **"Workers Builds: jeakyung"** on the pushed commit (or its PR) is `success`, then verify `https://jeakyung.com/groupware/login` serves the new bundle hash. Treat production as complete only once both checks pass. If the Workers Builds check fails, read its Cloudflare dashboard build log via `details_url` before assuming a manual `wrangler deploy` is needed (see Manual fallback below).

## Manual fallback (only if Workers Builds fails or you need to deploy without pushing)

1. Run `wrangler whoami` and confirm the authenticated account includes exactly `380b1bc6d94eaf5f614ceffbdd5ef479`. The commonly injected token for account `46e32ce3c5a1842cb57082e1abaf8a05` cannot deploy the production Worker or access its zone. Do not change `wrangler.jsonc` to the token's account to work around this; stop and request the correct production-account credential.
2. Since `assets.directory` is the repo root, `npx wrangler deploy` can be run directly from the deployment root (no staging directory needed). If a temporary excerpt is still preferred, build it with `.assetsignore` and exclude the excerpt path itself.
3. Confirm `groupware/index.html` references the current JS/CSS filenames, then run `npx wrangler deploy`.
4. Treat production as complete only when Wrangler reports a successful Worker version deployment and `https://jeakyung.com/groupware/login` serves the new bundle. If Cloudflare's challenge blocks automated HTTP verification, report that separately; do not claim the public domain is updated without a successful Wrangler deployment.

Keep the local Vite server running if it was already running unless the user asks to stop it.

## Fast Track for partial updates

Use Fast Track by default for a scoped UI, copy, style, or single-feature update that does not change dependencies, migrations, Worker routing, authentication, DNS, or deployment configuration.

1. Edit the source of truth and run only the focused check plus `git diff --check`; do not run unrelated suites.
2. Run exactly one production `npm run release`. Never patch minified root assets by hand and never rebuild a second time merely to deploy.
3. Confirm `groupware/index.html` names the newly built JS and CSS, then commit and push only the requested source and generated root assets to `main`. Pushing is the deploy step — Cloudflare Workers Builds picks up the new commit and runs `npx wrangler deploy` automatically (Workers Static Assets uploads only content whose hash changed).
4. Verify the **"Workers Builds: jeakyung"** GitHub check is `success` and the production bundle at `https://jeakyung.com` reflects the new hash. If Workers Builds fails, fall back to the Manual fallback section above — do not spend time hunting for local Cloudflare credentials first.

Skip Worker deployment entirely when the only changes are non-served repository instructions such as `docs/`, `.agents/`, or `.vscode/`; commit and push those changes only. Use the full workflow instead of Fast Track whenever the update crosses the exclusions in the first paragraph or the focused validation is inconclusive.
