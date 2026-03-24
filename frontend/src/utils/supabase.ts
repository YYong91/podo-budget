/**
 * Supabase 클라이언트 초기화
 *
 * 앱 전체에서 단일 인스턴스를 공유한다.
 * 환경변수: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY가 설정되지 않았습니다')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
