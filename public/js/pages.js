// Lógica de cada página pública. Se activa según <body data-page="...">
(async () => {
  await NF.listo;
  const c = NF.config;
  $$('[data-cfg]').forEach((el) => (el.textContent = c[el.dataset.cfg] || ''));
  $$('[data-mapa]').forEach((el) => (el.href = NF.mapaUrl));

  const paginas = { inicio, nosotros, productos, contacto, login };
  paginas[document.body.dataset.page]?.();

  /* ---------- Inicio ---------- */
  async function inicio() {
    const cats = await api('/api/categorias');
    $('#rejilla-categorias').removeAttribute('aria-busy');
    $('#rejilla-categorias').innerHTML = cats.map((k) => `
      <a class="tarjeta-categoria" href="productos.html?cat=${k.id}">
        <span class="icono">${icono(iconoCategoria(k.nombre, k.icono))}</span>
        <h3>${esc(k.nombre)}</h3><p>${esc(k.descripcion || '')}</p><span class="ver">Ver productos ${icono('flecha')}</span>
      </a>`).join('');
  }

  /* ---------- Nosotros: tarjetas 3D (tocar o presionar Enter para girar) ---------- */
  function nosotros() {
    $$('.tarjeta-giro').forEach((t) => {
      const girar = () => t.classList.toggle('girada');
      t.addEventListener('click', girar);
      t.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); girar(); } });
    });
  }

  /* ---------- Catálogo ---------- */
  async function productos() {
    const [cats, lista] = await Promise.all([api('/api/categorias'), api('/api/productos')]);
    const ofertas = {};
    if (NF.user) {
      try { (await api('/api/ofertas')).forEach((o) => (ofertas[o.producto_id] = o)); } catch { /* sin ofertas */ }
    } else {
      $('#aviso-ofertas').innerHTML = `<div class="aviso-ofertas">${icono('etiqueta')}<p class="mb-0"><strong>Ofertas exclusivas:</strong> <a href="login.html">crea tu cuenta gratis o inicia sesión</a> para ver los descuentos para clientes registrados.</p></div>`;
    }
    let cat = Number(new URLSearchParams(location.search).get('cat')) || 0;
    let texto = '';

    const precioFinal = (p) => { const o = ofertas[p.id]; return o ? Math.round(p.precio * (100 - o.descuento)) / 100 : p.precio; };
    const precioHtml = (p) => ofertas[p.id]
      ? `<span class="precio-antes">${soles(p.precio)}</span>${soles(precioFinal(p))}` : soles(p.precio);

    function filtros() {
      $('#filtros').innerHTML = [{ id: 0, nombre: 'Todos' }, ...cats].map((k) =>
        `<button type="button" data-id="${k.id}" class="${k.id === cat ? 'activo' : ''}" aria-pressed="${k.id === cat}">${esc(k.nombre)}</button>`).join('');
    }
    function lista_() {
      const t = texto.toLowerCase();
      const items = lista.filter((p) => (!cat || p.categoria_id === cat) && (!t || p.nombre.toLowerCase().includes(t)));
      $('#rejilla-productos').removeAttribute('aria-busy');
      $('#rejilla-productos').innerHTML = items.length ? items.map((p) => `
        <button class="tarjeta-producto" type="button" data-id="${p.id}">
          <div class="media">${p.imagen ? `<img src="${esc(p.imagen)}" alt="" loading="lazy">` : icono(iconoCategoria(p.categoria, p.icono))}
            ${ofertas[p.id] ? `<span class="insignia-oferta">-${ofertas[p.id].descuento}%</span>` : ''}</div>
          <div class="cuerpo"><h3>${esc(p.nombre)}</h3><span class="cat">${esc(p.categoria)}</span>
            <span class="precio">${precioHtml(p)}</span>${p.disponible ? '' : '<span class="agotado">Agotado por ahora</span>'}</div>
        </button>`).join('') : '<p class="vacio">No encontramos productos con esa búsqueda. Prueba con otra palabra o elige otra categoría.</p>';
    }
    filtros(); lista_();

    $('#filtros').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      cat = Number(b.dataset.id); filtros(); lista_();
    });
    $('#buscar').addEventListener('input', (e) => { texto = e.target.value.trim(); lista_(); });

    const modal = new bootstrap.Modal($('#modal-producto'));
    $('#rejilla-productos').addEventListener('click', (e) => {
      const b = e.target.closest('.tarjeta-producto'); if (!b) return;
      const p = lista.find((x) => x.id === Number(b.dataset.id));
      $('#mp-titulo').textContent = p.nombre;
      const wa = c.telefono ? `<a class="btn btn-natyfarma mt-3" target="_blank" rel="noopener" href="https://wa.me/${numeroWA(c.telefono)}?text=${encodeURIComponent('Hola Natyfarma, quiero consultar por: ' + p.nombre)}">Consultar por WhatsApp</a>` : '';
      $('#mp-cuerpo').innerHTML = `
        <div class="media-grande mb-3">${p.imagen ? `<img src="${esc(p.imagen)}" alt="${esc(p.nombre)}">` : icono(iconoCategoria(p.categoria, p.icono))}</div>
        <p class="mb-1 text-secondary">${esc(p.categoria)}</p>
        <p>${esc(p.descripcion || 'Consulta con nuestro personal para más información.')}</p>
        ${ofertas[p.id] ? `<p class="mb-1"><span class="chip">${esc(ofertas[p.id].titulo)}</span></p>` : ''}
        <p class="fs-3 precio mb-1">${precioHtml(p)}</p>
        <p class="${p.disponible ? 'text-success' : 'text-danger'} fw-semibold mb-0">${p.disponible ? 'Disponible en tienda' : 'Agotado por ahora'}</p>${wa}`;
      modal.show();
    });
  }

  /* ---------- Contacto ---------- */
  function contacto() {
    const filas = [['ubicacion', 'Dirección', c.direccion], ['reloj', 'Horario', c.horario], ['telefono', 'Teléfono', c.telefono], ['correo', 'Correo', c.correo]].filter((f) => f[2]);
    $('#datos-contacto').innerHTML = filas.map(([i, r, v]) => `<li><span class="icono">${icono(i)}</span><div><span class="rotulo">${r}</span>${esc(v)}</div></li>`).join('');
    $('#mapa').src = 'https://maps.google.com/maps?q=' + encodeURIComponent((c.direccion || '') + ', Perú') + '&output=embed';
    $('#form-contacto').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, btn = f.querySelector('button'); btn.disabled = true;
      try {
        await api('/api/mensajes', { method: 'POST', body: { nombre: f.nombre.value, correo: f.correo.value, mensaje: f.mensaje.value } });
        toast('¡Gracias! Recibimos tu mensaje y te responderemos pronto.'); f.reset();
      } catch (err) { toast(err.message, 'error'); }
      btn.disabled = false;
    });
  }

  /* ---------- Acceso ---------- */
  function login() {
    if (NF.user) { location.href = NF.user.tipo === 'staff' ? '/panel/' : 'productos.html'; return; }
    const entrar = (r) => { location.href = r.tipo === 'staff' ? '/panel/' : 'productos.html'; };
    $('#form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      try { entrar(await api('/api/auth/login', { method: 'POST', body: { usuario: $('#l-usuario').value, password: $('#l-clave').value } })); }
      catch (err) { toast(err.message, 'error'); }
    });
    $('#form-registro').addEventListener('submit', async (e) => {
      e.preventDefault();
      try { entrar(await api('/api/auth/registro', { method: 'POST', body: { nombres: $('#r-nombres').value, correo: $('#r-correo').value, telefono: $('#r-tel').value, password: $('#r-clave').value } })); }
      catch (err) { toast(err.message, 'error'); }
    });
  }
})();
