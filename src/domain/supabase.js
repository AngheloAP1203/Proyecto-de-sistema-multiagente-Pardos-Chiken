import { createClient } from '@supabase/supabase-js'

const getEnv = (key) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key]
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env[key]
    }
  } catch (e) { /* ignore */ }
  return null
}

const supabaseUrl = getEnv('VITE_SUPABASE_URL') || 'https://mock.supabase.co'
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || 'mock-key'

if (!getEnv('VITE_SUPABASE_URL') || !getEnv('VITE_SUPABASE_ANON_KEY')) {
  console.warn('Faltan credenciales de Supabase en el entorno')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
