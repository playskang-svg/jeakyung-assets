import { SUPABASE_CONFIGURATION_MESSAGE } from '../lib/supabase.js';

export default function SupabaseConfigurationNotice() {
  return (
    <div className="gw-notice gw-notice--warning" role="status">
      <strong>{SUPABASE_CONFIGURATION_MESSAGE}</strong>
      <span> 관리자에게 그룹웨어 Preview 환경 변수 설정을 요청해 주세요.</span>
    </div>
  );
}
