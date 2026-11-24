-- =====================================================================
-- NatyfarmaWeb - Esquema de base de datos (MySQL 8 / MySQL Workbench)
-- Puedes abrir este archivo en MySQL Workbench y ejecutarlo completo,
-- o usar "npm run setup" para crear y llenar todo automáticamente.
-- =====================================================================
-- Los comentarios /*T! ... */ solo los lee TiDB (despliegue en la nube): numeración correlativa de IDs. MySQL los ignora.
CREATE DATABASE IF NOT EXISTS natyfarma CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE natyfarma;

-- Roles: "permisos" guarda los módulos del panel que puede usar (separados por comas).
-- "base" = 1 marca los roles del sistema (Administrador y Cajero), que no se eliminan.
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(30) NOT NULL UNIQUE,
  permisos VARCHAR(255) NOT NULL DEFAULT '',
  base TINYINT(1) NOT NULL DEFAULT 0
) /*T![auto_id_cache] AUTO_ID_CACHE=1 */;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombres VARCHAR(100) NOT NULL,
  usuario VARCHAR(40) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  rol_id INT NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rol_id) REFERENCES roles(id)
) /*T![auto_id_cache] AUTO_ID_CACHE=1 */;

CREATE TABLE IF NOT EXISTS clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombres VARCHAR(100) NOT NULL,
  correo VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  telefono VARCHAR(20),
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) /*T![auto_id_cache] AUTO_ID_CACHE=1 */;

CREATE TABLE IF NOT EXISTS categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL UNIQUE,
  descripcion VARCHAR(160),
  icono VARCHAR(20) DEFAULT ''   -- nombre del icono SVG (pastilla, frasco, hoja, gota); vacío = según el nombre
) /*T![auto_id_cache] AUTO_ID_CACHE=1 */;

CREATE TABLE IF NOT EXISTS productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  descripcion VARCHAR(300) DEFAULT '',
  precio DECIMAL(10,2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  stock_minimo INT NOT NULL DEFAULT 5,
  categoria_id INT NOT NULL,
  imagen VARCHAR(255) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
) /*T![auto_id_cache] AUTO_ID_CACHE=1 */;

CREATE TABLE IF NOT EXISTS ventas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  cliente_nombre VARCHAR(100) NULL,
  cliente_documento VARCHAR(15) NULL,
  metodo_pago ENUM('efectivo','yape','plin','tarjeta') NOT NULL DEFAULT 'efectivo',
  total DECIMAL(10,2) NOT NULL,
  total_devuelto DECIMAL(10,2) NOT NULL DEFAULT 0,   -- suma de las devoluciones de esta venta
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) /*T![auto_id_cache] AUTO_ID_CACHE=1 */;

CREATE TABLE IF NOT EXISTS detalle_venta (
  id INT AUTO_INCREMENT PRIMARY KEY,
  venta_id INT NOT NULL,
  producto_id INT NOT NULL,
  nombre_producto VARCHAR(120) NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  devuelto INT NOT NULL DEFAULT 0,                   -- unidades ya devueltas de este producto
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
) /*T![auto_id_cache] AUTO_ID_CACHE=1 */;

-- Devoluciones: cada devolución pertenece a una venta y puede ser total o parcial
CREATE TABLE IF NOT EXISTS devoluciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  venta_id INT NOT NULL,
  usuario_id INT NOT NULL,
  motivo VARCHAR(200) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (venta_id) REFERENCES ventas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) /*T![auto_id_cache] AUTO_ID_CACHE=1 */;

CREATE TABLE IF NOT EXISTS detalle_devolucion (
  id INT AUTO_INCREMENT PRIMARY KEY,
  devolucion_id INT NOT NULL,
  producto_id INT NOT NULL,
  nombre_producto VARCHAR(120) NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (devolucion_id) REFERENCES devoluciones(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
) /*T![auto_id_cache] AUTO_ID_CACHE=1 */;

CREATE TABLE IF NOT EXISTS movimientos_stock (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  tipo ENUM('entrada','salida') NOT NULL,
  cantidad INT NOT NULL,
  motivo VARCHAR(160),
  usuario_id INT NULL,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (producto_id) REFERENCES productos(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) /*T![auto_id_cache] AUTO_ID_CACHE=1 */;

CREATE TABLE IF NOT EXISTS ofertas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  titulo VARCHAR(100) NOT NULL,
  descuento INT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
) /*T![auto_id_cache] AUTO_ID_CACHE=1 */;

CREATE TABLE IF NOT EXISTS mensajes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  correo VARCHAR(120) NOT NULL,
  mensaje TEXT NOT NULL,
  leido TINYINT(1) NOT NULL DEFAULT 0,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) /*T![auto_id_cache] AUTO_ID_CACHE=1 */;

CREATE TABLE IF NOT EXISTS configuracion (
  clave VARCHAR(40) PRIMARY KEY,
  valor VARCHAR(255) NOT NULL DEFAULT ''
);
