'use client';

import { createBrowserClient } from '@supabase/ssr';

import { getSupabaseConfig } from './config';

/** Cliente de navegador con cookies compatibles con el servidor. No concede permisos. */
export function createClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createBrowserClient(url, publishableKey);
}
