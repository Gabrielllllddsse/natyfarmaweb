const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { iniciarSesion, leerSesion, permisosDe, requiereLogin } = require('../auth');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const correoValido = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c || '');

// Límite simple de intentos fallidos de ingreso (10 cada 15 minutos por IP)
const intentos = new Map();
const fallos = (ip) => (intentos.get(ip) || []).filter((t) => Date.now() - t < 15 * 60 * 1000);

router.get('/config', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT clave, valor FROM configuracion');
  res.json(Object.fromEntries(rows.map((r) => [r.clave, r.valor])));
}));

router.get('/categorias', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT id, nombre, descripcion, icono FROM categorias ORDER BY id');
  res.json(rows);
}));

// Catálogo público: solo lectura, no expone el stock exacto
router.get('/productos', wrap(async (req, res) => {
  const [rows] = await db.query(
    `SELECT p.id, p.nombre, p.descripcion, p.precio, p.imagen, p.categoria_id, c.nombre AS categoria, c.icono,
            (p.stock > 0) AS disponible
     FROM productos p JOIN categorias c ON c.id = p.categoria_id
     WHERE p.activo = 1 ORDER BY c.id, p.nombre`
  );
  res.json(rows.map((r) => ({ ...r, disponible: !!r.disponible })));
}));

router.post('/mensajes', wrap(async (req, res) => {
  const { nombre, correo, mensaje } = req.body;
  if (!nombre?.trim() || !correoValido(correo) || !mensaje?.trim())
    return res.status(400).json({ error: 'Completa tu nombre, un correo válido y tu mensaje.' });
  await db.query('INSERT INTO mensajes (nombre, correo, mensaje) VALUES (?,?,?)',
    [nombre.trim().slice(0, 100), correo.trim().slice(0, 120), mensaje.trim().slice(0, 2000)]);
  res.json({ ok: true });
}));

router.post('/auth/login', wrap(async (req, res) => {
  const { usuario, password } = req.body;
  if (fallos(req.ip).length >= 10) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
  if (!usuario || !password) return res.status(400).json({ error: 'Ingresa tu usuario y contraseña.' });

  const [[u]] = await db.query(
    `SELECT u.id, u.nombres, u.password_hash, r.nombre AS rol FROM usuarios u
     JOIN roles r ON r.id = u.rol_id WHERE u.usuario = ? AND u.activo = 1`, [usuario.trim()]);
  if (u && await bcrypt.compare(password, u.password_hash)) {
    iniciarSesion(res, { id: u.id, tipo: 'staff', rol: u.rol, nombre: u.nombres });
    return res.json({ tipo: 'staff', rol: u.rol, nombre: u.nombres });
  }
  const [[c]] = await db.query('SELECT id, nombres, password_hash FROM clientes WHERE correo = ?', [usuario.trim().toLowerCase()]);
  if (c && await bcrypt.compare(password, c.password_hash)) {
    iniciarSesion(res, { id: c.id, tipo: 'cliente', nombre: c.nombres });
    return res.json({ tipo: 'cliente', nombre: c.nombres });
  }
  intentos.set(req.ip, [...fallos(req.ip), Date.now()]);
  res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
}));

router.post('/auth/registro', wrap(async (req, res) => {
  const { nombres, correo, telefono, password } = req.body;
  if (!nombres?.trim() || !correoValido(correo)) return res.status(400).json({ error: 'Ingresa tu nombre y un correo válido.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  try {
    const [r] = await db.query('INSERT INTO clientes (nombres, correo, telefono, password_hash) VALUES (?,?,?,?)',
      [nombres.trim(), correo.trim().toLowerCase(), (telefono || '').trim() || null, await bcrypt.hash(password, 10)]);
    iniciarSesion(res, { id: r.insertId, tipo: 'cliente', nombre: nombres.trim() });
    res.json({ tipo: 'cliente', nombre: nombres.trim() });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ese correo ya tiene una cuenta. Prueba iniciar sesión.' });
    throw e;
  }
}));

router.post('/auth/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

router.get('/auth/me', wrap(async (req, res) => {
  const u = leerSesion(req);
  if (!u) return res.json(null);
  if (u.tipo !== 'staff') return res.json({ tipo: u.tipo, rol: null, nombre: u.nombre });
  const p = await permisosDe(u.id);          // rol y módulos vigentes
  if (!p) { res.clearCookie('token'); return res.json(null); }
  res.json({ tipo: 'staff', nombre: u.nombre, rol: p.rol, permisos: p.permisos });
}));

// Ofertas exclusivas: solo para clientes registrados (o personal) con sesión iniciada
router.get('/ofertas', requiereLogin, wrap(async (req, res) => {
  const [rows] = await db.query(
    `SELECT o.id, o.titulo, o.descuento, o.fecha_fin, p.id AS producto_id
     FROM ofertas o JOIN productos p ON p.id = o.producto_id
     WHERE o.activa = 1 AND p.activo = 1 AND CURDATE() BETWEEN o.fecha_inicio AND o.fecha_fin`);
  res.json(rows);
}));

module.exports = router;
