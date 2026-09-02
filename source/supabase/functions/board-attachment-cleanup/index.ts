import { createClient } from '@supabase/supabase-js';

const BUCKET = 'groupware-board-attachments';
const SECRET_KEY = 'board_attachment_cleanup_token';
// 한 번에 지우는 개수. Storage API 한 번 호출에 담을 만한 크기로 끊는다.
const BATCH_LIMIT = 200;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cleanup-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Target = {
  kind: 'attachment' | 'orphan';
  attachment_id: string | null;
  storage_path: string;
  file_size: number;
};

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function response(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

// 길이가 같을 때 걸리는 시간이 내용에 따라 달라지지 않게 한다. 비밀값을 한
// 글자씩 맞춰 보며 알아내는 공격을 막기 위한 것이다.
function secretsMatch(given: string, expected: string) {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < given.length; index += 1) {
    diff |= given.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return diff === 0;
}

// 지운 첨부파일을 저장소에서 실제로 없앤다.
//
// board_attachments 의 지움 표시는 기록일 뿐이라, 그것만으로는 S3 안의 파일이
// 그대로 남는다. storage.objects 행을 SQL 로 지워도 마찬가지다. 파일을 진짜
// 없애려면 Storage API 를 거쳐야 하고, 그래서 이 함수가 있다.
//
// 무엇을 지울지는 DB 가 정한다(collect_board_attachment_cleanup_targets).
// 여기서는 그 목록을 받아 지우고, 지워진 것만 기록에 반영한다. 순서가 중요하다.
// 먼저 기록을 지우고 파일 삭제가 실패하면 그 파일은 영영 아무도 모르는 쓰레기가
// 된다. 반대로 파일을 먼저 지우면 최악의 경우 기록만 남아 다음 실행 때 다시
// 시도된다.
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // 부를 수 있는 것은 둘뿐이다.
  //   예약 실행 — 세션이 없으므로 이 함수 전용 비밀값으로 자신을 증명한다.
  //   최고관리자 — 자기 로그인 세션으로 증명한다.
  let authorizedAs = '';
  const presentedToken = request.headers.get('x-cleanup-token');
  if (presentedToken) {
    const { data: secret } = await admin
      .from('internal_secrets').select('value').eq('key', SECRET_KEY).maybeSingle();
    if (secret?.value && secretsMatch(presentedToken, String(secret.value))) authorizedAs = 'schedule';
  }

  if (!authorizedAs) {
    const bearer = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: caller } = await admin.auth.getUser(bearer);
    const userId = caller?.user?.id;
    if (!userId) return response({ error: 'authentication_required' }, 401);
    const { data: roles, error: roleError } = await admin
      .from('user_role_assignments')
      .select('role_code')
      .eq('user_id', userId)
      .eq('role_code', 'super_admin')
      .eq('is_active', true)
      .is('revoked_at', null)
      .limit(1);
    if (roleError) return response({ error: 'role_lookup_failed' }, 500);
    if (!roles || roles.length === 0) return response({ error: 'super_admin_required' }, 403);
    authorizedAs = 'super_admin';
  }

  let dryRun = false;
  let attachmentIds: string[] = [];
  try {
    const body = await request.json();
    dryRun = body?.dryRun === true;
    // 고른 것만 지우는 경우. 화면에서 목록의 파일을 골라 보낸다.
    if (Array.isArray(body?.attachmentIds)) {
      attachmentIds = body.attachmentIds
        .filter((id: unknown): id is string => typeof id === 'string' && UUID.test(id))
        .slice(0, BATCH_LIMIT);
    }
  } catch {
    // 본문이 없으면 실제 정리로 본다.
  }

  // 고른 것이 있으면 그것만, 없으면 유예가 지난 것을 스스로 훑는다.
  // 둘 다 "살아 있는 글이 가리키는 파일은 건너뛴다"는 같은 규칙을 쓴다.
  const selecting = attachmentIds.length > 0;
  const { data: targets, error: targetError } = selecting
    ? await admin.rpc('select_board_attachment_cleanup_targets', { p_attachment_ids: attachmentIds })
    : await admin.rpc('collect_board_attachment_cleanup_targets', { p_limit: BATCH_LIMIT });
  if (targetError) return response({ error: targetError.message }, 500);

  const list = (targets ?? []) as Target[];
  const summary = {
    called_by: authorizedAs,
    selected: selecting ? attachmentIds.length : null,
    // 고른 것 중 살아 있는 글이 아직 가리켜 건너뛴 개수. 지웠다고만 말하고
    // 남은 것을 알려 주지 않으면 왜 목록에 그대로 있는지 알 수 없다.
    skipped_in_use: selecting ? attachmentIds.length - list.length : null,
    attachments: list.filter((item) => item.kind === 'attachment').length,
    orphans: list.filter((item) => item.kind === 'orphan').length,
    freed_bytes: list.reduce((sum, item) => sum + Number(item.file_size ?? 0), 0),
  };

  if (dryRun) return response({ dry_run: true, ...summary });
  if (list.length === 0) return response({ dry_run: false, ...summary, removed: 0, finalized: 0 });

  const { data: removed, error: removeError } = await admin.storage
    .from(BUCKET)
    .remove(list.map((item) => item.storage_path));
  if (removeError) return response({ error: removeError.message }, 500);

  // 저장소가 지웠다고 확인해 준 경로만 기록에 반영한다. 지우지 못한 것은
  // 손대지 않고 두어 다음 실행 때 다시 잡히게 한다.
  const removedPaths = new Set((removed ?? []).map((item: { name: string }) => item.name));
  const finalizedIds = list
    .filter((item) => item.kind === 'attachment' && item.attachment_id && removedPaths.has(item.storage_path))
    .map((item) => item.attachment_id as string);

  let finalized = 0;
  if (finalizedIds.length > 0) {
    const { data: count, error: finalizeError } = await admin
      .rpc('finalize_board_attachment_cleanup', { p_attachment_ids: finalizedIds });
    if (finalizeError) return response({ error: finalizeError.message }, 500);
    finalized = Number(count ?? 0);
  }

  return response({ dry_run: false, ...summary, removed: removedPaths.size, finalized });
});
