/* Genera las capturas de la guía (docs/img/*.png) y el recorrido animado (docs/img/demo.gif).
 *
 * Uso:  cd tools && npm install && node demo.js      (necesita además ffmpeg del sistema)
 * Los datos son los de tools/ejemplo.js (inventados): se escriben en localStorage antes de
 * abrir la app, así no hace falta tocar el código de la app.
 * Volver a correrlo cada vez que cambie algo visible de la app.
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { servidor, RAIZ } = require('./servidor');
const Ejemplo = require('./ejemplo');

const SALIDA = path.join(RAIZ, 'docs', 'img');
const L = Ejemplo.LINEAS;

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const srv = await servidor();
  // --lang: los campos de fecha y hora toman el idioma del navegador (dd/mm/aaaa, 24 h).
  const browser = await chromium.launch({ args: ['--lang=es-AR'] });
  const capturas = [];

  // datos: estado inicial de 'controlLinea.v1'. empresa: nombre en Ajustes ('' = vacío).
  async function contexto({ datos, empresa = Ejemplo.EMPRESA, hora = '10:30', opciones = {} }) {
    const ctx = await browser.newContext(Object.assign({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: 'light',
      locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires', permissions: ['clipboard-read', 'clipboard-write']
    }, opciones));
    // Se siembra una sola vez por pestaña (sessionStorage), así lo que se carga durante la
    // captura no se pisa si la página se recarga.
    await ctx.addInitScript(([d, emp]) => {
      if (sessionStorage.getItem('demo.sembrado')) return;
      localStorage.setItem('controlLinea.v1', JSON.stringify(d));
      localStorage.setItem('controlLinea.marca.v1', JSON.stringify({ empresa: emp, logo: null }));
      sessionStorage.setItem('demo.sembrado', '1');
      // "Exportar PDF" abre el diálogo de impresión del navegador, que en la grabación no se ve:
      // se anula y la vista A4 se captura emulando la impresión.
      window.print = () => {};
    }, [datos, empresa]);
    const page = await ctx.newPage();
    // Reloj fijo: 11/11/2026 (se lee igual en dd/mm y mm/dd). Por defecto 10:30, en medio de
    // la recorrida 3; para la primera recorrida, a primera hora.
    await page.clock.setFixedTime(new Date(`2026-11-11T${hora}:00-03:00`));
    page.on('dialog', d => d.accept());
    page.on('pageerror', e => { throw e; });
    page.setDefaultTimeout(5000);
    await page.goto(srv.url);
    await page.waitForSelector('#view section');
    return { ctx, page };
  }

  // Pantalla completa o, con selector, solo ese bloque.
  async function foto(page, nombre, selector) {
    // Sin cursor ni borde de foco en el último campo tocado.
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(350);
    const destino = path.join(SALIDA, nombre + '.png');
    if (selector) {
      // En un recorte las barras fijas (arriba y las pestañas de abajo) se superponen a lo
      // capturado: se sueltan un momento.
      const estilo = await page.addStyleTag({ content: '.topbar, .tabbar { position: static !important; }' });
      await page.locator(selector).first().screenshot({ path: destino });
      await estilo.evaluate(e => e.remove());
    } else await page.screenshot({ path: destino });
    capturas.push(nombre);
  }
  const sinToast = page => page.waitForSelector('#toast', { state: 'hidden', timeout: 4000 });
  const resultado = (page, v) => page.check(`input[name="resultado"][value="${v}"]`, { force: true });
  const guardar = page => page.click('.sheet-foot .btn-primary');

  // ── 1. Ajustes y primera recorrida (solo las líneas cargadas, empresa vacía) ──
  let { ctx, page } = await contexto({ datos: Ejemplo.soloAjustes(), empresa: '', hora: '07:00' });
  await page.click('.tabbar [data-tab="ajustes"]');
  await foto(page, '01-ajustes-lineas');
  await page.fill('#secMarca [name="empresa"]', Ejemplo.EMPRESA);
  await page.locator('#secMarca').scrollIntoViewIfNeeded();
  await foto(page, '02-ajustes-empresa', '#secMarca');

  await page.click('.tabbar [data-tab="recorrida"]');
  await page.selectOption('#inTurno', 'Mañana');
  await foto(page, '03-iniciar-recorrida');

  await page.click('[data-act="iniciar"]');
  await page.waitForSelector('#formControl');
  await page.fill('[name="producto"]', 'Jugo de naranja 1 L');
  await page.fill('[name="lote"]', 'L-0412');
  await resultado(page, 'conforme');
  await foto(page, '04-linea-conforme');
  await guardar(page);

  // "Guardar y seguir" abre sola la línea siguiente: ahí va el ajuste.
  await page.waitForSelector(`#sheetTitle:has-text("${L[1]}")`);
  await page.fill('[name="producto"]', 'Agua mineral 5 L');
  await page.fill('[name="lote"]', 'L-0418');
  await page.fill('[name="hora"]', '07:15');
  await resultado(page, 'ajuste');
  await page.fill('[name="detalle"]', 'Tapas mal roscadas: se ajustó el torque de la capsuladora.');
  await page.fill('[name="relDesc"]', 'Se evitó envasar bidones con tapa floja.');
  await page.fill('[name="relMag"]', '120');
  await page.selectOption('[name="relUni"]', 'L');
  await page.locator('#wrapRel').scrollIntoViewIfNeeded();
  await foto(page, '05-ajuste-en-linea');
  await ctx.close();

  // ── 2. Jornada completa: R1 y R2 cerradas, R3 abierta, control final ──
  ({ ctx, page } = await contexto({ datos: Ejemplo.estado() }));
  await foto(page, '06-recorrida-en-curso');

  await page.click('.tabbar [data-tab="final"]');
  await foto(page, '07-control-final');
  await page.click('[data-act="nuevo-final"]');
  await page.selectOption('[name="linea"]', L[1]);
  await page.fill('[name="producto"]', 'Agua mineral 5 L');
  await page.fill('[name="lote"]', 'L-0409');
  await page.fill('[name="hora"]', '09:20');
  await resultado(page, 'parcial');
  await page.fill('[name="palletsNoOk"]', '2');
  await page.fill('[name="detalle"]', 'Pallets 3 y 7 con film roto: se reembalan antes de despachar.');
  await page.locator('[name="detalle"]').scrollIntoViewIfNeeded();
  await foto(page, '08-control-final-parcial');
  await page.keyboard.press('Escape');

  // Recorrida cerrada: horarios y la línea que quedó sin cargar.
  await page.click('.tabbar [data-tab="recorrida"]');
  const r2 = '.log-group:has(.log-head strong:text-is("Recorrida 2"))';
  await page.locator(r2).scrollIntoViewIfNeeded();
  await foto(page, '09-recorrida-cerrada', r2);
  await page.click(`${r2} [data-act="editar-rec"]`);
  await page.waitForSelector('#formRec');
  await foto(page, '10-corregir-horarios');
  await page.keyboard.press('Escape');
  await page.click(`${r2} [data-act="agregar-linea"]`);
  await page.waitForSelector('#formControl');
  await page.fill('[name="producto"]', 'Gaseosa lima 354 ml');
  await page.fill('[name="lote"]', 'L-0427');
  await foto(page, '11-agregar-linea');
  await page.keyboard.press('Escape');

  // Reporte del día.
  await page.click('.tabbar [data-tab="reporte"]');
  await page.waitForSelector('.report');
  await page.evaluate(() => window.scrollTo(0, 0));
  await foto(page, '12-reporte');
  // La cobertura, justo debajo de la barra superior.
  await page.locator('.report .r-sec').first().evaluate(e => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 70));
  await foto(page, '13-reporte-cobertura');

  // Vista de impresión A4 (lo que sale en el PDF).
  await page.click('[data-act="imprimir"]');
  await page.setViewportSize({ width: 794, height: 1123 });   // A4 a 96 ppp
  await page.emulateMedia({ media: 'print' });
  await foto(page, '14-reporte-pdf', '.report');
  await page.emulateMedia({ media: 'screen' });
  await page.setViewportSize({ width: 390, height: 844 });

  // Compartir resumen: en la compu (sin menú de compartir) lo copia al portapapeles. Se muestra
  // el texto copiado tal cual, en un recuadro agregado solo para la captura.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('[data-act="compartir"]');
  const texto = await page.evaluate(() => navigator.clipboard.readText());
  if (!texto.includes('Control de línea')) throw new Error('No se copió el resumen');
  await sinToast(page);
  await page.evaluate(t => {
    const caja = document.createElement('div');
    caja.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(15,30,35,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif';
    caja.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:360px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.3);overflow:hidden">'
      + '<div style="background:#0f5c6e;color:#fff;padding:10px 14px;font-weight:600">Resumen copiado · pegalo en WhatsApp o mail</div>'
      + '<pre style="margin:0;padding:14px;white-space:pre-wrap;font:14px/1.45 system-ui,sans-serif;color:#1d2a2e"></pre></div>';
    caja.querySelector('pre').textContent = t;
    document.body.appendChild(caja);
  }, texto);
  await foto(page, '15-compartir-resumen');
  await ctx.close();

  // ── Recorrido animado: terminar la recorrida 3 y cerrarla ──
  const carpetaVideo = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-gif-'));
  ({ ctx, page } = await contexto({ datos: Ejemplo.estado(), opciones: { deviceScaleFactor: 1, recordVideo: { dir: carpetaVideo, size: { width: 390, height: 844 } } } }));
  await page.waitForTimeout(1200);
  await page.click(`[data-act="controlar"][data-linea="${L[2]}"]`);
  await page.waitForTimeout(900);
  await resultado(page, 'conforme');
  await page.waitForTimeout(900);
  await guardar(page);
  await page.waitForTimeout(1200);
  // Línea 4 todavía no tuvo producción hoy: no hay lote para precargar.
  await page.fill('[name="producto"]', 'Gaseosa lima 354 ml');
  await page.locator('[name="lote"]').pressSequentially('L-0427', { delay: 60 });
  await resultado(page, 'ajuste');
  await page.waitForTimeout(500);
  await page.locator('[name="detalle"]').pressSequentially('Abolladuras: se calibró la guía.', { delay: 35 });
  await page.locator('[name="relMag"]').pressSequentially('48', { delay: 120 });
  await page.selectOption('[name="relUni"]', 'unid.');
  await page.waitForTimeout(700);
  await guardar(page);
  await page.waitForTimeout(1600);
  await page.click('[data-act="cerrar-rec"]');
  await page.waitForTimeout(1600);
  await page.click('.tabbar [data-tab="reporte"]');
  await page.waitForTimeout(2200);
  const video = await page.video().path();
  await ctx.close();
  await browser.close();
  srv.cerrar();

  // webm → GIF liviano (paleta propia, 6 cuadros por segundo, 320 px de ancho; solo se
  // guardan las partes que cambian de un cuadro al otro, así pesa poco).
  const gif = path.join(SALIDA, 'demo.gif');
  const filtro = 'fps=6,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle';
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-vf', filtro, gif]);
  fs.rmSync(carpetaVideo, { recursive: true, force: true });

  console.log('Capturas:', capturas.join(', '));
  console.log('GIF:', path.relative(RAIZ, gif), Math.round(fs.statSync(gif).size / 1024) + ' KB');
})().catch(e => { console.error('✗', e.message); process.exit(1); });
