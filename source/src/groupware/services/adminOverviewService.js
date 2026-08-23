import { approvalService } from './approvalService.js';
import { getAdminSystemUsage } from './adminUsageService.js';
import { getOrganizationDirectory } from './organizationService.js';
import { loadPopupAdminCatalog } from './popupService.js';

export const EMPTY_DIRECTORY = { departments: [], positions: [], jobTitles: [], roles: [] };

// 점검 항목 하나가 실패해도 나머지 상태는 그대로 보여준다. 첨부 오류가 글 전체를
// 가렸던 문제와 같은 유형이라 개별 결과를 분리해서 담는다.
async function settle(load) {
  try {
    return { ok: true, data: await load() };
  } catch {
    return { ok: false, data: null };
  }
}

export async function getAdminOverview() {
  const [directory, usage, approval, popups] = await Promise.all([
    settle(getOrganizationDirectory),
    settle(getAdminSystemUsage),
    settle(() => approvalService.getAdminCatalog()),
    settle(loadPopupAdminCatalog),
  ]);

  return { directory, usage, approval, popups };
}
