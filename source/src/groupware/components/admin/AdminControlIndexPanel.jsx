import { Link } from 'react-router-dom';

const count = (value) => Number(value) || 0;
const live = (items) => (Array.isArray(items) ? items.filter((item) => item.is_active && !item.archived_at).length : 0);

// 상태 표기는 세 가지만 쓴다.
// ok: 지금 운영 가능한 상태 / attention: 관리자가 손을 대야 하는 상태 / unknown: 조회 실패
const OK = 'ok';
const ATTENTION = 'attention';
const UNKNOWN = 'unknown';

// 코드로는 확인할 수 없지만 빠뜨리면 운영이 막히는 설정. 접어 두되 화면에서 사라지지는 않게 한다.
const EXTERNAL_SETTINGS = [
  ['가입 이메일 인증', 'Supabase 대시보드 → Authentication → Confirm email'],
  ['메일 화면 내장', '메일 서버가 x-frame-options로 iframe을 막고 있어 서버 설정 변경 필요'],
  ['공개 사이트 배포', 'main 브랜치에 push하면 GitHub Pages가 자동 배포'],
];

function membershipItem(usage) {
  if (!usage) return { state: '확인 불가', tone: UNKNOWN };
  const pending = count(usage.members?.pending);
  return pending > 0
    ? { state: `승인 대기 ${pending}명`, tone: ATTENTION }
    : { state: '대기 없음', tone: OK };
}

function employeeItem(usage) {
  if (!usage) return { state: '확인 불가', tone: UNKNOWN };
  const approved = count(usage.members?.approved);
  return approved > 0
    ? { state: `승인 회원 ${approved}명`, tone: OK }
    : { state: '등록된 직원 없음', tone: ATTENTION };
}

function organizationItem(directory) {
  if (!directory) return { state: '확인 불가', tone: UNKNOWN };
  const groups = [
    ['부서', directory.departments],
    ['직급', directory.positions],
    ['직책', directory.jobTitles],
  ].map(([label, items]) => [label, (items ?? []).filter((item) => item.is_active).length]);
  const missing = groups.filter(([, total]) => total === 0).map(([label]) => label);
  return missing.length > 0
    ? { state: `${missing.join('·')} 미등록`, tone: ATTENTION }
    : { state: groups.map(([label, total]) => `${label} ${total}`).join(' · '), tone: OK };
}

function widgetItem(usage) {
  if (!usage) return { state: '확인 불가', tone: UNKNOWN };
  const active = count(usage.dashboards?.active);
  return active > 0
    ? { state: `활성 위젯 ${active}개`, tone: OK }
    : { state: '활성 위젯 없음', tone: ATTENTION };
}

function boardItem(usage) {
  if (!usage) return { state: '확인 불가', tone: UNKNOWN };
  const active = count(usage.content?.boards_active);
  return active > 0
    ? { state: `운영 ${active}개 · 보관 ${count(usage.content?.boards_archived)}개`, tone: OK }
    : { state: '운영 게시판 없음', tone: ATTENTION };
}

function approvalItem(approval) {
  if (!approval) return { state: '확인 불가', tone: UNKNOWN };
  const templates = live(approval.templates);
  return templates > 0
    ? { state: `양식 ${templates}개 · 분류 ${live(approval.categories)}개`, tone: OK }
    : { state: '사용 가능한 양식 없음', tone: ATTENTION };
}

function popupItem(popups) {
  if (!popups) return { state: '확인 불가', tone: UNKNOWN };
  const active = live(popups.documents);
  return { state: active > 0 ? `활성 문서 ${active}개` : '활성 문서 없음', tone: OK };
}

function cleanupItem(usage) {
  if (!usage) return { state: '확인 불가', tone: UNKNOWN };
  const due = count(usage.attachments?.due_cleanup_count);
  const orphan = count(usage.attachments?.orphan_object_count);
  if (due === 0 && orphan === 0) return { state: '정리 대상 없음', tone: OK };
  const parts = [];
  if (due > 0) parts.push(`기한 도래 ${due}개`);
  if (orphan > 0) parts.push(`미등록 객체 ${orphan}개`);
  return { state: parts.join(' · '), tone: ATTENTION };
}

// section이 있으면 같은 화면에서 아래에 펼치고, to가 있으면 전용 화면으로 이동한다.
// 버튼 박스는 링크 페이지 안에서 구성하므로 이 목록에 따로 두지 않는다.
// (기능과 저장된 데이터는 그대로이고, /admin?section=buttonboxes 로는 계속 들어갈 수 있다.)
function buildItems({ directory, usage, approval, popups }) {
  return [
    { key: 'membership', title: '회원 승인', section: 'membership', ...membershipItem(usage) },
    { key: 'employee', title: '직원 프로필·역할', section: 'employee', ...employeeItem(usage) },
    { key: 'organization', title: '조직 기준', section: 'organization', ...organizationItem(directory) },
    { key: 'widgets', title: '대시보드 위젯', section: 'widgets', ...widgetItem(usage) },
    { key: 'usage', title: '사용량·첨부 정리', section: 'usage', ...cleanupItem(usage) },
    { key: 'linkpages', title: '링크 페이지', section: 'linkpages', state: '버튼형 업무 페이지 구성', tone: OK },
    { key: 'sitearticles', title: '소식/정보', section: 'sitearticles', state: '공개 사이트 메인 노출 글', tone: OK },
    { key: 'boards', title: '게시판 구성·권한', to: '/admin/boards', ...boardItem(usage) },
    { key: 'approval', title: '전자결재 분류·양식', to: '/approval/admin', ...approvalItem(approval) },
    { key: 'popups', title: '팝업 문서', to: '/admin/popups', ...popupItem(popups) },
  ];
}

export default function AdminControlIndexPanel({ directory, usage, approval, popups, loading, onReload, activeSection, onSelectSection }) {
  const items = buildItems({ directory, usage, approval, popups });
  const attention = items.filter((item) => item.tone === ATTENTION).length;
  const unknown = items.filter((item) => item.tone === UNKNOWN).length;

  return (
    <section className="gw-admin-section gw-control-index" aria-labelledby="admin-control-index-title">
      <div className="gw-admin-section-heading">
        <div>
          <h2 id="admin-control-index-title">관리 기능 점검</h2>
          <p>관리 기능 전부와 현재 상태입니다. 항목을 누르면 아래에서 바로 설정합니다.</p>
        </div>
        <div className="gw-control-index-summary">
          <span className={`gw-count-badge${attention > 0 ? ' gw-count-badge--attention' : ''}`}>
            {attention > 0 ? `점검 필요 ${attention}` : '점검 필요 없음'}
          </span>
          <button className="gw-secondary-button" type="button" onClick={onReload} disabled={loading}>
            {loading ? '점검 중…' : '다시 점검'}
          </button>
        </div>
      </div>

      <ul className="gw-control-index-list">
        {items.map((item) => (
          <li key={item.key}>
            {item.section ? (
              <button
                type="button"
                className={`gw-control-index-row is-${item.tone}${activeSection === item.section ? ' is-open' : ''}`}
                aria-expanded={activeSection === item.section}
                onClick={() => onSelectSection(activeSection === item.section ? '' : item.section)}
              >
                <span className="gw-state-dot" aria-hidden="true" />
                <strong>{item.title}</strong>
                <span className="gw-control-index-state">{item.state}</span>
              </button>
            ) : (
              <Link className={`gw-control-index-row is-${item.tone}`} to={item.to}>
                <span className="gw-state-dot" aria-hidden="true" />
                <strong>{item.title}</strong>
                <span className="gw-control-index-state">{item.state}</span>
                <span className="gw-control-index-away" aria-label="전용 화면으로 이동">↗</span>
              </Link>
            )}
          </li>
        ))}
      </ul>

      {unknown > 0 && (
        <p className="gw-notice gw-notice--warning" role="status">
          {unknown}개 항목의 상태를 조회하지 못했습니다. 관리자 역할과 Supabase 연결을 확인한 뒤 다시 점검해 주세요.
        </p>
      )}

      <details className="gw-control-index-external">
        <summary>코드 밖에서 관리하는 설정 {EXTERNAL_SETTINGS.length}건</summary>
        <dl>
          {EXTERNAL_SETTINGS.map(([title, where]) => (
            <div key={title}><dt>{title}</dt><dd>{where}</dd></div>
          ))}
        </dl>
      </details>
    </section>
  );
}
