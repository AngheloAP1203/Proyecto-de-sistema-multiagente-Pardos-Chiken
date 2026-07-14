import { createClient } from '@supabase/supabase-js'

// Vite reemplaza de forma estática `import.meta.env.VARIABLE`, por lo que NO se puede usar acceso dinámico `[key]`.
// Para soportar tanto Vite (App) como Node (Tests), leemos de ambas fuentes explícitamente.
const getEnvSupabaseUrl = () => {
  if (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL
  try { return import.meta.env.VITE_SUPABASE_URL } catch (e) { return null }
}

const getEnvSupabaseKey = () => {
  if (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_ANON_KEY) return process.env.VITE_SUPABASE_ANON_KEY
  try { return import.meta.env.VITE_SUPABASE_ANON_KEY } catch (e) { return null }
}

const supabaseUrl = getEnvSupabaseUrl() || 'https://mock.supabase.co'
const supabaseAnonKey = getEnvSupabaseKey() || 'mock-key'

if (!getEnvSupabaseUrl() || !getEnvSupabaseKey()) {
  console.warn('Faltan credenciales de Supabase en el entorno')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
