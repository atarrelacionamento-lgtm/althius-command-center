import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
export const isLocalAuthBypassEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_AUTH_BYPASS === 'true';

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

// Detecta se as variáveis estão realmente preenchidas (não apenas placeholders)
export const isSupabaseConfigured =
  isValidHttpUrl(supabaseUrl) &&
  !!supabaseAnonKey &&
  !supabaseAnonKey.startsWith('your-');

if (!isSupabaseConfigured) {
  console.warn(
    '[Pipa Driven] Supabase não configurado.\n' +
    'Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local.\n' +
    (isLocalAuthBypassEnabled
      ? 'Bypass local de autenticação habilitado explicitamente para desenvolvimento.'
      : 'Login e dados reais ficarão indisponíveis até a configuração ser concluída.')
  );
}

// Usa URL válida de fallback para evitar TypeError durante a importação do módulo
const safeUrl = isValidHttpUrl(supabaseUrl)
  ? supabaseUrl
  : 'https://placeholder.supabase.co';
const safeKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key';

export const supabase = createClient(safeUrl, safeKey);
