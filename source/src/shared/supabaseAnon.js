import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

// 공개 사이트는 로그인 없이 읽기만 한다. 세션을 저장하거나 URL에서 토큰을 찾지
// 않도록 해서 그룹웨어 세션과 서로 간섭하지 않게 분리한다.
export const publicSupabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })
  : null;
