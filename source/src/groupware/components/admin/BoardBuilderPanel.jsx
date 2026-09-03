import { useEffect, useMemo, useState } from 'react';

import { BOARD_TYPES, getBoardType } from '../../config/boardTypes.js';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  deleteOrArchiveBoard,
  getBoardAdminCatalog,
  notifyBoardCatalogChanged,
  previewBoardPermissions,
  saveBoardDefinition,
  saveBoardGroup,
} from '../../services/boardService.js';
import {
  combineBoardRules,
  createPermissionRow,
  MANAGED_BOARD_ACTIONS,
  splitPermissionRules,
  updatePermissionRowValue,
  validatePermissionRows,
} from '../../utils/boardPermissions.js';

const ACTIONS = ['sidebar_view','list_read','detail_read','post_create','own_post_update','own_post_delete','other_post_update','other_post_delete','comment_create','own_comment_update','own_comment_delete','other_comment_update','other_comment_delete','attachment_view','attachment_download','attachment_upload','notice_manage','pin_manage','category_manage','permission_manage','board_setting_manage','archive_manage','board_delete'];
const MANAGEMENT_ACTIONS = new Set(['permission_manage','board_setting_manage','archive_manage','board_delete']);
const TARGET_TYPES = [
  ['all', '전체 사용자'],
  ['role', '역할'],
  ['department', '부서'],
  ['position', '직급'],
  ['job_title', '직책'],
  ['user', '특정 사용자'],
];
const SETTINGS = { show_in_sidebar: true, allow_comments: true, allow_replies: true, allow_attachments: true, allow_images: true, allow_anonymous: false, allow_notices: true, allow_important: true, show_views: true, show_author_department: true, show_author_position: false, show_author_job_title: true, allow_reactions: true, show_post_number: true, search_enabled: true, use_prefix: false, use_pinned: true, department_only: false, page_size: 20, default_sort: 'latest', max_file_size_mb: 20, max_inline_image_size_mb: 10, max_inline_images: 20, max_total_attachment_mb: 50, preserve_image_originals: false };
// 게시판마다 실제로 갈리는 것만 남긴다. 나머지(대댓글·공지글·중요글·검색·
// 조회 수·말머리·상단 고정·작성자 표시)는 게시판을 만들 때 정한 기본값 그대로
// 두면 되는 것들이라, 스무 개를 늘어놓으면 정작 바꿀 것을 찾기 어려워진다.
// 화면에서 뺀다고 값이 사라지지는 않는다 — 저장된 settings 는 그대로다.
const BOARD_FEATURES = [
  ['allow_comments', '댓글'],
  ['allow_attachments', '파일 첨부'],
  ['allow_images', '본문 이미지'],
  ['allow_anonymous', '익명 작성'],
];

const EMPTY_GROUP = { id: '', name: '', code: '', description: '', sort_order: 100, is_active: true, archived: false };
const EMPTY_RULE = { action: 'other_post_update', target_type: 'board_manager', target_id: '', effect: 'allow' };

const createEmptyForm = () => ({ name: '', slug: '', description: '', board_type: 'free', group_id: '', sort_order: 100, is_active: true, archived: false, settings: { ...SETTINGS, ...BOARD_TYPES.free.settings } });
const createCategory = (index) => ({ _key: crypto.randomUUID(), id: null, name: '', code: `category-${index + 1}`, sort_order: index * 10, is_active: true });
export default function BoardBuilderPanel({ directory }) {
  const auth = useAuth();
  const [catalog, setCatalog] = useState({ groups: [], boards: [], categories: [], rules: [], managers: [], users: [] });
  const [form, setForm] = useState(createEmptyForm);
  const [categories, setCategories] = useState([]);
  const [permissionRows, setPermissionRows] = useState([createPermissionRow()]);
  const [advancedRules, setAdvancedRules] = useState([]);
  const [advancedRule, setAdvancedRule] = useState(EMPTY_RULE);
  const [managers, setManagers] = useState([]);
  const [group, setGroup] = useState(EMPTY_GROUP);
  const [previewUser, setPreviewUser] = useState('');
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState('');
  // '안전 삭제'는 글이 있는 게시판을 지우지 않고 보관한다. 그 게시판이 목록에
  // 계속 남아 있으면 지운 것처럼 보이지 않는다. 평소에는 감추되, 되살릴 수
  // 있어야 하므로 보관함을 여는 길은 남긴다.
  const [showArchived, setShowArchived] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => getBoardAdminCatalog().then(setCatalog).catch(() => setStatus('게시판 관리 데이터를 불러오지 못했습니다.'));
  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm(createEmptyForm());
    setCategories([]);
    setPermissionRows([createPermissionRow()]);
    setAdvancedRules([]);
    setAdvancedRule(EMPTY_RULE);
    setManagers([]);
    setPreview(null);
    setPreviewUser('');
  };

  const targetOptions = (targetType) => {
    if (targetType === 'role') return directory.roles.map((item) => ({ id: item.code, name: item.name }));
    if (targetType === 'department') return directory.departments;
    if (targetType === 'position') return directory.positions;
    if (targetType === 'job_title') return directory.jobTitles;
    if (targetType === 'user') return catalog.users;
    return [];
  };

  const selectedType = getBoardType(form.board_type);
  const permissionSummary = useMemo(() => ({
    read: permissionRows.filter((row) => row.effect === 'allow' && row.read).length,
    write: permissionRows.filter((row) => row.effect === 'allow' && row.write).length,
    comment: permissionRows.filter((row) => row.effect === 'allow' && row.comment).length,
  }), [permissionRows]);

  const archivedCount = catalog.boards.filter((board) => board.archived_at).length;
  const shownBoards = showArchived ? catalog.boards : catalog.boards.filter((board) => !board.archived_at);

  const selectBoard = (board) => {
    const split = splitPermissionRules(catalog.rules.filter((item) => item.board_id === board.id));
    setForm({ ...board, archived: Boolean(board.archived_at), settings: { ...SETTINGS, ...(board.settings ?? {}) } });
    setCategories(catalog.categories.filter((item) => item.board_id === board.id).map((item) => ({ ...item, _key: item.id })));
    setPermissionRows(split.permissionRows);
    setAdvancedRules(split.advancedRules);
    setManagers(catalog.managers.filter((item) => item.board_id === board.id).map((item) => item.user_id));
    setPreview(null);
    setStatus('');
  };

  const selectType = (type) => {
    setForm((current) => ({
      ...current,
      board_type: type,
      settings: { ...current.settings, ...BOARD_TYPES[type].settings },
    }));
  };

  const updatePermissionRow = (rowId, patch) => {
    setPermissionRows((current) => current.map((row) => row.id === rowId ? updatePermissionRowValue(row, patch) : row));
  };

  const addAdvancedRule = () => {
    const noTarget = ['all','board_manager','author'].includes(advancedRule.target_type);
    if (!noTarget && !advancedRule.target_id) { setStatus('고급 권한 대상을 선택해 주세요.'); return; }
    setAdvancedRules((current) => [...current, { ...advancedRule, target_id: noTarget ? '' : advancedRule.target_id }]);
    setAdvancedRule(EMPTY_RULE);
  };

  const submit = async (event) => {
    event.preventDefault();
    const permissionError = validatePermissionRows(permissionRows);
    if (permissionError) { setStatus(permissionError); return; }
    const rules = combineBoardRules(permissionRows, advancedRules);
    const risky = rules.some((item) => item.effect === 'allow' && item.target_type === 'all' && MANAGEMENT_ACTIONS.has(item.action));
    const message = risky ? '전체 사용자에게 관리 권한이 포함됩니다. 정말 저장하시겠습니까?' : `${selectedType.label} 설정과 사용자 권한을 저장하시겠습니까?`;
    if (!window.confirm(message)) return;
    const categoryList = categories.filter((item) => item.name.trim() && item.code.trim()).map((item, index) => ({ id: item.id || null, name: item.name.trim(), code: item.code.trim().toLowerCase(), sort_order: index * 10, is_active: item.is_active !== false }));
    setSaving(true);
    setStatus('');
    try {
      await saveBoardDefinition(form, rules, categoryList, managers);
      setStatus('게시판을 저장했습니다. 읽기 권한이 있는 사용자 메뉴에 바로 표시됩니다.');
      notifyBoardCatalogChanged();
      resetForm();
      await load();
    } catch (error) {
      setStatus(`게시판을 저장하지 못했습니다. ${error?.message ?? '입력값과 관리자 권한을 확인해 주세요.'}`);
    } finally {
      setSaving(false);
    }
  };

  const saveGroup = async (event) => {
    event.preventDefault();
    try { await saveBoardGroup(group); setGroup(EMPTY_GROUP); setStatus('게시판 그룹을 저장했습니다.'); await load(); }
    catch { setStatus('그룹을 저장하지 못했습니다. 코드 중복과 시스템 관리자 권한을 확인해 주세요.'); }
  };

  const updateSetting = (key, value) => setForm((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  const previewLabels = preview ? {
    read: preview.sidebar_view && preview.list_read && preview.detail_read,
    write: preview.post_create,
    comment: preview.comment_create,
  } : null;

  return <section className="gw-admin-section" aria-labelledby="board-builder-title">
    <div className="gw-admin-section-heading"><div><span className="gw-eyebrow">BOARD BUILDER</span><h2 id="board-builder-title">게시판 만들기·권한 관리</h2><p>종류를 선택하고 게시판별 읽기·쓰기·댓글 권한을 역할, 부서 또는 사용자에게 부여합니다.</p></div><div className="gw-admin-actions gw-builder-heading-actions"><span className="gw-count-badge">{catalog.boards.length}개</span><button className="gw-secondary-button" type="button" onClick={resetForm}>새 게시판</button></div></div>
    <div className="gw-builder-layout"><aside className="gw-builder-sidebar"><div className="gw-builder-sidebar-heading"><strong>게시판 목록</strong><span>수정할 게시판을 선택하세요.</span></div><div className="gw-compact-list" aria-label="게시판 목록">{shownBoards.map((board) => <button type="button" className={form.id === board.id ? 'is-selected' : ''} key={board.id} onClick={() => selectBoard(board)}><strong>{board.name}</strong><span>{getBoardType(board.board_type).label} · /{board.slug}{board.archived_at ? ' · 보관' : ''}</span></button>)}{shownBoards.length === 0 && <p>{showArchived ? '등록된 게시판이 없습니다.' : '운영 중인 게시판이 없습니다.'}</p>}{archivedCount > 0 && <button type="button" className="gw-archived-toggle" onClick={() => setShowArchived((current) => !current)}>{showArchived ? '보관함 숨기기' : `보관함 보기 (${archivedCount}개)`}</button>}</div></aside>
      <form className="gw-builder-form" onSubmit={submit}>
        <fieldset className="gw-builder-fieldset"><legend>1. 게시판 종류</legend><div className="gw-board-type-grid">{Object.entries(BOARD_TYPES).map(([type, config]) => <button type="button" key={type} className={form.board_type === type ? 'is-selected' : ''} aria-pressed={form.board_type === type} onClick={() => selectType(type)}><span className="gw-board-type-copy"><strong>{config.label}</strong><small>{config.description}</small></span></button>)}</div>{!BOARD_TYPES[form.board_type] && <p>현재 게시판은 기존 유형인 <strong>{selectedType.label}</strong>입니다. 위 유형을 선택하면 새 방식으로 전환됩니다.</p>}</fieldset>

        <fieldset className="gw-builder-fieldset"><legend>2. 기본 정보</legend><div className="gw-admin-form-grid">
          <label className="gw-field"><span>게시판명</span><input required maxLength="120" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="gw-field"><span>주소(slug)</span><input required pattern="[a-z0-9][a-z0-9-]{1,79}" placeholder="team-board" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase() })} /></label>
          <label className="gw-field"><span>그룹</span><select required value={form.group_id ?? ''} onChange={(event) => setForm({ ...form, group_id: event.target.value })}><option value="">선택</option>{catalog.groups.filter((item) => !item.archived_at).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="gw-field"><span>정렬 순서</span><input type="number" value={form.sort_order ?? 0} onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })} /></label>
          <label className="gw-field gw-field--full"><span>설명</span><textarea maxLength="500" value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        </div><div className="gw-category-editor"><div className="gw-category-editor-heading"><div><strong>상단 카테고리 탭</strong><span>사용자 게시판 상단에 아래 순서대로 클릭 가능한 이름이 표시됩니다.</span></div><button className="gw-secondary-button gw-compact-action-button" type="button" onClick={() => setCategories((current) => [...current, createCategory(current.length)])}>카테고리 추가</button></div>{categories.length > 0 ? <div className="gw-category-list">{categories.map((category, index) => <div key={category._key ?? category.id}><span className="gw-category-order" aria-hidden="true">{index + 1}</span><input required aria-label={`카테고리 ${index + 1} 이름`} placeholder="표시 이름" value={category.name} onChange={(event) => setCategories((current) => current.map((item) => item === category ? { ...item, name: event.target.value } : item))} /><input required pattern="[a-z0-9][a-z0-9_-]{1,59}" aria-label={`카테고리 ${index + 1} 코드`} placeholder="category-code" value={category.code} onChange={(event) => setCategories((current) => current.map((item) => item === category ? { ...item, code: event.target.value.toLowerCase() } : item))} /><label><input type="checkbox" checked={category.is_active !== false} onChange={(event) => setCategories((current) => current.map((item) => item === category ? { ...item, is_active: event.target.checked } : item))} /> 사용</label><button className="gw-icon-danger-button" type="button" onClick={() => setCategories((current) => current.filter((item) => item !== category))}>{category.id ? '비활성화' : '삭제'}</button></div>)}</div> : <p className="gw-category-empty">카테고리를 추가하지 않으면 게시판에는 전체 글만 표시됩니다.</p>}</div></fieldset>

        <fieldset className="gw-builder-fieldset"><legend>3. 사용자 권한</legend><p>허용 권한이 있는 게시판만 해당 사용자의 게시판 메뉴와 목록에 나타납니다. 거부가 허용보다 우선합니다.</p><div className="gw-permission-summary"><span>읽기 대상 {permissionSummary.read}</span><span>쓰기 대상 {permissionSummary.write}</span><span>댓글 대상 {permissionSummary.comment}</span></div><div className="gw-permission-matrix">
          {permissionRows.map((row) => { const options = targetOptions(row.target_type); return <div className="gw-permission-row" key={row.id}>
            <select aria-label="권한 효과" value={row.effect} onChange={(event) => updatePermissionRow(row.id, { effect: event.target.value })}><option value="allow">허용</option><option value="deny">거부</option></select>
            <select aria-label="권한 대상 종류" value={row.target_type} onChange={(event) => updatePermissionRow(row.id, { target_type: event.target.value, target_id: '' })}>{TARGET_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
            {row.target_type === 'all' ? <span className="gw-permission-all">승인된 전체 사용자</span> : <select required aria-label="권한 대상" value={row.target_id} onChange={(event) => updatePermissionRow(row.id, { target_id: event.target.value })}><option value="">대상 선택</option>{options.map((item) => <option value={item.id} key={item.id}>{item.name}{item.email ? ` · ${item.email}` : ''}</option>)}</select>}
            <label><input type="checkbox" checked={row.read} onChange={(event) => updatePermissionRow(row.id, { read: event.target.checked })} /> 읽기</label>
            <label><input type="checkbox" checked={row.write} onChange={(event) => updatePermissionRow(row.id, { write: event.target.checked })} /> 쓰기</label>
            <label><input type="checkbox" checked={row.comment} onChange={(event) => updatePermissionRow(row.id, { comment: event.target.checked })} /> 댓글</label>
            <button type="button" className="gw-icon-danger-button" onClick={() => setPermissionRows((current) => current.filter((item) => item.id !== row.id))} aria-label="권한 행 삭제">삭제</button>
          </div>; })}
        </div><button type="button" className="gw-secondary-button" onClick={() => setPermissionRows((current) => [...current, createPermissionRow()])}>권한 대상 추가</button></fieldset>

        <fieldset className="gw-builder-fieldset"><legend>4. 게시판 기능</legend><div className="gw-check-grid">{BOARD_FEATURES.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(form.settings[key])} onChange={(event) => updateSetting(key, event.target.checked)} /> {label}</label>)}<label><input type="checkbox" checked={form.settings.show_in_sidebar === false} onChange={(event) => updateSetting('show_in_sidebar', !event.target.checked)} /> 대시보드 숨김</label><label><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> 활성</label><label><input type="checkbox" checked={form.archived} onChange={(event) => setForm({ ...form, archived: event.target.checked })} /> 보관</label></div><p className="gw-field-hint">대시보드 숨김은 홈·게시판 목록에서만 감춥니다. 업무 페이지의 탭으로 부르거나 주소로 바로 들어가는 것은 그대로 됩니다.</p><div className="gw-admin-form-grid gw-settings-grid"><label className="gw-field"><span>기본 정렬</span><select value={form.settings.default_sort ?? 'latest'} disabled={form.board_type === 'discussion'} onChange={(event) => updateSetting('default_sort', event.target.value)}><option value="latest">최신 글</option><option value="oldest">오래된 글</option><option value="popular">인기 글</option><option value="activity">최근 댓글 활동</option></select></label><label className="gw-field"><span>페이지당 글 수</span><input type="number" min="5" max="100" value={form.settings.page_size} onChange={(event) => updateSetting('page_size', Number(event.target.value))} /></label><label className="gw-field"><span>파일 1개 제한(MB)</span><input type="number" min="1" max="20" value={form.settings.max_file_size_mb} onChange={(event) => updateSetting('max_file_size_mb', Number(event.target.value))} /></label><label className="gw-field"><span>이미지 장수 제한</span><input type="number" min="1" max="20" value={form.settings.max_inline_images} onChange={(event) => updateSetting('max_inline_images', Number(event.target.value))} /></label><label className="gw-field"><span>전체 첨부 제한(MB)</span><input type="number" min="1" max="50" value={form.settings.max_total_attachment_mb} onChange={(event) => updateSetting('max_total_attachment_mb', Number(event.target.value))} /></label></div></fieldset>


        <fieldset className="gw-builder-fieldset"><legend>게시판 관리자</legend><div className="gw-manager-grid">{catalog.users.map((user) => <label key={user.id}><input type="checkbox" checked={managers.includes(user.id)} onChange={(event) => setManagers((current) => event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id))} /> {user.name} <small>{user.email}</small></label>)}</div></fieldset>

        <details className="gw-advanced-permissions"><summary>고급 권한 설정</summary><p>타인 글 관리, 공지·고정, 설정 변경 같은 세부 권한입니다.</p><div className="gw-rule-editor"><select aria-label="고급 권한 action" value={advancedRule.action} onChange={(event) => setAdvancedRule({ ...advancedRule, action: event.target.value })}>{ACTIONS.filter((action) => !MANAGED_BOARD_ACTIONS.has(action)).map((action) => <option key={action}>{action}</option>)}</select><select aria-label="고급 권한 대상 종류" value={advancedRule.target_type} onChange={(event) => setAdvancedRule({ ...advancedRule, target_type: event.target.value, target_id: '' })}>{[...TARGET_TYPES, ['board_manager','게시판 관리자'], ['author','작성자']].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>{!['all','board_manager','author'].includes(advancedRule.target_type) && <select aria-label="고급 권한 대상" value={advancedRule.target_id} onChange={(event) => setAdvancedRule({ ...advancedRule, target_id: event.target.value })}><option value="">대상 선택</option>{targetOptions(advancedRule.target_type).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}<select aria-label="고급 권한 효과" value={advancedRule.effect} onChange={(event) => setAdvancedRule({ ...advancedRule, effect: event.target.value })}><option value="allow">허용</option><option value="deny">거부</option></select><button type="button" className="gw-secondary-button" onClick={addAdvancedRule}>세부 권한 추가</button></div><div className="gw-rule-list">{advancedRules.map((item, index) => <div key={`${item.action}-${item.target_type}-${item.target_id}-${index}`}><code>{item.action}</code><span>{item.effect} · {item.target_type}{item.target_id ? `:${item.target_id}` : ''}</span><button type="button" onClick={() => setAdvancedRules((current) => current.filter((_, itemIndex) => itemIndex !== index))}>삭제</button></div>)}</div></details>

        <div className="gw-admin-actions gw-builder-save-actions"><button className="gw-primary-button" type="submit" disabled={saving}>{saving ? '저장 중…' : form.id ? '게시판 변경 저장' : '게시판 생성'}</button>{form.id && <button className="gw-secondary-button" type="button" onClick={() => setForm({ ...form, id: undefined, name: `${form.name} 복사본`, slug: `${form.slug}-copy` })}>복제</button>}{form.id && <button className="gw-secondary-button gw-secondary-button--danger" type="button" onClick={async () => { if (!window.confirm('사용 기록이 있으면 삭제 대신 보관됩니다. 계속하시겠습니까?')) return; const result = await deleteOrArchiveBoard(form.id); setStatus(result === 'archived' ? '사용 기록이 있어 보관 처리했습니다.' : '사용 기록이 없어 삭제했습니다.'); notifyBoardCatalogChanged(); resetForm(); await load(); }}>안전 삭제</button>}</div>
      </form></div>

    {auth.activeRole === 'super_admin' && <form className="gw-inline-admin-form" onSubmit={saveGroup}><h3>게시판 그룹</h3><select aria-label="수정할 게시판 그룹" value={group.id} onChange={(event) => { const selected = catalog.groups.find((item) => item.id === event.target.value); setGroup(selected ? { ...selected, archived: Boolean(selected.archived_at) } : EMPTY_GROUP); }}><option value="">새 그룹</option>{catalog.groups.map((item) => <option value={item.id} key={item.id}>{item.name}{item.archived_at ? ' · 보관' : ''}</option>)}</select><input required placeholder="그룹명" value={group.name} onChange={(event) => setGroup({ ...group, name: event.target.value })} /><input required pattern="[a-z0-9][a-z0-9_-]{1,59}" placeholder="group-code" value={group.code} onChange={(event) => setGroup({ ...group, code: event.target.value.toLowerCase() })} /><input placeholder="그룹 설명" value={group.description ?? ''} onChange={(event) => setGroup({ ...group, description: event.target.value })} /><label><input type="checkbox" checked={group.is_active !== false} onChange={(event) => setGroup({ ...group, is_active: event.target.checked })} /> 활성</label>{group.id && <label><input type="checkbox" checked={group.archived} onChange={(event) => setGroup({ ...group, archived: event.target.checked })} /> 보관</label>}<button className="gw-secondary-button" type="submit">그룹 저장</button></form>}
    {form.id && <div className="gw-permission-preview"><h3>사용자별 권한 확인</h3><select value={previewUser} onChange={(event) => setPreviewUser(event.target.value)}><option value="">사용자 선택</option>{catalog.users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select><button className="gw-secondary-button" type="button" disabled={!previewUser} onClick={async () => setPreview(await previewBoardPermissions(form.id, previewUser))}>확인</button>{previewLabels && <div><span className={previewLabels.read ? 'is-allowed' : 'is-denied'}>읽기 {previewLabels.read ? '허용' : '차단'}</span><span className={previewLabels.write ? 'is-allowed' : 'is-denied'}>쓰기 {previewLabels.write ? '허용' : '차단'}</span><span className={previewLabels.comment ? 'is-allowed' : 'is-denied'}>댓글 {previewLabels.comment ? '허용' : '차단'}</span></div>}</div>}
    {status && <p className="gw-form-status" role="status">{status}</p>}
  </section>;
}
