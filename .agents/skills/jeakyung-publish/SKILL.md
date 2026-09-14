---
name: jeakyung-publish
description: Build, synchronize, publish, and verify updates in playskang-svg/jeakyung-assets for jeakyung.com. Use automatically after completing requested changes in /workspaces/jeakyung-assets unless the user says local-only, preview-only, or not to deploy. Do not use for other repositories.
---

# 재경닷컴 빠른 배포

Ship completed changes through the repository's existing static-artifact pipeline. The user has requested production publishing by default after updates in this repository, so a separate deployment confirmation is unnecessary. Stop before publishing if validation fails, the branch has diverged, or the requested change would require DNS, Vercel project configuration, secrets, destructive database work, or unrelated files.

## Repository invariants

- Worktree: `/workspaces/jeakyung-assets`
- Source project: `source/`
- Deployment repository: `playskang-svg/jeakyung-assets`
- Production branch: `main`
- Pipeline: `source` build → `npm run sync` → root static assets → push `main` → Vercel
- Production URL: `https://jeakyung.com`
- Direct verification URL: `https://jeakyung-assets-playskang-6383s-projects.vercel.app`
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

8. Verify the pushed commit's GitHub `Vercel` status reaches `success`, then fetch `/groupware/login` from the direct Vercel URL and confirm it references the newly generated groupware JS filename. Confirm that JS and CSS assets return HTTP 200.
9. A Cloudflare challenge may make automated requests to `jeakyung.com` or `www.jeakyung.com` return 403. Do not treat that alone as a failed deployment when Vercel reports success and the direct production URL serves the new bundle. Report this distinction and provide the public page URL.

Keep the local Vite server running if it was already running unless the user asks to stop it.
