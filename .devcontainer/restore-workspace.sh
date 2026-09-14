#!/usr/bin/env bash
set -eu

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_root="$repository_root/source"

if [ ! -d "$source_root/node_modules" ]; then
  npm ci --prefix "$source_root"
fi

# The Supabase publishable key is intentionally public and already exists in the
# deployed browser bundle. Recreate only a missing local file; never overwrite a
# developer's environment values.
if [ ! -f "$source_root/.env" ]; then
  supabase_public_key="$(rg -o --no-filename 'sb_publishable_[A-Za-z0-9_-]+' "$repository_root"/assets/*.js | head -n 1 || true)"
  if [ -n "$supabase_public_key" ]; then
    umask 077
    printf '%s\n' \
      'VITE_SUPABASE_URL=https://vzswlvumcdxnryrfwkkl.supabase.co' \
      "VITE_SUPABASE_PUBLISHABLE_KEY=$supabase_public_key" \
      > "$source_root/.env"
  else
    printf '%s\n' '재경닷컴: 기존 번들에서 Supabase 공개 키를 찾지 못해 source/.env 복원을 건너뜁니다.' >&2
  fi
fi

printf '%s\n' '재경닷컴 개발 환경 복원이 완료되었습니다.'
