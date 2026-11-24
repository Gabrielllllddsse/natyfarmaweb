// Utilidades compartidas por el sitio público y el panel
window.NF = { config: {}, user: null };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// Montos en soles con separador de miles: S/ 7,564.80
const soles = (n) => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(url, opts = {}) {
  const o = { credentials: 'same-origin', ...opts };
  if (o.body && !(o.body instanceof FormData)) {
    o.headers = { 'Content-Type': 'application/json', ...(o.headers || {}) };
    o.body = JSON.stringify(o.body);
  }
  const r = await fetch(url, o);
  const data = (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
  if (!r.ok) throw new Error(data?.error || 'No se pudo completar la acción.');
  return data;
}

function toast(msg, tipo = 'success') {
  let c = $('#toasts');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toasts';
    c.className = 'toast-container position-fixed bottom-0 start-0 p-3';
    c.style.zIndex = 2000;
    document.body.append(c);
  }
  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${tipo === 'error' ? 'danger' : 'success'} border-0`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `<div class="d-flex"><div class="toast-body fs-6">${esc(msg)}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button></div>`;
  c.append(el);
  const t = new bootstrap.Toast(el, { delay: 4500 });
  el.addEventListener('hidden.bs.toast', () => el.remove());
  t.show();
}

// Número para enlaces de WhatsApp (agrega 51 si son 9 dígitos de celular peruano)
function numeroWA(tel) {
  const d = String(tel || '').replace(/\D/g, '');
  return d.length === 9 ? '51' + d : d;
}

const LOGO_SVG = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="9" fill="#1F4D36"/><path d="M16.5 10h7v6.5H30v7h-6.5V30h-7v-6.5H10v-7h6.5z" fill="#fff"/></svg>';

// Iconos de línea (SVG) que reemplazan a los emojis en todo el sitio
const ICONOS = {
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  asesoria: '<path d="M6 3v5a4 4 0 0 0 8 0V3"/><path d="M10 12v3a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/>',
  familia: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 5.5 4.8"/>',
  pastilla: '<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M9.5 9.5l5 5"/>',
  frasco: '<path d="M9.5 3h5v3h-5z"/><path d="M8 6h8l1 3v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9z"/><path d="M7 12h10"/>',
  hoja: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19l8-8"/>',
  gota: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  cruz: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  ubicacion: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  telefono: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  correo: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  etiqueta: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  chat: '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M8 10h8M8 13h5"/>',
  escudo: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  objetivo: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
};
const icono = (n, clase = '') =>
  `<svg class="ico ${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[n] || ICONOS.cruz}</svg>`;

// Icono de una categoría: el guardado en la base (pastilla, frasco...) o, si no hay, uno según su nombre
function iconoCategoria(nombre, guardado) {
  if (guardado && ICONOS[guardado]) return guardado;
  const n = String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/medic|generic|farmac/.test(n)) return 'pastilla';
  if (/vitamin|natural|suplement/.test(n)) return 'hoja';
  if (/derm|piel|cosmet|belleza/.test(n)) return 'gota';
  if (/cuidado|higien|personal/.test(n)) return 'frasco';
  if (/bebe|infant|mama/.test(n)) return 'familia';
  return 'cruz';
}

// Rellena los elementos <span data-icono="..."> escritos en el HTML
const pintarIconos = (raiz = document) => $$('[data-icono]', raiz).forEach((el) => { el.innerHTML = icono(el.dataset.icono); });
