---
name: jeakyung-publish
description: Build, synchronize, publish, and verify updates in playskang-svg/jeakyung-assets to the jeakyung.com Cloudflare Worker. Use automatically after completing requested changes in /workspaces/jeakyung-assets unless the user says local-only, preview-only, or not to deploy. Do not use for other repositories.
---

# 재경닷컴 빠른 배포

Ship completed changes through the repository's existing static-artifact pipeline. The user has requested production publishing by default after updates in this repository, so a separate deployment confirmation is unnecessary. Stop before publishing if validation fails, the branch has diverged, or the requested change would require DNS, Vercel project configuration, secrets, destructive database work, or unrelated files.

## Repository invariants

- Worktree: `/workspaces/jeakyung-assets`
- Source project: `source/`
- Deployment repository: `playskang-svg/jeakyung-assets`
- Production branch: `main`
- Production pipeline: `source` build → `npm run sync` → root static assets → `dist_public/` → Cloudflare Worker deploy
- Cloudflare Worker: `jeakyung`, account `380b1bc6d94eaf5f614ceffbdd5ef479`
- Cloudflare zone: `76742882f920c70ae86e1d86a80ef7b5`
- Production URL: `https://jeakyung.com`
- Vercel URL `https://jeakyung-assets-playskang-6383s-projects.vercel.app` is only a secondary deployment and is not proof that `jeakyung.com` changed.
- Read `source/AGENTS.md` and `docs/13_DEPLOYMENT.md` before changing the pipeline.
- Preserve unrelated dirty files. Never stage `.gitignore`, `.vscode/`, or other pre-existing changes merely because they are present.
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

8. Before production deployment, run `wrangler whoami` and confirm the authenticated account includes exactly `380b1bc6d94eaf5f614ceffbdd5ef479`. The commonly injected token for account `46e32ce3c5a1842cb57082e1abaf8a05` cannot deploy the production Worker or access its zone. Do not change `wrangler.jsonc` to the token's account to work around this; stop and request the correct production-account credential.
9. Recreate the ignored staging directory from the deployment root, excluding files listed by `.assetsignore`, `dist_public/` itself, `.gitignore`, and `.vscode/`. Confirm the staged `groupware/index.html` references the new JS/CSS filenames, then run `npx wrangler deploy`.
10. Treat production as complete only when Wrangler reports a successful Worker version deployment and `https://jeakyung.com/groupware/login` serves the new bundle. Vercel success alone is insufficient. If Cloudflare's challenge blocks automated HTTP verification, report that separately; do not claim the public domain is updated without a successful Wrangler deployment.

Keep the local Vite server running if it was already running unless the user asks to stop it.
