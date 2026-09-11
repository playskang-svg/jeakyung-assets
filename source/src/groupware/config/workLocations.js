export const WORK_LOCATIONS = Object.freeze({
  headquarters: Object.freeze({
    name: '유한회사 재경로지스 본사',
    address: '광주광역시 광산구 앰코로 35, 245호 (쌍암동, 폭스존)',
  }),
  logistics: Object.freeze({
    name: '유한회사 재경물류',
    address: '경기도 평택시 비전2로 79',
  }),
  yeosu: Object.freeze({
    name: '재경로지스 여수지사',
    address: '전남 여수시 여수산단로 140, 내트럭하우스 105호 (주삼동 1020)',
  }),
});

const KNOWN_ADDRESSES = new Set(Object.values(WORK_LOCATIONS).map((location) => location.address));

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function isKnownWorkLocationAddress(address) {
  return KNOWN_ADDRESSES.has(clean(address));
}

export function resolveBusinessCardAddress(profile = {}) {
  const workLocation = clean(profile.work_location);
  if (/여수/.test(workLocation)) return WORK_LOCATIONS.yeosu.address;
  if (/평택|서울\s*경기|재경물류/.test(workLocation)) return WORK_LOCATIONS.logistics.address;
  if (/광주|본사|재경로지스/.test(workLocation)) return WORK_LOCATIONS.headquarters.address;
  if (workLocation) return workLocation;

  const affiliation = [
    profile.company_name,
    profile.organization_name,
    profile.branch_name,
    profile.department_name,
  ].map(clean).filter(Boolean).join(' ');

  if (/여수/.test(affiliation)) return WORK_LOCATIONS.yeosu.address;
  if (/평택|서울\s*경기|재경물류/.test(affiliation)) return WORK_LOCATIONS.logistics.address;
  if (/광주|본사|재경로지스/.test(affiliation)) return WORK_LOCATIONS.headquarters.address;

  return WORK_LOCATIONS.headquarters.address;
}
