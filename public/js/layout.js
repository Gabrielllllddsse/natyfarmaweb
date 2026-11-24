// Cabecera, pie de página y botón de contacto (se repiten en todas las páginas públicas)
(() => {
  const pagina = document.body.dataset.page;
  const activo = (p) => (p === pagina ? ' active" aria-current="page' : '');

  NF.listo = Promise.all([
    api('/api/config').catch(() => ({})),
    api('/api/auth/me').catch(() => null)
  ]).then(([config, user]) => {
    NF.config = config; NF.user = user;
    pintar();
  });

  const LOGO = (sub) => `${LOGO_SVG}<span class="logo-texto">Natyfarma<small>${sub}</small></span>`;

  function pintar() {
    const c = NF.config, u = NF.user;
    const mapaUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((c.direccion || '') + ', Perú');
    NF.mapaUrl = mapaUrl;

    const cuenta = u
      ? `<span class="saludo">Hola, ${esc(u.nombre.split(' ')[0])}</span>
         ${u.tipo === 'staff' ? '<a class="btn btn-sm btn-natyfarma" href="/panel/">Ir al panel</a>' : ''}
         <button class="btn btn-sm btn-natyfarma-borde" id="btn-salir" type="button">Salir</button>`
      : `<a class="btn btn-sesion${pagina === 'login' ? ' active' : ''}" href="login.html">${icono('usuario')}Iniciar sesión</a>`;

    const superior = [
      c.horario && `<span>${icono('reloj')}${esc(c.horario)}</span>`,
      c.direccion && `<span class="d-none d-md-inline-flex">${icono('ubicacion')}${esc(c.direccion)}</span>`,
      c.telefono && `<span class="d-none d-sm-inline-flex">${icono('telefono')}${esc(c.telefono)}</span>`
    ].filter(Boolean).join('');

    $('#cabecera').outerHTML = `
    ${superior ? `<div class="barra-superior"><div class="container">${superior}</div></div>` : ''}
    <header class="cabecera">
      <nav class="navbar navbar-expand-lg" aria-label="Principal">
        <div class="container">
          <a class="logo" href="index.html" aria-label="Natyfarma, inicio">${LOGO('Botica · Huancayo')}</a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#menu" aria-controls="menu" aria-expanded="false" aria-label="Abrir menú"><span class="navbar-toggler-icon"></span></button>
          <div class="collapse navbar-collapse" id="menu">
            <ul class="navbar-nav mx-lg-auto">
              <li class="nav-item"><a class="nav-link${activo('inicio')}" href="index.html">Inicio</a></li>
              <li class="nav-item"><a class="nav-link${activo('nosotros')}" href="nosotros.html">Nosotros</a></li>
              <li class="nav-item"><a class="nav-link${activo('productos')}" href="productos.html">Productos</a></li>
              <li class="nav-item"><a class="nav-link${activo('contacto')}" href="contacto.html">Contacto</a></li>
            </ul>
            <div class="cuenta">${cuenta}</div>
          </div>
        </div>
      </nav>
    </header>`;

    const redes = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['tiktok', 'TikTok']]
      .filter(([k]) => c[k]).map(([k, n]) => `<li><a href="${esc(c[k])}" target="_blank" rel="noopener">${n}</a></li>`).join('');

    $('#pie').outerHTML = `
    <footer class="pie">
      <div class="container">
        <div class="columnas">
          <div class="marca">
            <a class="logo" href="index.html" aria-label="Natyfarma, inicio">${LOGO('Botica · Huancayo')}</a>
            <p>Tu botica de confianza en Huancayo. Medicamentos, cuidado personal y bienestar con atención cercana y profesional.</p>
          </div>
          <div><h3>Visítanos</h3><ul>
            ${c.direccion ? `<li>${icono('ubicacion')}<span>${esc(c.direccion)}</span></li>` : ''}
            ${c.horario ? `<li>${icono('reloj')}<span>${esc(c.horario)}</span></li>` : ''}
            ${c.telefono ? `<li>${icono('telefono')}<span>${esc(c.telefono)}</span></li>` : ''}
            ${c.correo ? `<li>${icono('correo')}<span>${esc(c.correo)}</span></li>` : ''}</ul></div>
          <div><h3>Explora</h3><ul>
            <li><a href="productos.html">Productos</a></li><li><a href="nosotros.html">Nosotros</a></li>
            <li><a href="contacto.html">Contacto</a></li><li><a href="login.html">Iniciar sesión</a></li></ul></div>
          <div><h3>Síguenos</h3><ul>
            ${redes || '<li>Próximamente en redes sociales</li>'}
            <li><a href="${mapaUrl}" target="_blank" rel="noopener">Cómo llegar</a></li></ul></div>
        </div>
        <div class="legal">
          <span>© ${new Date().getFullYear()} Natyfarma. Todos los derechos reservados.</span>
          <span>Precios referenciales. Venta en tienda.</span>
        </div>
      </div>
    </footer>`;

    if (c.telefono) {
      const a = document.createElement('a');
      a.className = 'whatsapp-flotante';
      a.href = 'https://wa.me/' + numeroWA(c.telefono) + '?text=' + encodeURIComponent('Hola Natyfarma, quisiera hacer una consulta.');
      a.target = '_blank'; a.rel = 'noopener';
      a.setAttribute('aria-label', 'Escríbenos por WhatsApp');
      a.innerHTML = icono('chat') + '<span>¿Conversamos?</span>';
      document.body.append(a);
    }

    pintarIconos();
    $('#btn-salir')?.addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST' }); location.href = 'index.html'; });
  }
})();
