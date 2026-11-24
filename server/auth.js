const jwt = require('jsonwebtoken');
const db = require('./db');
const { TODOS, leerPermisos } = require('./permisos');
const SECRET = process.env.JWT_SECRET || 'cambia-esta-frase';
// En producción (HTTPS) la cookie solo viaja cifrada
const SEGURA = process.env.NODE_ENV === 'production';

// Guarda la sesión en una cookie httpOnly (no accesible desde JavaScript del navegador)
function iniciarSesion(res, datos) {
  const token = jwt.sign(datos, SECRET, { expiresIn: '8h' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: SEGURA, maxAge: 8 * 3600 * 1000 });
}

function leerSesion(req) {
  try { return jwt.verify(req.cookies.token, SECRET); } catch { return null; }
}

// Rol y permisos vigentes del usuario del personal (se leen de la base en cada consulta,
// así un cambio de rol o una cuenta desactivada se aplican de inmediato)
async function permisosDe(userId) {
  const [[r]] = await db.query(
    `SELECT r.nombre, r.permisos FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ? AND u.activo = 1`, [userId]);
  if (!r) return null;
  return { rol: r.nombre, permisos: r.nombre === 'administrador' ? TODOS : leerPermisos(r.permisos) };
}

// requiere()                    -> cualquier usuario del personal
// requiere('ventas', 'historial') -> quien tenga al menos uno de esos módulos (el administrador siempre puede)
function requiere(...modulos) {
  return async (req, res, next) => {
    try {
      const u = leerSesion(req);
      if (!u) return res.status(401).json({ error: 'Debes iniciar sesión.' });
      const p = u.tipo === 'staff' ? await permisosDe(u.id) : null;
      if (!p || (modulos.length && !modulos.some((m) => p.permisos.includes(m))))
        return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
      req.user = { ...u, ...p };
      next();
    } catch (e) { next(e); }
  };
}

// Cualquier sesión válida (cliente registrado o personal)
function requiereLogin(req, res, next) {
  const u = leerSesion(req);
  if (!u) return res.status(401).json({ error: 'Inicia sesión para ver las ofertas.' });
  req.user = u;
  next();
}

module.exports = { iniciarSesion, leerSesion, permisosDe, requiere, requiereLogin };
