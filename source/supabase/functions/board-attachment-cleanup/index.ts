import { createSupabaseContext } from '@supabase/server';

const BUCKET = 'groupware-board-attachments';
// 한 번에 지우는 개수. Storage API 한 번 호출에 담을 만한 크기로 끊는다.
const BATCH_LIMIT = 200;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Target = {
  kind: 'attachment' | 'orphan';
  attachment_id: string | null;
  storage_path: string;
  file_size: number;
};

function response(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS });
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
export default {
  async fetch(request: Request) {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);

    const { data: context, error: contextError } = await createSupabaseContext(request, { auth: 'user' });
    if (contextError || !context) return response({ error: 'authentication_required' }, contextError?.status ?? 401);

    const admin = context.supabaseAdmin;
    const userId = String(context.userClaims?.id ?? context.jwtClaims?.sub ?? '');
    const callerRole = String(context.jwtClaims?.role ?? '');

    // 부를 수 있는 것은 둘뿐이다. 예약 실행(서비스 역할)과 최고관리자.
    if (callerRole !== 'service_role') {
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
    }

    let dryRun = false;
    try {
      const body = await request.json();
      dryRun = body?.dryRun === true;
    } catch {
      // 본문이 없으면 실제 정리로 본다.
    }

    const { data: targets, error: targetError } = await admin
      .rpc('collect_board_attachment_cleanup_targets', { p_limit: BATCH_LIMIT });
    if (targetError) return response({ error: targetError.message }, 500);

    const list = (targets ?? []) as Target[];
    const freedBytes = list.reduce((sum, item) => sum + Number(item.file_size ?? 0), 0);
    const summary = {
      attachments: list.filter((item) => item.kind === 'attachment').length,
      orphans: list.filter((item) => item.kind === 'orphan').length,
      freed_bytes: freedBytes,
    };

    if (dryRun) return response({ dry_run: true, ...summary, paths: list.map((item) => item.storage_path) });
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
  },
};
