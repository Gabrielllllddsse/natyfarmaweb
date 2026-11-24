const PDFDocument = require('pdfkit');

const soles = (n) => 'S/ ' + Number(n).toFixed(2);

// Genera la boleta de venta en PDF y la envía como respuesta HTTP
module.exports = function boleta(res, venta, detalle, cfg, enLinea) {
  const num = String(venta.id).padStart(6, '0');
  const doc = new PDFDocument({ size: [297, 220 + detalle.length * 22 + 120 + (Number(venta.total_devuelto) > 0 ? 34 : 0)], margin: 18 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${enLinea ? 'inline' : 'attachment'}; filename="boleta-${num}.pdf"`);
  doc.pipe(res);

  const ancho = doc.page.width - 36;
  const verde = '#1F4D36';   // verde principal de la identidad visual

  doc.fillColor(verde).font('Helvetica-Bold').fontSize(16).text('NATYFARMA', { align: 'center' });
  doc.fillColor('#333').font('Helvetica').fontSize(8)
    .text('Botica', { align: 'center' })
    .text(cfg.direccion || '', { align: 'center' });
  if (cfg.telefono) doc.text('Tel. ' + cfg.telefono, { align: 'center' });
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(10).text(`BOLETA DE VENTA N° ${num}`, { align: 'center' });
  doc.moveDown(0.5).font('Helvetica').fontSize(8);
  const fecha = new Date(venta.fecha).toLocaleString('es-PE', { timeZone: 'America/Lima' });
  doc.text(`Fecha: ${fecha}`).text(`Atendió: ${venta.cajero}`);
  doc.text(`Cliente: ${venta.cliente_nombre || 'Cliente varios'}${venta.cliente_documento ? '  ·  Doc: ' + venta.cliente_documento : ''}`);
  doc.text(`Pago: ${venta.metodo_pago}`);
  doc.moveDown(0.5);

  const linea = () => { doc.moveTo(18, doc.y).lineTo(18 + ancho, doc.y).strokeColor('#bbb').stroke(); doc.moveDown(0.3); };
  linea();
  doc.font('Helvetica-Bold').text('Cant.  Descripción', 18, doc.y, { continued: true, width: ancho - 60 });
  doc.text('Subtotal', { align: 'right' });
  linea();
  doc.font('Helvetica');
  for (const d of detalle) {
    const y = doc.y;
    doc.text(`${d.cantidad} x ${d.nombre_producto}`, 18, y, { width: ancho - 60 });
    doc.text(soles(d.subtotal), 18 + ancho - 60, y, { width: 60, align: 'right' });
    doc.text(`   ${soles(d.precio_unitario)} c/u`, 18, doc.y, { width: ancho - 60 });
    doc.moveDown(0.2);
  }
  linea();
  doc.font('Helvetica-Bold').fontSize(12).fillColor(verde).text(`TOTAL: ${soles(venta.total)}`, { align: 'right' });
  if (Number(venta.total_devuelto) > 0) {   // la venta tuvo devoluciones
    doc.font('Helvetica').fontSize(8.5).fillColor('#B3261E').text(`Devuelto: -${soles(venta.total_devuelto)}`, { align: 'right' });
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#333').text(`TOTAL NETO: ${soles(venta.total - venta.total_devuelto)}`, { align: 'right' });
  }
  doc.moveDown(0.8).font('Helvetica').fontSize(8).fillColor('#555')
    .text('¡Gracias por tu compra! Cuidamos de ti y de los tuyos.', { align: 'center' })
    .moveDown(0.3).fontSize(6.5).fillColor('#888')
    .text('Documento interno de control. No es un comprobante electrónico SUNAT.', { align: 'center' });
  doc.end();
};
