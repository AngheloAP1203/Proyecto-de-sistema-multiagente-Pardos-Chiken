/**
 * src/data/seeds/usersSeed.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Usuarios del sistema.
 *
 * ENDURECIMIENTO (F-03): el almacén canónico NO guarda contraseñas en texto
 * plano. Cada usuario guarda `passwordHash` = SHA-256(`${id}:${PEPPER}:${pw}`).
 * La sal por-usuario (el id) + pepper derrotan las rainbow tables genéricas, así
 * que inspeccionar el bundle ya no revela las credenciales directamente.
 *
 * LÍMITE HONESTO: esto sigue siendo autenticación del lado del cliente (no hay
 * backend). Es un endurecimiento de demo, no seguridad de producción — para eso
 * se necesita un servidor con hashing lento (bcrypt/argon2) y sesión firmada.
 * Ver F-05 en la auditoría.
 *
 * DEMO_LOGINS: credenciales de conveniencia para los botones de "acceso rápido"
 * de la pantalla de login (pensados para la evaluación). Son públicos a propósito
 * y están separados del almacén de usuarios para dejar claro qué es material de
 * autenticación (hasheado) y qué es una comodidad de demo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const MOCK_USERS = [
  {
    id: 'u001',
    name: 'Carlos Mendes',
    email: 'admin@pardos.com',
    passwordHash: 'fab890bcd2bec3e10fe41be08c29e8061edcfca83d25ff891ae339dbe3740cc2',
    role: 'admin',
    avatar: 'CM',
    sucursal: 'Miraflores',
  },
  {
    id: 'u002',
    name: 'Lucia Torres',
    email: 'cajero@pardos.com',
    passwordHash: 'c3b46a4760b53c36fac8d67722b8ed0eaa8ec84618c6a0a19b9c5a18086de6e0',
    role: 'cajero',
    avatar: 'LT',
    sucursal: 'Miraflores',
  },
  {
    id: 'u003',
    name: 'Diego Quispe',
    email: 'mozo@pardos.com',
    passwordHash: 'bbdaad27c785d8090344c3cd115e18160d33a270ae473f14f678bd67df247b2c',
    role: 'mozo',
    avatar: 'DQ',
    sucursal: 'Miraflores',
  },
  {
    id: 'u004',
    name: 'Gabriela Vega',
    email: 'hostess@pardos.com',
    passwordHash: 'ffa03b8d2d571bfd29d59f724bf1566a127fea0eee0a52ca6dceb7b452bb4495',
    role: 'hostess',
    avatar: 'GV',
    sucursal: 'Miraflores',
  },
  {
    id: 'u005',
    name: 'Marco Ramos',
    email: 'cocina@pardos.com',
    passwordHash: '49b08626fd622bcdabb083f74f4b398271ac8b602bb7a85adeb2e02b66487b35',
    role: 'jefe_cocina',
    avatar: 'MR',
    sucursal: 'Miraflores',
  },
]

/** Pepper de la app: entra en el hash junto con la sal por-usuario (el id). */
export const PASSWORD_PEPPER = 'pardos-v2'

/** Credenciales de demo para el acceso rápido de la pantalla de login (públicas a propósito). */
export const DEMO_LOGINS = [
  { email: 'admin@pardos.com',   password: 'admin123',   role: 'admin' },
  { email: 'cajero@pardos.com',  password: 'cajero123',  role: 'cajero' },
  { email: 'mozo@pardos.com',    password: 'mozo123',    role: 'mozo' },
  { email: 'hostess@pardos.com', password: 'hostess123', role: 'hostess' },
  { email: 'cocina@pardos.com',  password: 'cocina123',  role: 'jefe_cocina' },
]
