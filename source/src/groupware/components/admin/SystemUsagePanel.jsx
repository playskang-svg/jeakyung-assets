import { useState } from 'react';
import { Link } from 'react-router-dom';

import { runAttachmentCleanup } from '../../services/adminUsageService.js';

const EMPTY_USAGE = {
  generated_at: null,
  members: {},
  dashboards: {},
  content: {},
  attachments: {},
  boards: [],
  activity: {},
  file_details: { largest_file: null, cleanup_candidates: [] },
};

const number = (value) => new Intl.NumberFormat('ko-KR').format(Number(value) || 0);

function bytes(value) {
  const size = Number(value) || 0;
  if (size < 1024) return `${number(size)} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`;
  return `${(size / 1024 ** 3).toFixed(2)} GB`;
}

function UsageMetric({ label, value, detail, tone = '' }) {
  return (
    <article className={`gw-usage-metric${tone ? ` gw-usage-metric--${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

// 사용량은 관리자 화면이 한 번만 조회해 내려준다. 같은 RPC를 화면마다 다시
// 부르지 않도록 이 패널은 표시만 담당한다.
export default function SystemUsagePanel({ usage: incoming, loading = false, onReload }) {
  const usage = incoming ?? EMPTY_USAGE;
  const error = incoming ? '' : '시스템 사용량을 불러오지 못했습니다. 관리자 권한과 Supabase 마이그레이션을 확인해 주세요.';

  const { members, content, attachments, dashboards, activity, boards } = usage;
  const fileDetails = usage.file_details ?? EMPTY_USAGE.file_details;
  const [cleanupState, setCleanupState] = useState({ busy: false, message: '', tone: '' });

  // 미리보기로 무엇이 지워질지 먼저 보여 준다. 지운 파일은 되돌릴 수 없으므로
  // 확인 없이 바로 지우지 않는다.
  const runCleanup = async (dryRun) => {
    setCleanupState({ busy: true, message: '', tone: '' });
    try {
      const result = await runAttachmentCleanup({ dryRun });
      const scope = `첨부 ${number(result.attachments)}개 · 미등록 파일 ${number(result.orphans)}개 (${bytes(result.freed_bytes)})`;
      if (dryRun) {
        if (result.attachments + result.orphans === 0) {
          setCleanupState({ busy: false, message: '지울 파일이 없습니다.', tone: 'ok' });
          return;
        }
        setCleanupState({ busy: false, message: `지울 대상: ${scope}. 아래 "영구 삭제 실행"을 누르면 되돌릴 수 없습니다.`, tone: 'warning' });
        return;
      }
      setCleanupState({ busy: false, message: `삭제 완료 — ${scope}, 저장소에서 ${number(result.removed)}개를 지웠습니다.`, tone: 'ok' });
      onReload?.();
    } catch (cleanupError) {
      setCleanupState({ busy: false, message: cleanupError.message, tone: 'error' });
    }
  };

  const generatedAt = usage.generated_at
    ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(usage.generated_at))
    : '집계 전';

  return (
    <section className="gw-admin-section gw-usage-section" aria-labelledby="system-usage-title">
      <div className="gw-admin-section-heading">
        <div>
          <span className="gw-eyebrow">SYSTEM USAGE</span>
          <h2 id="system-usage-title">시스템 사용량</h2>
          <p>회원·콘텐츠·첨부파일 사용량과 정리 대상을 개인 식별정보 없이 집계합니다.</p>
        </div>
        <div className="gw-usage-refresh">
          <span>기준 {generatedAt}</span>
          <button className="gw-secondary-button" type="button" onClick={onReload} disabled={loading}>
            {loading ? '집계 중…' : '새로고침'}
          </button>
        </div>
      </div>

      {error && <div className="gw-notice gw-notice--warning" role="alert">{error}</div>}
      {loading && !usage.generated_at ? (
        <p className="gw-empty-state" role="status">시스템 사용량을 집계하고 있습니다.</p>
      ) : (
        <>
          <div className="gw-usage-metrics" aria-label="핵심 사용량">
            <UsageMetric label="승인 회원" value={`${number(members.approved)}명`} detail={`전체 ${number(members.total)}명 · 승인 대기 ${number(members.pending)}명`} />
            <UsageMetric label="운영 게시판" value={`${number(content.boards_active)}개`} detail={`전체 ${number(content.boards_total)}개 · 보관 ${number(content.boards_archived)}개`} />
            <UsageMetric label="게시된 글" value={`${number(content.posts_published)}건`} detail={`임시 저장 ${number(content.posts_draft)}건 · 댓글 ${number(content.comments_total)}건`} />
            <UsageMetric label="활성 첨부 용량" value={bytes(attachments.active_bytes)} detail={`본문 이미지 ${number(attachments.inline_images)}장 · 일반 첨부 ${number(attachments.general_files)}개`} />
            <UsageMetric label="정리 대기" value={`${number(attachments.cleanup_candidates)}개`} detail={`${bytes(attachments.cleanup_bytes)} · 기한 도래 ${number(attachments.due_cleanup_count)}개`} tone={Number(attachments.due_cleanup_count) > 0 ? 'warning' : ''} />
            <UsageMetric label="Storage 객체" value={`${number(attachments.object_count)}개`} detail={`${bytes(attachments.object_bytes)} · 미등록 ${number(attachments.orphan_object_count)}개`} tone={Number(attachments.orphan_object_count) > 0 ? 'warning' : ''} />
            <UsageMetric label="가장 큰 파일" value={fileDetails.largest_file ? bytes(fileDetails.largest_file.file_size) : '없음'} detail={fileDetails.largest_file ? `${fileDetails.largest_file.board_name} · ${fileDetails.largest_file.original_name}` : '등록된 첨부파일 없음'} />
          </div>

          <div className="gw-usage-summary-grid">
            <article className="gw-usage-summary-card">
              <h3>회원 상태</h3>
              <dl>
                <div><dt>승인</dt><dd>{number(members.approved)}</dd></div>
                <div><dt>대기</dt><dd>{number(members.pending)}</dd></div>
                <div><dt>거절</dt><dd>{number(members.rejected)}</dd></div>
                <div><dt>잠금</dt><dd>{number(members.locked)}</dd></div>
                <div><dt>퇴사</dt><dd>{number(members.resigned)}</dd></div>
              </dl>
            </article>
            <article className="gw-usage-summary-card">
              <h3>콘텐츠 상태</h3>
              <dl>
                <div><dt>게시</dt><dd>{number(content.posts_published)}</dd></div>
                <div><dt>임시 저장</dt><dd>{number(content.posts_draft)}</dd></div>
                <div><dt>숨김</dt><dd>{number(content.posts_hidden)}</dd></div>
                <div><dt>삭제 상태</dt><dd>{number(content.posts_deleted)}</dd></div>
                <div><dt>30일 조회</dt><dd>{number(activity.post_views_30d)}</dd></div>
              </dl>
            </article>
            <article className="gw-usage-summary-card">
              <h3>운영 구성</h3>
              <dl>
                <div><dt>활성 위젯</dt><dd>{number(dashboards.active)}</dd></div>
                <div><dt>보관 위젯</dt><dd>{number(dashboards.archived)}</dd></div>
                <div><dt>배포 규칙</dt><dd>{number(dashboards.assignments)}</dd></div>
                <div><dt>사용자 설정</dt><dd>{number(dashboards.preferences)}</dd></div>
                <div><dt>30일 감사 이벤트</dt><dd>{number(activity.audit_events_30d)}</dd></div>
              </dl>
            </article>
          </div>

          <div className="gw-usage-board-heading">
            <div>
              <h3>게시판별 사용량</h3>
              <p>표시 한도는 게시글 1건 기준이며, 변경은 게시판 관리 화면에서 수행합니다.</p>
            </div>
            <Link className="gw-secondary-button" to="/admin/boards">게시판 한도 관리</Link>
          </div>
          {boards.length === 0 ? (
            <p className="gw-empty-state">등록된 게시판이 없습니다.</p>
          ) : (
            <div className="gw-usage-board-grid">
              {boards.map((board) => (
                <article className="gw-usage-board-card" key={board.id}>
                  <header>
                    <div><strong>{board.name}</strong><span>/{board.slug} · {board.board_type}</span></div>
                    <span className={`gw-state-dot${board.is_active && !board.archived_at ? '' : ' is-inactive'}`} aria-label={board.is_active && !board.archived_at ? '운영 중' : '비활성 또는 보관'} />
                  </header>
                  <dl>
                    <div><dt>게시글 / 댓글</dt><dd>{number(board.posts)} / {number(board.comments)}</dd></div>
                    <div><dt>본문 이미지 / 첨부</dt><dd>{number(board.inline_images)} / {number(board.general_files)}</dd></div>
                    <div><dt>활성 용량</dt><dd>{bytes(board.attachment_bytes)}</dd></div>
                    <div><dt>정리 후보</dt><dd>{number(board.cleanup_candidates)}개</dd></div>
                  </dl>
                  <p>1장 {number(board.max_inline_image_size_mb)}MB · 이미지 {number(board.max_inline_images)}장 · 합산 {number(board.max_total_attachment_mb)}MB</p>
                </article>
              ))}
            </div>
          )}
          <div className="gw-usage-cleanup-actions">
            <p className="gw-usage-retention-note">
              정리 후보는 최소 24시간의 복구 유예를 거칩니다. 유예가 지난 첨부와, 등록에 실패해 저장소에만 남은 파일이 삭제 대상입니다.
              살아 있는 글이 아직 가리키고 있는 파일은 유예가 지났어도 건너뜁니다. <strong>삭제한 파일은 되돌릴 수 없습니다.</strong>
            </p>
            <div>
              <button className="gw-secondary-button" type="button" onClick={() => runCleanup(true)} disabled={cleanupState.busy}>
                {cleanupState.busy ? '확인 중…' : '무엇이 지워지는지 먼저 보기'}
              </button>
              <button className="gw-secondary-button gw-secondary-button--danger" type="button" disabled={cleanupState.busy}
                onClick={() => { if (window.confirm('유예가 지난 파일을 저장소에서 영구 삭제합니다. 되돌릴 수 없습니다. 계속할까요?')) runCleanup(false); }}>
                영구 삭제 실행
              </button>
            </div>
            {cleanupState.message && <p className={`gw-usage-cleanup-result gw-usage-cleanup-result--${cleanupState.tone}`} role="status">{cleanupState.message}</p>}
          </div>
          {fileDetails.cleanup_candidates.length > 0 && <section className="gw-usage-cleanup-list" aria-labelledby="cleanup-candidate-title"><h3 id="cleanup-candidate-title">정리 후보 파일</h3><ul>{fileDetails.cleanup_candidates.map((item) => <li key={item.id}><span><strong>{item.original_name}</strong><small>{item.board_name} · {item.purpose}</small></span><b>{bytes(item.file_size)}</b><time>{item.cleanup_after ? new Date(item.cleanup_after).toLocaleString('ko-KR') : '정리 시각 미정'}</time></li>)}</ul></section>}
        </>
      )}
    </section>
  );
}
