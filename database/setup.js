// Crea la base de datos, las tablas y los datos iniciales.
// Se puede ejecutar varias veces sin duplicar datos (también actualiza bases creadas con versiones anteriores).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { TODOS, CAJERO } = require('../server/permisos');
const conexion = require('../server/conexion');

const DB = process.env.DB_NAME || 'natyfarma';

(async () => {
  const cn = await mysql.createConnection({
    ...conexion,
    multipleStatements: true
  });
  let sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  sql = sql.replace(/natyfarma/g, DB);
  await cn.query(sql);
  await cn.query(`USE \`${DB}\``);

  /* ---------- Actualización de bases anteriores ---------- */
  const columnas = (await cn.query('SHOW COLUMNS FROM roles'))[0].map((c) => c.Field);
  if (!columnas.includes('permisos')) await cn.query("ALTER TABLE roles ADD COLUMN permisos VARCHAR(255) NOT NULL DEFAULT ''");
  if (!columnas.includes('base')) await cn.query('ALTER TABLE roles ADD COLUMN base TINYINT(1) NOT NULL DEFAULT 0');
  await cn.query("ALTER TABLE categorias MODIFY icono VARCHAR(20) DEFAULT ''");
  // Columnas para devoluciones (versión final)
  const agregar = async (tabla, col, def) => {
    const cols = (await cn.query(`SHOW COLUMNS FROM ${tabla}`))[0].map((c) => c.Field);
    if (!cols.includes(col)) await cn.query(`ALTER TABLE ${tabla} ADD COLUMN ${col} ${def}`);
  };
  await agregar('ventas', 'total_devuelto', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER total');
  await agregar('detalle_venta', 'devuelto', 'INT NOT NULL DEFAULT 0');

  // Solo quedan dos roles base: Administrador y Cajero
  await cn.query(
    "INSERT INTO roles (nombre, permisos, base) VALUES ('administrador', ?, 1), ('cajero', ?, 1) ON DUPLICATE KEY UPDATE base = 1",
    [TODOS.join(','), CAJERO.join(',')]);
  await cn.query("UPDATE roles SET permisos = ? WHERE nombre = 'administrador'", [TODOS.join(',')]);
  await cn.query("UPDATE roles SET permisos = ? WHERE nombre = 'cajero' AND permisos = ''", [CAJERO.join(',')]);

  // Se retiran los roles Farmacéutico y Almacén (sus funciones pasan al Administrador)
  const [[cajero]] = await cn.query("SELECT id FROM roles WHERE nombre = 'cajero'");
  const [viejos] = await cn.query(
    `SELECT u.id, (SELECT COUNT(*) FROM ventas v WHERE v.usuario_id = u.id) +
                   (SELECT COUNT(*) FROM movimientos_stock m WHERE m.usuario_id = u.id) AS usos
     FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE r.nombre IN ('farmaceutico', 'almacen')`);
  for (const u of viejos) {
    if (u.usos) await cn.query('UPDATE usuarios SET rol_id = ?, activo = 0 WHERE id = ?', [cajero.id, u.id]); // conserva el historial
    else await cn.query('DELETE FROM usuarios WHERE id = ?', [u.id]);
  }
  await cn.query("DELETE FROM roles WHERE nombre IN ('farmaceutico', 'almacen')");

  // Los iconos de categoría pasan de emojis a nombres de iconos SVG
  for (const [icono, patron] of [['pastilla', '%medic%'], ['frasco', '%cuidado%'], ['hoja', '%vitamin%'], ['gota', '%derm%']])
    await cn.query('UPDATE categorias SET icono = ? WHERE nombre LIKE ?', [icono, patron]);
  await cn.query("UPDATE categorias SET icono = '' WHERE icono NOT IN ('pastilla','frasco','hoja','gota','familia','cruz')");

  /* ---------- Datos iniciales ---------- */
  const [[{ n: nUsuarios }]] = await cn.query('SELECT COUNT(*) n FROM usuarios');
  if (!nUsuarios) {
    const usuarios = [
      ['Leonela Portocarrero', 'admin', 'Admin123', 'administrador'],
      ['Cajero Natyfarma', 'cajero', 'Caja123', 'cajero']
    ];
    for (const [nombres, usuario, clave, rol] of usuarios) {
      await cn.query(
        'INSERT INTO usuarios (nombres, usuario, password_hash, rol_id) SELECT ?, ?, ?, id FROM roles WHERE nombre = ?',
        [nombres, usuario, await bcrypt.hash(clave, 10), rol]
      );
    }
  }

  const [[{ n: nCat }]] = await cn.query('SELECT COUNT(*) n FROM categorias');
  if (!nCat) {
    await cn.query('INSERT INTO categorias (nombre, descripcion, icono) VALUES ?', [[
      ['Medicamentos', 'Genéricos y de marca para toda necesidad.', 'pastilla'],
      ['Cuidado personal', 'Higiene y cuidado para toda la familia.', 'frasco'],
      ['Vitaminas y naturales', 'Suplementos para tu bienestar.', 'hoja'],
      ['Dermocosmética', 'Cuidado especializado de la piel.', 'gota']
    ]]);
    // [nombre, descripción, precio, stock, stock mínimo, categoría]
    const productos = [
      ['Paracetamol 500mg', 'Alivia el dolor leve y la fiebre. Caja x 100 tabletas.', 8.5, 60, 10, 1],
      ['Ibuprofeno 400mg', 'Antiinflamatorio para dolor muscular y de cabeza.', 9.9, 45, 10, 1],
      ['Loratadina 10mg', 'Antialérgico. Blíster x 10 tabletas.', 6.5, 40, 8, 1],
      ['Suero de rehidratación oral', 'Sobre para preparar. Repone sales y líquidos.', 3.5, 4, 8, 1],
      ['Bloqueador solar FPS50', 'Protección diaria contra rayos UVA y UVB. 120 ml.', 32, 25, 5, 2],
      ['Shampoo anticaspa', 'Control de caspa y picazón. 400 ml.', 18.9, 30, 5, 2],
      ['Jabón antibacterial', 'Limpieza e higiene diaria para toda la familia.', 6.5, 50, 10, 2],
      ['Pasta dental con flúor', 'Protección contra caries. 100 g.', 7.9, 55, 10, 2],
      ['Multivitamínico x30', 'Complejo de vitaminas y minerales. 30 tabletas.', 24.9, 35, 6, 3],
      ['Aceite de sacha inchi', 'Fuente natural de omega 3, 6 y 9. 60 cápsulas.', 18.5, 28, 5, 3],
      ['Vitamina C 1000mg x30', 'Refuerza las defensas. 30 tabletas efervescentes.', 21, 32, 6, 3],
      ['Maca en cápsulas', 'Energía y vitalidad, de origen peruano. 60 cápsulas.', 19.5, 22, 5, 3],
      ['Crema hidratante facial', 'Hidratación diaria para todo tipo de piel. 50 ml.', 19.9, 26, 5, 4],
      ['Limpiador facial', 'Gel suave que retira impurezas sin resecar. 150 ml.', 22.5, 24, 5, 4],
      ['Contorno de ojos', 'Reduce ojeras y bolsas. 15 ml.', 29.9, 15, 4, 4],
      ['Protector labial', 'Hidrata y protege los labios del frío y el sol.', 8.9, 40, 8, 4]
    ];
    for (const [nombre, desc, precio, stock, min, cat] of productos) {
      const [r] = await cn.query(
        'INSERT INTO productos (nombre, descripcion, precio, stock, stock_minimo, categoria_id) VALUES (?,?,?,?,?,?)',
        [nombre, desc, precio, stock, min, cat]
      );
      await cn.query(
        "INSERT INTO movimientos_stock (producto_id, tipo, cantidad, motivo) VALUES (?, 'entrada', ?, 'Stock inicial')",
        [r.insertId, stock]
      );
    }
    await cn.query(
      `INSERT INTO ofertas (producto_id, titulo, descuento, fecha_inicio, fecha_fin) VALUES
       (9, 'Oferta exclusiva para clientes registrados', 15, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR)),
       (5, 'Cuida tu piel este verano', 10, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR))`
    );
  }

  await cn.query('INSERT IGNORE INTO configuracion (clave, valor) VALUES ?', [[
    ['direccion', 'Av. Grau con Santa Rosa, Huancayo'],
    ['horario', 'Atención las 24 horas, todos los días'],
    ['telefono', ''],
    ['correo', ''],
    ['facebook', ''],
    ['instagram', ''],
    ['tiktok', '']
  ]]);

  console.log('Listo: base de datos preparada.');
  console.log('  Usuarios del panel: admin / Admin123 (Administrador) · cajero / Caja123 (Cajero)');
  console.log('  Cambia estas contraseñas desde el panel (Usuarios) antes de usar el sistema en serio.');
  await cn.end();
})().catch((e) => { console.error('Error:', e.message); process.exit(1); });
