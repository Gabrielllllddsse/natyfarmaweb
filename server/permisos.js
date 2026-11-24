// Módulos del panel que se pueden asignar a un rol
const MODULOS = {
  ventas: 'Nueva venta',
  historial: 'Historial de ventas',
  devoluciones: 'Devoluciones',
  productos: 'Productos',
  ofertas: 'Ofertas',
  inventario: 'Inventario',
  reportes: 'Reportes',
  clientes: 'Clientes',
  mensajes: 'Mensajes',
  usuarios: 'Usuarios',
  roles: 'Roles',
  config: 'Datos del negocio'
};

const TODOS = Object.keys(MODULOS);
const CAJERO = ['ventas', 'historial'];

// Convierte "ventas,historial" en ['ventas', 'historial'] (solo módulos válidos)
const leerPermisos = (txt) => String(txt || '').split(',').map((s) => s.trim()).filter((m) => MODULOS[m]);

module.exports = { MODULOS, TODOS, CAJERO, leerPermisos };
