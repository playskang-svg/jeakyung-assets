export const PERMISSION_GROUPS = Object.freeze({
  read: Object.freeze(['sidebar_view', 'list_read', 'detail_read', 'attachment_view', 'attachment_download']),
  write: Object.freeze(['post_create', 'own_post_update', 'own_post_delete', 'attachment_upload']),
  comment: Object.freeze(['comment_create', 'own_comment_update', 'own_comment_delete']),
});

export const MANAGED_BOARD_ACTIONS = new Set(Object.values(PERMISSION_GROUPS).flat());

const defaultIdFactory = () => globalThis.crypto.randomUUID();

export function createPermissionRow(idFactory = defaultIdFactory) {
  return {
    id: idFactory(),
    target_type: 'all',
    target_id: '',
    effect: 'allow',
    read: true,
    write: true,
    comment: true,
  };
}

export function updatePermissionRowValue(row, patch) {
  const next = { ...row, ...patch };
  if (next.effect === 'allow' && (patch.write || patch.comment) && !next.read) next.read = true;
  if (next.effect === 'allow' && patch.read === false) {
    next.write = false;
    next.comment = false;
  }
  if (patch.target_type === 'all') next.target_id = '';
  return next;
}

export function splitPermissionRules(sourceRules, idFactory = defaultIdFactory) {
  const grouped = new Map();
  sourceRules.forEach((rule, index) => {
    const key = `${rule.target_type}:${rule.target_id ?? ''}:${rule.effect}`;
    const entry = grouped.get(key) ?? { rules: [], actions: new Set() };
    entry.rules.push({ ...rule, _sourceKey: rule.id ?? `source-${index}` });
    entry.actions.add(rule.action);
    grouped.set(key, entry);
  });

  const permissionRows = [];
  const consumedKeys = new Set();
  grouped.forEach(({ rules, actions }) => {
    const row = {
      id: idFactory(),
      target_type: rules[0].target_type,
      target_id: rules[0].target_id ?? '',
      effect: rules[0].effect,
      read: PERMISSION_GROUPS.read.every((action) => actions.has(action)),
      write: PERMISSION_GROUPS.write.every((action) => actions.has(action)),
      comment: PERMISSION_GROUPS.comment.every((action) => actions.has(action)),
    };
    if (!row.read && !row.write && !row.comment) return;
    permissionRows.push(row);
    Object.entries(PERMISSION_GROUPS).forEach(([group, actionsInGroup]) => {
      if (!row[group]) return;
      rules.filter((rule) => actionsInGroup.includes(rule.action)).forEach((rule) => consumedKeys.add(rule._sourceKey));
    });
  });

  return {
    permissionRows,
    advancedRules: sourceRules
      .filter((rule, index) => !consumedKeys.has(rule.id ?? `source-${index}`))
      .map(({ action, target_type, target_id, effect }) => ({ action, target_type, target_id: target_id ?? '', effect })),
  };
}

export function expandPermissionRows(rows) {
  const uniqueRules = new Map();
  rows.forEach((row) => {
    Object.entries(PERMISSION_GROUPS).forEach(([group, actions]) => {
      if (!row[group]) return;
      actions.forEach((action) => {
        const targetId = row.target_type === 'all' ? '' : row.target_id;
        const rule = { action, target_type: row.target_type, target_id: targetId, effect: row.effect };
        uniqueRules.set(`${action}:${row.target_type}:${targetId}:${row.effect}`, rule);
      });
    });
  });
  return [...uniqueRules.values()];
}

export function combineBoardRules(permissionRows, advancedRules) {
  const uniqueRules = new Map();
  [...expandPermissionRows(permissionRows), ...advancedRules].forEach((rule) => {
    const targetId = ['all', 'board_manager', 'author'].includes(rule.target_type) ? '' : (rule.target_id ?? '');
    const normalized = { action: rule.action, target_type: rule.target_type, target_id: targetId, effect: rule.effect };
    uniqueRules.set(`${normalized.action}:${normalized.target_type}:${normalized.target_id}:${normalized.effect}`, normalized);
  });
  return [...uniqueRules.values()];
}

export function validatePermissionRows(rows) {
  if (rows.some((row) => row.target_type !== 'all' && !row.target_id)) {
    return '권한 행의 역할·부서·직급·직책 또는 사용자를 선택해 주세요.';
  }
  if (!rows.some((row) => row.effect === 'allow' && row.read)) {
    return '사용자에게 게시판을 표시하려면 최소 한 개의 읽기 허용 권한이 필요합니다.';
  }
  return '';
}
