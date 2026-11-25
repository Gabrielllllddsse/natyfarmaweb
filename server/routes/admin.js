const router = require('express').Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { requiere } = require('../auth');
const { MODULOS, leerPermisos } = require('../permisos');
const boleta = require('../boleta');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
// Cada ruta exige el módulo correspondiente; el administrador tiene todos
const staff = requiere();                   // cualquier personal
const productos = requiere('productos');
const ofertas = requiere('ofertas');
const ventas = requiere('ventas');
const historial = requiere('historial');
const devoluciones = requiere('devoluciones');
const inventario = requiere('inventario');
const reportes = requiere('reportes');
const clientes = requiere('clientes');
const mensajes = requiere('mensajes');
const usuarios = requiere('usuarios');
const roles = requiere('roles');
const config = requiere('config');

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '../../public/uploads'),
    filename: (req, f, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e4) + path.extname(f.originalname).toLowerCase())
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, f, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(f.mimetype))
});

const dup = (res, msg) => (e) => { if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: msg }); throw e; };

/* ---------- Resumen ---------- */
router.get('/dashboard', staff, wrap(async (req, res) => {
  const [[v]] = await db.query('SELECT COALESCE(SUM(total - total_devuelto),0) total, COUNT(*) cantidad FROM ventas WHERE DATE(fecha) = CURDATE()');
  const [[p]] = await db.query('SELECT COUNT(*) n FROM productos WHERE activo = 1');
  const [bajo] = await db.query('SELECT id, nombre, stock, stock_minimo FROM productos WHERE activo = 1 AND stock <= stock_minimo ORDER BY stock LIMIT 10');
  const [[m]] = await db.query('SELECT COUNT(*) n FROM mensajes WHERE leido = 0');
  res.json({ ventasHoy: v, productos: p.n, stockBajo: bajo, mensajesNuevos: m.n });
}));

/* ---------- Categorías y productos ---------- */
router.get('/categorias', staff, wrap(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM categorias ORDER BY id');
  res.json(rows);
}));

router.post('/categorias', productos, wrap(async (req, res) => {
  const { nombre } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'Escribe el nombre de la categoría.' });
  try {
    // El icono se elige en la interfaz según el nombre de la categoría
    const [r] = await db.query("INSERT INTO categorias (nombre, icono) VALUES (?, '')", [nombre.trim()]);
    res.json({ id: r.insertId });
  } catch (e) { dup(res, 'Esa categoría ya existe.')(e); }
}));

router.get('/productos', staff, wrap(async (req, res) => {
  const [rows] = await db.query(
    `SELECT p.*, c.nombre AS categoria, c.icono FROM productos p JOIN categorias c ON c.id = p.categoria_id ORDER BY p.activo DESC, p.nombre`);
  res.json(rows);
}));

function validarProducto(b) {
  if (!b.nombre?.trim()) return 'Escribe el nombre del producto.';
  if (!(parseFloat(b.precio) >= 0)) return 'El precio no es válido.';
  if (!b.categoria_id) return 'Elige una categoría.';
  return null;
}

router.post('/productos', productos, upload.single('imagen'), wrap(async (req, res) => {
  const b = req.body, err = validarProducto(b);
  if (err) return res.status(400).json({ error: err });
  const stock = Math.max(0, parseInt(b.stock) || 0);
  const [r] = await db.query(
    'INSERT INTO productos (nombre, descripcion, precio, stock, stock_minimo, categoria_id, imagen, activo) VALUES (?,?,?,?,?,?,?,?)',
    [b.nombre.trim(), (b.descripcion || '').slice(0, 300), parseFloat(b.precio), stock, Math.max(0, parseInt(b.stock_minimo) || 5),
     b.categoria_id, req.file ? '/uploads/' + req.file.filename : null, b.activo === '0' ? 0 : 1]);
  if (stock > 0)
    await db.query("INSERT INTO movimientos_stock (producto_id, tipo, cantidad, motivo, usuario_id) VALUES (?, 'entrada', ?, 'Stock inicial', ?)", [r.insertId, stock, req.user.id]);
  res.json({ id: r.insertId });
}));

router.put('/productos/:id', productos, upload.single('imagen'), wrap(async (req, res) => {
  const b = req.body, err = validarProducto(b);
  if (err) return res.status(400).json({ error: err });
  const campos = ['nombre = ?', 'descripcion = ?', 'precio = ?', 'stock_minimo = ?', 'categoria_id = ?', 'activo = ?'];
  const vals = [b.nombre.trim(), (b.descripcion || '').slice(0, 300), parseFloat(b.precio), Math.max(0, parseInt(b.stock_minimo) || 5), b.categoria_id, b.activo === '0' ? 0 : 1];
  if (req.file) { campos.push('imagen = ?'); vals.push('/uploads/' + req.file.filename); }
  await db.query(`UPDATE productos SET ${campos.join(', ')} WHERE id = ?`, [...vals, req.params.id]);
  res.json({ ok: true });
}));

/* ---------- Ofertas ---------- */
router.get('/ofertas', ofertas, wrap(async (req, res) => {
  const [rows] = await db.query(
    `SELECT o.*, p.nombre AS producto FROM ofertas o JOIN productos p ON p.id = o.producto_id ORDER BY o.activa DESC, o.fecha_fin DESC`);
  res.json(rows);
}));

router.post('/ofertas', ofertas, wrap(async (req, res) => {
  const { producto_id, titulo, descuento, fecha_inicio, fecha_fin } = req.body;
  const d = parseInt(descuento);
  if (!producto_id || !titulo?.trim() || !(d >= 1 && d <= 90) || !fecha_inicio || !fecha_fin || fecha_fin < fecha_inicio)
    return res.status(400).json({ error: 'Revisa los datos: descuento entre 1 y 90 y fechas válidas.' });
  await db.query('INSERT INTO ofertas (producto_id, titulo, descuento, fecha_inicio, fecha_fin) VALUES (?,?,?,?,?)',
    [producto_id, titulo.trim().slice(0, 100), d, fecha_inicio, fecha_fin]);
  res.json({ ok: true });
}));

router.put('/ofertas/:id', ofertas, wrap(async (req, res) => {
  await db.query('UPDATE ofertas SET activa = ? WHERE id = ?', [req.body.activa ? 1 : 0, req.params.id]);
  res.json({ ok: true });
}));

router.delete('/ofertas/:id', ofertas, wrap(async (req, res) => {
  await db.query('DELETE FROM ofertas WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

/* ---------- Ventas y boleta ---------- */
router.post('/ventas', ventas, wrap(async (req, res) => {
  const { items, cliente_nombre, cliente_documento, metodo_pago } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'El carrito está vacío.' });
  const metodo = ['efectivo', 'yape', 'plin', 'tarjeta'].includes(metodo_pago) ? metodo_pago : 'efectivo';
  const cn = await db.getConnection();
  try {
    await cn.beginTransaction();
    let totalCent = 0;
    const det = [];
    for (const it of items) {
      const cant = parseInt(it.cantidad);
      if (!(cant > 0)) throw new Error('Cantidad inválida.');
      const [[p]] = await cn.query('SELECT id, nombre, precio, stock FROM productos WHERE id = ? AND activo = 1 FOR UPDATE', [it.producto_id]);
      if (!p) throw new Error('Un producto del carrito ya no está disponible.');
      if (p.stock < cant) throw new Error(`Stock insuficiente de ${p.nombre} (quedan ${p.stock}).`);
      const sub = Math.round(p.precio * 100) * cant;
      totalCent += sub;
      det.push({ p, cant, sub });
    }
    const [v] = await cn.query(
      'INSERT INTO ventas (usuario_id, cliente_nombre, cliente_documento, metodo_pago, total) VALUES (?,?,?,?,?)',
      [req.user.id, cliente_nombre?.trim().slice(0, 100) || null, cliente_documento?.trim().slice(0, 15) || null, metodo, totalCent / 100]);
    for (const { p, cant, sub } of det) {
      await cn.query('INSERT INTO detalle_venta (venta_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal) VALUES (?,?,?,?,?,?)',
        [v.insertId, p.id, p.nombre, cant, p.precio, sub / 100]);
      await cn.query('UPDATE productos SET stock = stock - ? WHERE id = ?', [cant, p.id]);
      await cn.query("INSERT INTO movimientos_stock (producto_id, tipo, cantidad, motivo, usuario_id) VALUES (?, 'salida', ?, ?, ?)",
        [p.id, cant, `Venta #${v.insertId}`, req.user.id]);
    }
    await cn.commit();
    res.json({ id: v.insertId, total: totalCent / 100 });
  } catch (e) {
    await cn.rollback();
    res.status(400).json({ error: e.message });
  } finally { cn.release(); }
}));

// Estado de una venta según lo devuelto
const estadoVenta = (v) => (Number(v.total_devuelto) <= 0 ? 'completada' : Number(v.total_devuelto) >= Number(v.total) ? 'devuelta' : 'devolucion_parcial');

router.get('/ventas', historial, wrap(async (req, res) => {
  const [rows] = await db.query(
    `SELECT v.id, v.fecha, v.cliente_nombre, v.metodo_pago, v.total, v.total_devuelto, u.nombres AS cajero
     FROM ventas v JOIN usuarios u ON u.id = v.usuario_id ORDER BY v.id DESC LIMIT 100`);
  res.json(rows.map((v) => ({ ...v, estado: estadoVenta(v) })));
}));

// Detalle de una venta con lo que aún se puede devolver
router.get('/ventas/:id', requiere('historial', 'devoluciones'), wrap(async (req, res) => {
  const [[v]] = await db.query('SELECT v.*, u.nombres AS cajero FROM ventas v JOIN usuarios u ON u.id = v.usuario_id WHERE v.id = ?', [req.params.id]);
  if (!v) return res.status(404).json({ error: 'Venta no encontrada.' });
  const [detalle] = await db.query('SELECT producto_id, nombre_producto, cantidad, devuelto, precio_unitario, subtotal FROM detalle_venta WHERE venta_id = ?', [v.id]);
  res.json({ ...v, estado: estadoVenta(v), detalle });
}));

router.get('/ventas/:id/boleta', requiere('ventas', 'historial'), wrap(async (req, res) => {
  const [[v]] = await db.query('SELECT v.*, u.nombres AS cajero FROM ventas v JOIN usuarios u ON u.id = v.usuario_id WHERE v.id = ?', [req.params.id]);
  if (!v) return res.status(404).json({ error: 'Venta no encontrada.' });
  const [det] = await db.query('SELECT * FROM detalle_venta WHERE venta_id = ?', [v.id]);
  const [cfg] = await db.query('SELECT clave, valor FROM configuracion');
  boleta(res, v, det, Object.fromEntries(cfg.map((c) => [c.clave, c.valor])), req.query.ver === '1');
}));

/* ---------- Devoluciones (total o parcial) ---------- */
router.post('/ventas/:id/devolucion', devoluciones, wrap(async (req, res) => {
  const { items, motivo } = req.body;
  if (!motivo?.trim()) return res.status(400).json({ error: 'Escribe el motivo de la devolución.' });
  const pedidos = (Array.isArray(items) ? items : []).map((i) => ({ producto_id: +i.producto_id, cantidad: parseInt(i.cantidad) })).filter((i) => i.cantidad > 0);
  if (!pedidos.length) return res.status(400).json({ error: 'Indica al menos un producto y una cantidad a devolver.' });
  const cn = await db.getConnection();
  try {
    await cn.beginTransaction();
    const [[v]] = await cn.query('SELECT id FROM ventas WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!v) throw new Error('Venta no encontrada.');
    let totalCent = 0;
    const det = [];
    for (const it of pedidos) {
      const [[d]] = await cn.query('SELECT id, nombre_producto, cantidad, devuelto, precio_unitario FROM detalle_venta WHERE venta_id = ? AND producto_id = ? FOR UPDATE', [v.id, it.producto_id]);
      if (!d) throw new Error('Uno de los productos no pertenece a esta venta.');
      const disponible = d.cantidad - d.devuelto;
      if (it.cantidad > disponible) throw new Error(`Solo se pueden devolver ${disponible} unidad(es) de ${d.nombre_producto}.`);
      const sub = Math.round(d.precio_unitario * 100) * it.cantidad;
      totalCent += sub;
      det.push({ d, cant: it.cantidad, sub, producto_id: it.producto_id });
    }
    const [dv] = await cn.query('INSERT INTO devoluciones (venta_id, usuario_id, motivo, total) VALUES (?,?,?,?)',
      [v.id, req.user.id, motivo.trim().slice(0, 200), totalCent / 100]);
    for (const { d, cant, sub, producto_id } of det) {
      await cn.query('INSERT INTO detalle_devolucion (devolucion_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal) VALUES (?,?,?,?,?,?)',
        [dv.insertId, producto_id, d.nombre_producto, cant, d.precio_unitario, sub / 100]);
      await cn.query('UPDATE detalle_venta SET devuelto = devuelto + ? WHERE id = ?', [cant, d.id]);
      await cn.query('UPDATE productos SET stock = stock + ? WHERE id = ?', [cant, producto_id]);   // el producto vuelve al stock
      await cn.query("INSERT INTO movimientos_stock (producto_id, tipo, cantidad, motivo, usuario_id) VALUES (?, 'entrada', ?, ?, ?)",
        [producto_id, cant, `Devolución de la venta #${v.id}`, req.user.id]);
    }
    await cn.query('UPDATE ventas SET total_devuelto = total_devuelto + ? WHERE id = ?', [totalCent / 100, v.id]);
    await cn.commit();
    res.json({ id: dv.insertId, total: totalCent / 100 });
  } catch (e) {
    await cn.rollback();
    res.status(400).json({ error: e.message });
  } finally { cn.release(); }
}));

router.get('/devoluciones', devoluciones, wrap(async (req, res) => {
  const [rows] = await db.query(
    `SELECT dv.id, dv.venta_id, dv.fecha, dv.motivo, dv.total, u.nombres AS usuario,
            GROUP_CONCAT(CONCAT(dd.cantidad, ' x ', dd.nombre_producto) SEPARATOR ', ') AS productos
     FROM devoluciones dv JOIN usuarios u ON u.id = dv.usuario_id JOIN detalle_devolucion dd ON dd.devolucion_id = dv.id
     GROUP BY dv.id, dv.venta_id, dv.fecha, dv.motivo, dv.total, u.nombres   -- todas las columnas (exigido por TiDB)
     ORDER BY dv.id DESC LIMIT 100`);
  res.json(rows);
}));

/* ---------- Inventario ---------- */
router.get('/inventario/movimientos', inventario, wrap(async (req, res) => {
  const [rows] = await db.query(
    `SELECT m.*, p.nombre AS producto, u.nombres AS usuario FROM movimientos_stock m
     JOIN productos p ON p.id = m.producto_id LEFT JOIN usuarios u ON u.id = m.usuario_id ORDER BY m.id DESC LIMIT 60`);
  res.json(rows);
}));

router.post('/inventario/movimientos', inventario, wrap(async (req, res) => {
  const { producto_id, tipo, cantidad, motivo } = req.body;
  const cant = parseInt(cantidad);
  if (!producto_id || !['entrada', 'salida'].includes(tipo) || !(cant > 0))
    return res.status(400).json({ error: 'Elige el producto, el tipo y una cantidad mayor a cero.' });
  const cn = await db.getConnection();
  try {
    await cn.beginTransaction();
    const [[p]] = await cn.query('SELECT stock FROM productos WHERE id = ? FOR UPDATE', [producto_id]);
    if (!p) throw new Error('Producto no encontrado.');
    if (tipo === 'salida' && p.stock < cant) throw new Error(`Solo hay ${p.stock} unidades en stock.`);
    await cn.query('UPDATE productos SET stock = stock + ? WHERE id = ?', [tipo === 'entrada' ? cant : -cant, producto_id]);
    await cn.query('INSERT INTO movimientos_stock (producto_id, tipo, cantidad, motivo, usuario_id) VALUES (?,?,?,?,?)',
      [producto_id, tipo, cant, (motivo || '').trim().slice(0, 160) || (tipo === 'entrada' ? 'Ingreso de mercadería' : 'Salida de stock'), req.user.id]);
    await cn.commit();
    res.json({ ok: true });
  } catch (e) { await cn.rollback(); res.status(400).json({ error: e.message }); } finally { cn.release(); }
}));

/* ---------- Reportes, clientes, mensajes (administrador) ---------- */
router.get('/reportes/ventas', reportes, wrap(async (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const desde = req.query.desde || hoy, hasta = req.query.hasta || hoy;
  const rango = 'DATE(v.fecha) BETWEEN ? AND ?';
  // Montos netos: lo vendido menos lo devuelto
  const [[resumen]] = await db.query(
    `SELECT COALESCE(SUM(total - total_devuelto),0) total, COALESCE(SUM(total_devuelto),0) devuelto, COUNT(*) cantidad FROM ventas v WHERE ${rango}`, [desde, hasta]);
  const [porDia] = await db.query(`SELECT DATE_FORMAT(v.fecha,'%Y-%m-%d') dia, COUNT(*) ventas, SUM(total - total_devuelto) total FROM ventas v WHERE ${rango} GROUP BY dia ORDER BY dia DESC`, [desde, hasta]);
  const [top] = await db.query(
    `SELECT d.nombre_producto producto, SUM(d.cantidad - d.devuelto) unidades, SUM((d.cantidad - d.devuelto) * d.precio_unitario) total FROM detalle_venta d
     JOIN ventas v ON v.id = d.venta_id WHERE ${rango} GROUP BY d.producto_id, d.nombre_producto HAVING unidades > 0 ORDER BY unidades DESC LIMIT 10`, [desde, hasta]);
  const [porMetodo] = await db.query(`SELECT metodo_pago metodo, COUNT(*) ventas, SUM(total - total_devuelto) total FROM ventas v WHERE ${rango} GROUP BY metodo_pago`, [desde, hasta]);
  res.json({ resumen, porDia, top, porMetodo });
}));

router.get('/reportes/inventario', reportes, wrap(async (req, res) => {
  const [rows] = await db.query(
    `SELECT p.nombre, c.nombre categoria, p.stock, p.stock_minimo, p.precio, (p.stock * p.precio) valor
     FROM productos p JOIN categorias c ON c.id = p.categoria_id WHERE p.activo = 1 ORDER BY (p.stock <= p.stock_minimo) DESC, p.stock`);
  res.json(rows);
}));

router.get('/clientes', clientes, wrap(async (req, res) => {
  const [registrados] = await db.query('SELECT id, nombres, correo, telefono, creado_en FROM clientes ORDER BY id DESC');
  const [atendidos] = await db.query(
    `SELECT cliente_nombre nombre, MAX(cliente_documento) documento, COUNT(*) compras, SUM(total - total_devuelto) total, MAX(fecha) ultima
     FROM ventas WHERE cliente_nombre IS NOT NULL GROUP BY cliente_nombre ORDER BY ultima DESC`);
  res.json({ registrados, atendidos });
}));

router.get('/mensajes', mensajes, wrap(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM mensajes ORDER BY leido, id DESC LIMIT 100');
  res.json(rows);
}));

router.put('/mensajes/:id/leido', mensajes, wrap(async (req, res) => {
  await db.query('UPDATE mensajes SET leido = 1 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

/* ---------- Usuarios y configuración (administrador) ---------- */
/* ---------- Roles con permisos por módulo ---------- */
router.get('/roles', requiere('roles', 'usuarios'), wrap(async (req, res) => {
  const [rows] = await db.query(
    `SELECT r.id, r.nombre, r.permisos, r.base, COUNT(u.id) AS usuarios
     FROM roles r LEFT JOIN usuarios u ON u.rol_id = r.id GROUP BY r.id, r.nombre, r.permisos, r.base ORDER BY r.base DESC, r.id`);
  res.json({ modulos: MODULOS, roles: rows.map((r) => ({ ...r, permisos: leerPermisos(r.permisos) })) });
}));

function validarRol(b) {
  const nombre = String(b.nombre || '').trim().toLowerCase();
  if (nombre.length < 3 || nombre.length > 30) return { error: 'El nombre del rol debe tener entre 3 y 30 letras.' };
  const permisos = leerPermisos((b.permisos || []).join(','));
  if (!permisos.length) return { error: 'Marca al menos un módulo para este rol.' };
  return { nombre, permisos: permisos.join(',') };
}

router.post('/roles', roles, wrap(async (req, res) => {
  const r = validarRol(req.body);
  if (r.error) return res.status(400).json(r);
  try {
    const [x] = await db.query('INSERT INTO roles (nombre, permisos) VALUES (?,?)', [r.nombre, r.permisos]);
    res.json({ id: x.insertId });
  } catch (e) { dup(res, 'Ya existe un rol con ese nombre.')(e); }
}));

router.put('/roles/:id', roles, wrap(async (req, res) => {
  const [[actual]] = await db.query('SELECT nombre, base FROM roles WHERE id = ?', [req.params.id]);
  if (!actual) return res.status(404).json({ error: 'Rol no encontrado.' });
  if (actual.nombre === 'administrador') return res.status(400).json({ error: 'El Administrador siempre tiene acceso total.' });
  const r = validarRol({ ...req.body, nombre: actual.base ? actual.nombre : req.body.nombre }); // los roles base no cambian de nombre
  if (r.error) return res.status(400).json(r);
  try {
    await db.query('UPDATE roles SET nombre = ?, permisos = ? WHERE id = ?', [r.nombre, r.permisos, req.params.id]);
    res.json({ ok: true });
  } catch (e) { dup(res, 'Ya existe un rol con ese nombre.')(e); }
}));

router.delete('/roles/:id', roles, wrap(async (req, res) => {
  const [[r]] = await db.query('SELECT r.base, COUNT(u.id) n FROM roles r LEFT JOIN usuarios u ON u.rol_id = r.id WHERE r.id = ? GROUP BY r.id, r.base', [req.params.id]);
  if (!r) return res.status(404).json({ error: 'Rol no encontrado.' });
  if (r.base) return res.status(400).json({ error: 'Los roles Administrador y Cajero no se pueden eliminar.' });
  if (r.n) return res.status(409).json({ error: `Este rol tiene ${r.n} usuario(s). Cámbiales el rol antes de eliminarlo.` });
  await db.query('DELETE FROM roles WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

router.get('/usuarios', usuarios, wrap(async (req, res) => {
  const [rows] = await db.query('SELECT u.id, u.nombres, u.usuario, u.activo, u.rol_id, r.nombre rol FROM usuarios u JOIN roles r ON r.id = u.rol_id ORDER BY u.id');
  res.json(rows);
}));

router.post('/usuarios', usuarios, wrap(async (req, res) => {
  const { nombres, usuario, password, rol_id } = req.body;
  if (!nombres?.trim() || !usuario?.trim() || !rol_id) return res.status(400).json({ error: 'Completa nombre, usuario y rol.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  try {
    await db.query('INSERT INTO usuarios (nombres, usuario, password_hash, rol_id) VALUES (?,?,?,?)',
      [nombres.trim(), usuario.trim().toLowerCase(), await bcrypt.hash(password, 10), rol_id]);
    res.json({ ok: true });
  } catch (e) { dup(res, 'Ese nombre de usuario ya existe.')(e); }
}));

router.put('/usuarios/:id', usuarios, wrap(async (req, res) => {
  const { nombres, rol_id, activo, password } = req.body;
  if (+req.params.id === req.user.id && !activo) return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta.' });
  if (+req.params.id === req.user.id && req.user.rol === 'administrador') {
    const [[r]] = await db.query('SELECT nombre FROM roles WHERE id = ?', [rol_id]);
    if (r?.nombre !== 'administrador') return res.status(400).json({ error: 'No puedes quitarte el rol de Administrador a ti mismo.' });
  }
  await db.query('UPDATE usuarios SET nombres = ?, rol_id = ?, activo = ? WHERE id = ?', [nombres, rol_id, activo ? 1 : 0, req.params.id]);
  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    await db.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [await bcrypt.hash(password, 10), req.params.id]);
  }
  res.json({ ok: true });
}));

const CLAVES = ['direccion', 'horario', 'telefono', 'correo', 'facebook', 'instagram', 'tiktok'];
router.put('/config', config, wrap(async (req, res) => {
  for (const k of CLAVES) {
    if (k in req.body)
      await db.query('INSERT INTO configuracion (clave, valor) VALUES (?,?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', [k, String(req.body[k]).trim().slice(0, 255)]);
  }
  res.json({ ok: true });
}));

module.exports = router;
