const mysql = require('mysql2/promise');
const conexion = require('./conexion');

module.exports = mysql.createPool({
  ...conexion,
  database: process.env.DB_NAME || 'natyfarma',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
  charset: 'utf8mb4'
});
