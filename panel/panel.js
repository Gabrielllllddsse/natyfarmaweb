// Panel interno de Natyfarma: una sola página con vistas según el rol del usuario
let ME = null, M = null;
// Nombre visible de un rol: "administrador" -> "Administrador"
const nombreRol = (r) => String(r || '').charAt(0).toUpperCase() + String(r || '').slice(1);
const hoy = () => new Date().toLocaleDateString('en-CA');
const sumaDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const fechaHora = (f) => new Date(f).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
const A = (u, o) => api('/api/admin' + u, o);

// Cada vista pertenece a un módulo; el rol del usuario define qué módulos ve
const VISTAS = {
  inicio:     { t: 'Inicio',               fn: vInicio },
  ventas:     { t: 'Nueva venta',          fn: vVentas },
  historial:  { t: 'Historial de ventas',  fn: vHistorial },
  devoluciones: { t: 'Devoluciones',       fn: vDevoluciones },
  productos:  { t: 'Productos',            fn: vProductos },
  ofertas:    { t: 'Ofertas',              fn: vOfertas },
  inventario: { t: 'Inventario',           fn: vInventario },
  reportes:   { t: 'Reportes',             fn: vReportes },
  clientes:   { t: 'Clientes',             fn: vClientes },
  mensajes:   { t: 'Mensajes',             fn: vMensajes },
  usuarios:   { t: 'Usuarios',             fn: vUsuarios },
  roles:      { t: 'Roles',                fn: vRoles },
  config:     { t: 'Datos del negocio',    fn: vConfig }
};
const puede = (m) => (ME.permisos || []).includes(m);
const permitido = (id) => id === 'inicio' || puede(id);

/* ---------- Utilidades de interfaz ---------- */
const encabezado = (t, extra = '') => `<div class="encabezado"><h1>${t}</h1><div class="d-flex gap-2 flex-wrap">${extra}</div></div>`;
const tabla = (cols, filas, vacio = 'Aún no hay registros.') => filas.length
  ? `<div class="tabla-wrap"><table class="table table-hover align-middle"><thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${filas.map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
  : `<p class="text-secondary mb-0">${vacio}</p>`;
const chip = (t, k = '') => `<span class="chip ${k}">${esc(t)}</span>`;
const campo = (id, label, valor = '', extra = '', col = 12) =>
  `<div class="col-${col}"><label class="form-label" for="${id}">${label}</label><input class="form-control" id="${id}" value="${esc(valor)}" ${extra}></div>`;
const opciones = (lista, sel, val = 'id', txt = 'nombre') => lista.map((o) => `<option value="${o[val]}" ${o[val] == sel ? 'selected' : ''}>${esc(o[txt])}</option>`).join('');

function modal(titulo, cuerpo, guardar, onGuardar) {
  $('#m-titulo').textContent = titulo;
  $('#m-cuerpo').innerHTML = cuerpo;
  const b = $('#m-guardar');
  b.textContent = guardar;
  b.onclick = async () => {
    b.disabled = true;
    try { await onGuardar(); M.hide(); } catch (e) { toast(e.message, 'error'); }
    b.disabled = false;
  };
  M.show();
}
async function confirmar(msg) { return window.confirm(msg); }

/* ---------- Arranque ---------- */
(async () => {
  ME = await api('/api/auth/me').catch(() => null);
  if (!ME || ME.tipo !== 'staff') { location.href = '/login.html'; return; }
  M = new bootstrap.Modal($('#modal'));
  $('#logo').innerHTML = LOGO_SVG + '<span class="logo-texto">Natyfarma<small>Panel de gestión</small></span>';
  $('#quien').innerHTML = `<strong>${esc(ME.nombre)}</strong>${esc(nombreRol(ME.rol))}`;
  $('#menu').innerHTML = Object.entries(VISTAS).filter(([k]) => permitido(k)).map(([k, v]) => `<button type="button" data-v="${k}">${v.t}</button>`).join('');
  $('#menu').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) location.hash = b.dataset.v; });
  $('#salir').addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST' }); location.href = '/index.html'; });
  window.addEventListener('hashchange', mostrar);
  mostrar();
})();

async function mostrar() {
  M?.hide();                                   // al cambiar de sección se cierra cualquier ventana abierta
  let id = location.hash.slice(1) || 'inicio';
  if (!VISTAS[id] || !permitido(id)) id = 'inicio';
  $$('#menu button').forEach((b) => b.classList.toggle('activo', b.dataset.v === id));
  const el = $('#contenido');
  el.innerHTML = '<div class="vista"><p class="text-secondary">Cargando…</p></div>';
  const vista = el.firstElementChild;
  try { await VISTAS[id].fn(vista); } catch (e) { vista.innerHTML = `<div class="alert alert-danger">${esc(e.message)}</div>`; }
  window.scrollTo(0, 0);
}
const recargar = () => mostrar();

/* ---------- Inicio ---------- */
async function vInicio(el) {
  const d = await A('/dashboard');
  const ve = puede('ventas') || puede('historial'), st = puede('inventario') || puede('productos');
  el.innerHTML = encabezado(`Hola, ${esc(ME.nombre.split(' ')[0])}`) + `
    <div class="metricas">
      ${ve ? `<div class="metrica"><div class="valor">${soles(d.ventasHoy.total)}</div><div class="nombre">Ventas de hoy (${d.ventasHoy.cantidad})</div></div>` : ''}
      <div class="metrica"><div class="valor">${d.productos}</div><div class="nombre">Productos activos</div></div>
      ${st ? `<div class="metrica ${d.stockBajo.length ? 'alerta' : ''}"><div class="valor">${d.stockBajo.length}</div><div class="nombre">Productos con stock bajo</div></div>` : ''}
      ${puede('mensajes') ? `<div class="metrica"><div class="valor">${d.mensajesNuevos}</div><div class="nombre">Mensajes sin leer</div></div>` : ''}
    </div>
    ${st ? `<div class="caja-panel"><h2>Stock bajo</h2>${tabla(['Producto', 'Stock', 'Mínimo'], d.stockBajo.map((p) => [esc(p.nombre), `<strong class="text-danger">${p.stock}</strong>`, p.stock_minimo]), '¡Todo en orden! No hay productos con stock bajo.')}</div>` : ''}`;
}

/* ---------- Punto de venta ---------- */
async function vVentas(el) {
  const prods = (await A('/productos')).filter((p) => p.activo);
  let car = [], q = '';
  el.innerHTML = encabezado('Nueva venta') + `
  <div class="pos">
    <div class="caja-panel"><label class="visually-hidden" for="q">Buscar producto</label>
      <input id="q" class="form-control mb-3" type="search" placeholder="Buscar producto…" autocomplete="off"><div class="lista-pos" id="lp"></div></div>
    <div class="caja-panel carrito"><h2>Venta actual</h2><div id="car"></div>
      <div class="total"><span>Total</span><span id="tot">S/ 0.00</span></div>
      <div class="row g-2 mb-3">
        ${campo('v-cli', 'Cliente (opcional)', '', 'maxlength="100"', 12)}
        ${campo('v-doc', 'DNI (opcional)', '', 'maxlength="15" inputmode="numeric"', 6)}
        <div class="col-6"><label class="form-label" for="v-pago">Pago</label><select id="v-pago" class="form-select"><option value="efectivo">Efectivo</option><option value="yape">Yape</option><option value="plin">Plin</option><option value="tarjeta">Tarjeta</option></select></div>
      </div>
      <button class="btn btn-natyfarma w-100" id="cobrar" type="button">Cobrar y descargar boleta</button></div>
  </div>`;
  const total = () => car.reduce((s, i) => s + Math.round(i.p.precio * 100) * i.n, 0) / 100;
  function pintarLista() {
    const t = q.toLowerCase();
    $('#lp').innerHTML = prods.filter((p) => !t || p.nombre.toLowerCase().includes(t)).map((p) =>
      `<button class="item-pos" type="button" data-id="${p.id}" ${p.stock < 1 ? 'disabled' : ''}><div class="n">${esc(p.nombre)}</div><div class="s">${p.stock < 1 ? 'Sin stock' : 'Stock: ' + p.stock}</div><div class="p">${soles(p.precio)}</div></button>`).join('') || '<p class="text-secondary">Sin resultados.</p>';
  }
  function pintarCarro() {
    $('#car').innerHTML = car.length ? car.map((i) => `<div class="linea"><div class="nom">${esc(i.p.nombre)}<br><small class="text-secondary">${soles(i.p.precio)} c/u</small></div>
      <div class="cant"><button type="button" data-d="-1" data-id="${i.p.id}" aria-label="Quitar uno">−</button><strong>${i.n}</strong><button type="button" data-d="1" data-id="${i.p.id}" aria-label="Agregar uno">+</button></div></div>`).join('')
      : '<p class="text-secondary">Toca un producto para agregarlo.</p>';
    $('#tot').textContent = soles(total());
  }
  pintarLista(); pintarCarro();
  $('#q').addEventListener('input', (e) => { q = e.target.value.trim(); pintarLista(); });
  const cambiar = (id, d) => {
    const p = prods.find((x) => x.id === id); let i = car.find((x) => x.p.id === id);
    if (!i && d > 0) car.push((i = { p, n: 0 }));
    if (!i) return;
    if (d > 0 && i.n >= p.stock) return toast(`Solo quedan ${p.stock} unidades de ${p.nombre}.`, 'error');
    i.n += d; car = car.filter((x) => x.n > 0); pintarCarro();
  };
  $('#lp').addEventListener('click', (e) => { const b = e.target.closest('.item-pos'); if (b) cambiar(+b.dataset.id, 1); });
  $('#car').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) cambiar(+b.dataset.id, +b.dataset.d); });
  $('#cobrar').addEventListener('click', async (e) => {
    if (!car.length) return toast('Agrega al menos un producto.', 'error');
    e.target.disabled = true;
    try {
      const r = await A('/ventas', { method: 'POST', body: { items: car.map((i) => ({ producto_id: i.p.id, cantidad: i.n })), cliente_nombre: $('#v-cli').value, cliente_documento: $('#v-doc').value, metodo_pago: $('#v-pago').value } });
      descargarBoleta(r.id);
      toast(`Venta #${r.id} registrada por ${soles(r.total)}. Se descargó la boleta.`);
      vVentas(el);
    } catch (err) { toast(err.message, 'error'); e.target.disabled = false; }
  });
}
function descargarBoleta(id) {
  const a = document.createElement('a');
  a.href = `/api/admin/ventas/${id}/boleta`; a.download = `boleta-${id}.pdf`;
  document.body.append(a); a.click(); a.remove();
}

const ESTADO = { completada: ['Completada', ''], devolucion_parcial: ['Devolución parcial', 'gris'], devuelta: ['Devuelta', 'rojo'] };

async function vHistorial(el) {
  const v = await A('/ventas');
  const dev = puede('devoluciones');
  el.innerHTML = encabezado('Historial de ventas') + `<div class="caja-panel">${tabla(['N°', 'Fecha', 'Cliente', 'Pago', 'Atendió', 'Total', 'Estado', 'Boleta', ''],
    v.map((x) => [x.id, fechaHora(x.fecha), esc(x.cliente_nombre || 'Cliente varios'), chip(x.metodo_pago, 'gris'), esc(x.cajero),
      `<strong>${soles(x.total - x.total_devuelto)}</strong>${x.total_devuelto > 0 ? `<br><small class="text-secondary">de ${soles(x.total)}</small>` : ''}`,
      chip(...ESTADO[x.estado]),
      `<a href="/api/admin/ventas/${x.id}/boleta" download>Descargar</a> · <a href="/api/admin/ventas/${x.id}/boleta?ver=1" target="_blank" rel="noopener">Ver</a>`,
      dev && x.estado !== 'devuelta' ? `<button class="btn btn-sm btn-natyfarma-borde" data-dv="${x.id}" type="button">Devolver</button>` : '']), 'Todavía no hay ventas registradas.')}</div>`;
  el.onclick = (e) => { const b = e.target.closest('[data-dv]'); if (b) formDevolucion(+b.dataset.dv); };
}

// Devolución total o parcial: se elige cuántas unidades de cada producto regresan
async function formDevolucion(id) {
  const v = await A(`/ventas/${id}`);
  const filas = v.detalle.filter((d) => d.cantidad - d.devuelto > 0);
  modal(`Devolución de la venta #${id}`, `
    <p class="text-secondary">Indica cuántas unidades regresan. El stock se repone y el monto se descuenta de los reportes.</p>
    <div class="tabla-wrap"><table class="table align-middle"><thead><tr><th>Producto</th><th>Vendidas</th><th>Precio</th><th style="width:8rem">Devolver</th></tr></thead><tbody>
    ${filas.map((d) => `<tr><td><strong>${esc(d.nombre_producto)}</strong>${d.devuelto ? `<br><small class="text-secondary">Ya devueltas: ${d.devuelto}</small>` : ''}</td><td>${d.cantidad}</td><td class="text-nowrap">${soles(d.precio_unitario)}</td>
      <td><input class="form-control dv-cant" type="number" min="0" max="${d.cantidad - d.devuelto}" value="0" data-p="${d.producto_id}" data-precio="${d.precio_unitario}" aria-label="Unidades a devolver de ${esc(d.nombre_producto)}"></td></tr>`).join('')}
    </tbody></table></div>
    <div class="d-flex justify-content-between align-items-center mb-3"><button class="btn btn-sm btn-natyfarma-borde" id="dv-todo" type="button">Devolver todo</button><strong>Monto a devolver: <span id="dv-total">S/ 0.00</span></strong></div>
    <div class="row g-3">${campo('dv-motivo', 'Motivo', '', 'maxlength="200" placeholder="Ej.: producto vencido, error en la venta"')}</div>`,
    'Registrar devolución', async () => {
      const items = $$('.dv-cant').map((i) => ({ producto_id: +i.dataset.p, cantidad: +i.value })).filter((i) => i.cantidad > 0);
      const r = await A(`/ventas/${id}/devolucion`, { method: 'POST', body: { items, motivo: $('#dv-motivo').value } });
      toast(`Devolución registrada por ${soles(r.total)}. El stock se actualizó.`);
      recargar();
    });
  const sumar = () => { $('#dv-total').textContent = soles($$('.dv-cant').reduce((s, i) => s + Math.round(i.dataset.precio * 100) * (+i.value || 0), 0) / 100); };
  $$('.dv-cant').forEach((i) => i.addEventListener('input', sumar));
  $('#dv-todo').onclick = () => { $$('.dv-cant').forEach((i) => (i.value = i.max)); sumar(); };
}

async function vDevoluciones(el) {
  const d = await A('/devoluciones');
  el.innerHTML = encabezado('Devoluciones') + `<div class="caja-panel">${tabla(['N°', 'Fecha', 'Venta', 'Productos', 'Motivo', 'Registró', 'Monto'],
    d.map((x) => [x.id, fechaHora(x.fecha), `#${x.venta_id}`, esc(x.productos), esc(x.motivo), esc(x.usuario), `<strong class="text-danger">-${soles(x.total)}</strong>`]),
    'Aún no hay devoluciones. Se registran desde el Historial de ventas.')}</div>`;
}

/* ---------- Productos ---------- */
async function vProductos(el) {
  const [prods, cats] = await Promise.all([A('/productos'), A('/categorias')]);
  el.innerHTML = encabezado('Productos', '<button class="btn btn-natyfarma-borde" id="nc" type="button">Nueva categoría</button><button class="btn btn-natyfarma" id="np" type="button">Nuevo producto</button>') +
    `<div class="caja-panel">${tabla(['', 'Producto', 'Categoría', 'Precio', 'Stock', 'Estado', ''], prods.map((p) => [
      p.imagen ? `<img src="${esc(p.imagen)}" alt="" width="44" height="44" style="object-fit:cover;border-radius:8px">` : `<span class="mini-icono">${icono(iconoCategoria(p.categoria, p.icono))}</span>`,
      `<strong>${esc(p.nombre)}</strong>`, esc(p.categoria), soles(p.precio), p.stock <= p.stock_minimo ? `<strong class="text-danger">${p.stock}</strong>` : p.stock,
      p.activo ? chip('Visible') : chip('Oculto', 'gris'), `<button class="btn btn-sm btn-natyfarma-borde" data-e="${p.id}" type="button">Editar</button>`]))}</div>`;
  $('#np').onclick = () => formProducto(null, cats, recargar);
  $('#nc').onclick = () => modal('Nueva categoría', `<div class="row g-3">${campo('f-nom', 'Nombre', '', 'maxlength="60"')}</div><p class="text-secondary small mt-3 mb-0">El ícono se asigna automáticamente según el nombre de la categoría.</p>`, 'Crear categoría',
    async () => { await A('/categorias', { method: 'POST', body: { nombre: $('#f-nom').value } }); toast('Categoría creada.'); recargar(); });
  el.onclick = (e) => { const b = e.target.closest('[data-e]'); if (b) formProducto(prods.find((p) => p.id === +b.dataset.e), cats, recargar); };
}
function formProducto(p, cats, listo) {
  const nuevo = !p;
  p = p || { nombre: '', descripcion: '', precio: '', stock: 0, stock_minimo: 5, categoria_id: cats[0]?.id, activo: 1 };
  modal(nuevo ? 'Nuevo producto' : 'Editar producto', `<div class="row g-3">
    ${campo('f-nombre', 'Nombre', p.nombre, 'maxlength="120"')}
    <div class="col-12"><label class="form-label" for="f-desc">Descripción</label><textarea class="form-control" id="f-desc" rows="2" maxlength="300">${esc(p.descripcion)}</textarea></div>
    ${campo('f-precio', 'Precio (S/)', p.precio, 'type="number" step="0.01" min="0"', 6)}
    <div class="col-6"><label class="form-label" for="f-cat">Categoría</label><select class="form-select" id="f-cat">${opciones(cats, p.categoria_id)}</select></div>
    ${nuevo ? campo('f-stock', 'Stock inicial', 0, 'type="number" min="0"', 6) : ''}
    ${campo('f-min', 'Avisar cuando quede', p.stock_minimo, 'type="number" min="0"', 6)}
    <div class="col-6"><label class="form-label" for="f-act">En el catálogo</label><select class="form-select" id="f-act"><option value="1" ${p.activo ? 'selected' : ''}>Visible</option><option value="0" ${p.activo ? '' : 'selected'}>Oculto</option></select></div>
    <div class="col-12"><label class="form-label" for="f-img">Foto (opcional, JPG, PNG o WEBP, máx. 3 MB)</label><input class="form-control" id="f-img" type="file" accept="image/jpeg,image/png,image/webp"></div>
    ${nuevo ? '' : '<p class="text-secondary small mb-0">Para cambiar el stock usa la sección Inventario.</p>'}</div>`, 'Guardar', async () => {
    const fd = new FormData();
    fd.append('nombre', $('#f-nombre').value); fd.append('descripcion', $('#f-desc').value); fd.append('precio', $('#f-precio').value);
    fd.append('categoria_id', $('#f-cat').value); fd.append('stock_minimo', $('#f-min').value); fd.append('activo', $('#f-act').value);
    if (nuevo) fd.append('stock', $('#f-stock').value);
    const f = $('#f-img').files[0]; if (f) fd.append('imagen', f);
    await A(nuevo ? '/productos' : `/productos/${p.id}`, { method: nuevo ? 'POST' : 'PUT', body: fd });
    toast('Producto guardado.'); listo();
  });
}

/* ---------- Ofertas ---------- */
async function vOfertas(el) {
  const [of, prods] = await Promise.all([A('/ofertas'), A('/productos')]);
  el.innerHTML = encabezado('Ofertas para clientes registrados', '<button class="btn btn-natyfarma" id="no" type="button">Nueva oferta</button>') +
    `<div class="caja-panel">${tabla(['Producto', 'Oferta', 'Descuento', 'Vigencia', 'Estado', ''], of.map((o) => [
      `<strong>${esc(o.producto)}</strong>`, esc(o.titulo), `${o.descuento}%`, `${String(o.fecha_inicio).slice(0, 10)} al ${String(o.fecha_fin).slice(0, 10)}`,
      o.activa ? chip('Activa') : chip('Pausada', 'gris'),
      `<button class="btn btn-sm btn-natyfarma-borde" data-t="${o.id}" data-a="${o.activa ? 0 : 1}" type="button">${o.activa ? 'Pausar' : 'Activar'}</button> <button class="btn btn-sm btn-outline-danger" data-x="${o.id}" type="button">Eliminar</button>`]), 'Aún no hay ofertas.')}</div>`;
  $('#no').onclick = () => modal('Nueva oferta', `<div class="row g-3">
    <div class="col-12"><label class="form-label" for="o-p">Producto</label><select class="form-select" id="o-p">${opciones(prods.filter((p) => p.activo), 0)}</select></div>
    ${campo('o-t', 'Título', 'Oferta exclusiva para clientes registrados', 'maxlength="100"')}
    ${campo('o-d', 'Descuento (%)', 10, 'type="number" min="1" max="90"', 4)}
    ${campo('o-i', 'Desde', hoy(), 'type="date"', 4)}${campo('o-f', 'Hasta', sumaDias(30), 'type="date"', 4)}</div>`, 'Crear oferta',
    async () => { await A('/ofertas', { method: 'POST', body: { producto_id: $('#o-p').value, titulo: $('#o-t').value, descuento: $('#o-d').value, fecha_inicio: $('#o-i').value, fecha_fin: $('#o-f').value } }); toast('Oferta creada.'); recargar(); });
  el.onclick = async (e) => {
    const t = e.target.closest('[data-t]'), x = e.target.closest('[data-x]');
    try {
      if (t) { await A(`/ofertas/${t.dataset.t}`, { method: 'PUT', body: { activa: t.dataset.a === '1' } }); recargar(); }
      if (x && await confirmar('¿Eliminar esta oferta?')) { await A(`/ofertas/${x.dataset.x}`, { method: 'DELETE' }); recargar(); }
    } catch (err) { toast(err.message, 'error'); }
  };
}

/* ---------- Inventario ---------- */
async function vInventario(el) {
  const [prods, mov] = await Promise.all([A('/productos'), A('/inventario/movimientos')]);
  el.innerHTML = encabezado('Inventario', '<button class="btn btn-natyfarma" id="nm" type="button">Registrar movimiento</button>') +
    `<div class="caja-panel"><h2>Existencias</h2>${tabla(['Producto', 'Categoría', 'Stock', 'Mínimo', 'Estado'], prods.filter((p) => p.activo).map((p) => [
      `<strong>${esc(p.nombre)}</strong>`, esc(p.categoria), p.stock, p.stock_minimo, p.stock <= p.stock_minimo ? chip(p.stock === 0 ? 'Agotado' : 'Stock bajo', 'rojo') : chip('Normal')]))}</div>
    <div class="caja-panel"><h2>Últimos movimientos</h2>${tabla(['Fecha', 'Producto', 'Tipo', 'Cant.', 'Motivo', 'Registró'], mov.map((m) => [
      fechaHora(m.fecha), esc(m.producto), m.tipo === 'entrada' ? chip('Entrada') : chip('Salida', 'rojo'), m.cantidad, esc(m.motivo || ''), esc(m.usuario || '—')]))}</div>`;
  $('#nm').onclick = () => modal('Registrar movimiento', `<div class="row g-3">
    <div class="col-12"><label class="form-label" for="m-p">Producto</label><select class="form-select" id="m-p">${opciones(prods.filter((p) => p.activo), 0)}</select></div>
    <div class="col-6"><label class="form-label" for="m-t">Tipo</label><select class="form-select" id="m-t"><option value="entrada">Entrada (ingreso de mercadería)</option><option value="salida">Salida (merma, vencido, ajuste)</option></select></div>
    ${campo('m-c', 'Cantidad', 1, 'type="number" min="1"', 6)}${campo('m-m', 'Motivo (opcional)', '', 'maxlength="160"')}</div>`, 'Registrar',
    async () => { await A('/inventario/movimientos', { method: 'POST', body: { producto_id: $('#m-p').value, tipo: $('#m-t').value, cantidad: $('#m-c').value, motivo: $('#m-m').value } }); toast('Movimiento registrado.'); recargar(); });
}

/* ---------- Reportes ---------- */
async function vReportes(el) {
  el.innerHTML = encabezado('Reportes') + `
    <div class="caja-panel"><div class="row g-2 align-items-end">${campo('r-d', 'Desde', sumaDias(-30), 'type="date"', 5)}${campo('r-h', 'Hasta', hoy(), 'type="date"', 5)}
      <div class="col-2"><button class="btn btn-natyfarma w-100" id="r-ok" type="button">Ver</button></div></div></div><div id="rep"></div>`;
  async function cargar() {
    const [r, inv] = await Promise.all([A(`/reportes/ventas?desde=${$('#r-d').value}&hasta=${$('#r-h').value}`), A('/reportes/inventario')]);
    const valor = inv.reduce((s, i) => s + i.valor, 0);
    $('#rep').innerHTML = `
      <div class="metricas"><div class="metrica"><div class="valor">${soles(r.resumen.total)}</div><div class="nombre">Ventas netas del periodo</div></div>
        <div class="metrica"><div class="valor">${r.resumen.cantidad}</div><div class="nombre">Boletas emitidas</div></div>
        <div class="metrica ${r.resumen.devuelto > 0 ? 'alerta' : ''}"><div class="valor">${soles(r.resumen.devuelto)}</div><div class="nombre">Devoluciones del periodo</div></div>
        <div class="metrica"><div class="valor">${soles(valor)}</div><div class="nombre">Valor del inventario (a precio de venta)</div></div></div>
      <div class="caja-panel"><h2>Ventas por día</h2>${tabla(['Día', 'Ventas', 'Total'], r.porDia.map((d) => [d.dia, d.ventas, soles(d.total)]), 'No hay ventas en este periodo.')}</div>
      <div class="caja-panel"><h2>Productos más vendidos</h2>${tabla(['Producto', 'Unidades', 'Total'], r.top.map((t) => [esc(t.producto), t.unidades, soles(t.total)]), 'Sin datos en este periodo.')}</div>
      <div class="caja-panel"><h2>Por método de pago</h2>${tabla(['Método', 'Ventas', 'Total'], r.porMetodo.map((m) => [esc(m.metodo), m.ventas, soles(m.total)]), 'Sin datos en este periodo.')}</div>
      <div class="caja-panel"><h2>Estado del inventario</h2>${tabla(['Producto', 'Categoría', 'Stock', 'Mínimo', 'Valor'], inv.map((i) => [esc(i.nombre), esc(i.categoria), i.stock <= i.stock_minimo ? `<strong class="text-danger">${i.stock}</strong>` : i.stock, i.stock_minimo, soles(i.valor)]))}</div>`;
  }
  $('#r-ok').onclick = () => cargar().catch((e) => toast(e.message, 'error'));
  await cargar();
}

/* ---------- Clientes y mensajes ---------- */
async function vClientes(el) {
  const c = await A('/clientes');
  el.innerHTML = encabezado('Clientes') + `
    <div class="caja-panel"><h2>Clientes atendidos en caja</h2>${tabla(['Cliente', 'DNI', 'Compras', 'Total comprado', 'Última compra'], c.atendidos.map((x) => [esc(x.nombre), esc(x.documento || '—'), x.compras, soles(x.total), fechaHora(x.ultima)]), 'Aún no hay clientes registrados en las ventas.')}</div>
    <div class="caja-panel"><h2>Cuentas creadas en la web</h2>${tabla(['Nombre', 'Correo', 'Teléfono', 'Registro'], c.registrados.map((x) => [esc(x.nombres), esc(x.correo), esc(x.telefono || '—'), fechaHora(x.creado_en)]), 'Nadie se ha registrado todavía.')}</div>`;
}

async function vMensajes(el) {
  const m = await A('/mensajes');
  el.innerHTML = encabezado('Mensajes de contacto') + `<div class="caja-panel">${tabla(['Fecha', 'Nombre', 'Correo', 'Mensaje', ''], m.map((x) => [
    fechaHora(x.fecha), esc(x.nombre), `<a href="mailto:${esc(x.correo)}">${esc(x.correo)}</a>`, `<div style="max-width:380px">${esc(x.mensaje)}</div>`,
    x.leido ? chip('Leído', 'gris') : `<button class="btn btn-sm btn-natyfarma-borde" data-l="${x.id}" type="button">Marcar leído</button>`]), 'No hay mensajes.')}</div>`;
  el.onclick = async (e) => { const b = e.target.closest('[data-l]'); if (b) { await A(`/mensajes/${b.dataset.l}/leido`, { method: 'PUT' }); recargar(); } };
}

/* ---------- Usuarios y datos del negocio ---------- */
async function vUsuarios(el) {
  const [us, { roles }] = await Promise.all([A('/usuarios'), A('/roles')]);
  el.innerHTML = encabezado('Usuarios del personal', '<button class="btn btn-natyfarma" id="nu" type="button">Nuevo usuario</button>') +
    `<div class="caja-panel">${tabla(['Nombre', 'Usuario', 'Rol', 'Estado', ''], us.map((u) => [`<strong>${esc(u.nombres)}</strong>`, esc(u.usuario), esc(nombreRol(u.rol)),
      u.activo ? chip('Activo') : chip('Inactivo', 'gris'), `<button class="btn btn-sm btn-natyfarma-borde" data-e="${u.id}" type="button">Editar</button>`]))}</div>`;
  const form = (u) => {
    const nuevo = !u; u = u || { nombres: '', usuario: '', rol_id: roles.find((r) => r.nombre === 'cajero')?.id, activo: 1 };
    modal(nuevo ? 'Nuevo usuario' : 'Editar usuario', `<div class="row g-3">
      ${campo('u-n', 'Nombre completo', u.nombres, 'maxlength="100"')}
      ${nuevo ? campo('u-u', 'Usuario (para ingresar)', '', 'maxlength="40" autocapitalize="none"', 6) : `<div class="col-6"><label class="form-label">Usuario</label><input class="form-control" value="${esc(u.usuario)}" disabled></div>`}
      <div class="col-6"><label class="form-label" for="u-r">Rol</label><select class="form-select" id="u-r">${roles.map((r) => `<option value="${r.id}" ${r.id == u.rol_id ? 'selected' : ''}>${esc(nombreRol(r.nombre))}</option>`).join('')}</select></div>
      ${campo('u-p', nuevo ? 'Contraseña (mín. 6)' : 'Nueva contraseña (déjala vacía para no cambiarla)', '', 'type="password" autocomplete="new-password"', 8)}
      <div class="col-4"><label class="form-label" for="u-a">Estado</label><select class="form-select" id="u-a"><option value="1" ${u.activo ? 'selected' : ''}>Activo</option><option value="0" ${u.activo ? '' : 'selected'}>Inactivo</option></select></div></div>`, 'Guardar', async () => {
      const b = { nombres: $('#u-n').value, rol_id: $('#u-r').value, activo: $('#u-a').value === '1', password: $('#u-p').value };
      if (nuevo) await A('/usuarios', { method: 'POST', body: { ...b, usuario: $('#u-u').value } });
      else await A(`/usuarios/${u.id}`, { method: 'PUT', body: b });
      toast('Usuario guardado.'); recargar();
    });
  };
  $('#nu').onclick = () => form(null);
  el.onclick = (e) => { const b = e.target.closest('[data-e]'); if (b) form(us.find((u) => u.id === +b.dataset.e)); };
}

/* ---------- Roles: el administrador crea roles y elige sus módulos ---------- */
async function vRoles(el) {
  const { modulos, roles } = await A('/roles');
  const chips = (r) => r.nombre === 'administrador' ? chip('Acceso total') : r.permisos.map((m) => chip(modulos[m], 'gris')).join(' ');
  el.innerHTML = encabezado('Roles y permisos', '<button class="btn btn-natyfarma" id="nr" type="button">Nuevo rol</button>') +
    `<p class="text-secondary">Cada rol define qué módulos del panel puede usar. Administrador y Cajero son los roles base del sistema; puedes crear otros, por ejemplo «Almacenero» con acceso solo a Inventario.</p>
    <div class="caja-panel">${tabla(['Rol', 'Módulos permitidos', 'Usuarios', ''], roles.map((r) => [
      `<strong>${esc(nombreRol(r.nombre))}</strong>${r.base ? '<br><small class="text-secondary">Rol base</small>' : ''}`,
      `<div class="d-flex flex-wrap gap-1">${chips(r)}</div>`, r.usuarios,
      r.nombre === 'administrador' ? '' : `<div class="d-flex gap-2"><button class="btn btn-sm btn-natyfarma-borde" data-e="${r.id}" type="button">Editar</button>${r.base ? '' : `<button class="btn btn-sm btn-outline-danger" data-x="${r.id}" type="button">Eliminar</button>`}</div>`]))}</div>`;

  const form = (r) => {
    const nuevo = !r; r = r || { nombre: '', permisos: [], base: 0 };
    modal(nuevo ? 'Nuevo rol' : `Editar rol: ${nombreRol(r.nombre)}`, `<div class="row g-3">
      ${r.base ? '' : campo('r-n', 'Nombre del rol', nombreRol(r.nombre), 'maxlength="30" placeholder="Ej.: Almacenero"')}
      <div class="col-12"><span class="form-label d-block">Módulos que puede usar</span>
        <div class="permisos">${Object.entries(modulos).map(([k, t]) => `<label class="permiso"><input type="checkbox" value="${k}" ${r.permisos.includes(k) ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></div></div>`,
      'Guardar', async () => {
        const body = { nombre: r.base ? r.nombre : $('#r-n').value, permisos: $$('.permisos input:checked').map((i) => i.value) };
        await A(nuevo ? '/roles' : `/roles/${r.id}`, { method: nuevo ? 'POST' : 'PUT', body });
        toast('Rol guardado.'); recargar();
      });
  };
  $('#nr').onclick = () => form(null);
  el.onclick = async (e) => {
    const ed = e.target.closest('[data-e]'), x = e.target.closest('[data-x]');
    if (ed) form(roles.find((r) => r.id === +ed.dataset.e));
    if (x && await confirmar('¿Eliminar este rol?')) {
      try { await A(`/roles/${x.dataset.x}`, { method: 'DELETE' }); toast('Rol eliminado.'); recargar(); } catch (err) { toast(err.message, 'error'); }
    }
  };
}

async function vConfig(el) {
  const c = await api('/api/config');
  el.innerHTML = encabezado('Datos del negocio') + `<div class="caja-panel" style="max-width:640px"><form id="fc" class="row g-3">
    ${campo('c-telefono', 'Teléfono / WhatsApp (ej. 987654321)', c.telefono, 'inputmode="tel" maxlength="30"')}
    <p class="text-secondary small mb-0">Con este número aparece el botón de WhatsApp en la web. Si lo dejas vacío, el botón y el teléfono se ocultan.</p>
    ${campo('c-correo', 'Correo de contacto', c.correo, 'type="email"')}
    ${campo('c-direccion', 'Dirección', c.direccion)}${campo('c-horario', 'Horario de atención', c.horario)}
    ${campo('c-facebook', 'Facebook (enlace, opcional)', c.facebook)}${campo('c-instagram', 'Instagram (enlace, opcional)', c.instagram)}${campo('c-tiktok', 'TikTok (enlace, opcional)', c.tiktok)}
    <div class="col-12"><button class="btn btn-natyfarma" type="submit">Guardar cambios</button></div></form></div>`;
  $('#fc').onsubmit = async (e) => {
    e.preventDefault();
    const b = {}; ['telefono', 'correo', 'direccion', 'horario', 'facebook', 'instagram', 'tiktok'].forEach((k) => (b[k] = $('#c-' + k).value));
    try { await A('/config', { method: 'PUT', body: b }); toast('Datos guardados. Ya se ven en la web.'); } catch (err) { toast(err.message, 'error'); }
  };
}
