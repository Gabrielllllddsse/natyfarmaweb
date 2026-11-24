// Datos de conexión a MySQL, compartidos por el servidor y por database/setup.js.
// En local se usan los valores por defecto; en la nube (Aiven, TiDB, etc.) se configuran
// con variables de entorno: DB_PORT y DB_SSL=true, y opcionalmente DB_CA con el certificado.
const fs = require('fs');

function ssl() {
  if (process.env.DB_SSL !== 'true') return undefined;
  let ca = process.env.DB_CA;                                     // certificado pegado como texto...
  if (ca && !ca.includes('BEGIN CERTIFICATE') && fs.existsSync(ca)) ca = fs.readFileSync(ca, 'utf8'); // ...o ruta a un archivo
  return ca ? { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true } : { rejectUnauthorized: true };
}

module.exports = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  ssl: ssl()
};
