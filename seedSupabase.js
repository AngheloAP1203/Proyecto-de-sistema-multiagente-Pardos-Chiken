import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { resolve } from 'path'

// Cargar .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Faltan variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 1. Usuarios a poblar
const DEMO_LOGINS = [
  { email: 'admin@pardos.com',   password: 'admin123',   role: 'admin', name: 'Carlos Mendes' },
  { email: 'cajero@pardos.com',  password: 'cajero123',  role: 'cajero', name: 'Lucia Torres' },
  { email: 'mozo@pardos.com',    password: 'mozo123',    role: 'mozo', name: 'Diego Quispe' },
  { email: 'hostess@pardos.com', password: 'hostess123', role: 'hostess', name: 'Gabriela Vega' },
  { email: 'cocina@pardos.com',  password: 'cocina123',  role: 'jefe_cocina', name: 'Marco Ramos' },
]

async function seed() {
  console.log('🌱 Iniciando seeding de Supabase...')

  // 1. Crear usuarios
  for (const u of DEMO_LOGINS) {
    console.log(`Registrando: ${u.email}...`)
    const { data, error } = await supabase.auth.signUp({
      email: u.email,
      password: u.password,
    })
    
    if (error) {
      if (error.message.includes('already registered')) {
        console.log(`⚠️ ${u.email} ya estaba registrado.`)
      } else {
        console.error(`❌ Error al registrar ${u.email}:`, error.message)
      }
    } else if (data.user) {
      // Insertar en profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          name: u.name,
          email: u.email,
          role: u.role
        })
      if (profileError) {
        console.error(`❌ Error al crear perfil de ${u.email}:`, profileError.message)
      } else {
        console.log(`✅ Creado: ${u.email}`)
      }
    }
  }

  console.log('✅ Seeding completado.')
}

seed()
