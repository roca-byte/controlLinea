/* Graba el video de demostración: docs/video/control-linea-demo.mp4 (≤ 90 s).
 *
 * Uso:  cd tools && npm install && node video.js      (necesita además ffmpeg del sistema)
 * Recorre la app con los datos inventados de tools/ejemplo.js: Ajustes → recorrida 3 (con un
 * ajuste en línea) → control final → Reporte del día → Exportar PDF. Lleva carteles que
 * explican cada paso, un círculo en cada toque y placas de apertura y cierre.
 * Volver a correrlo cada vez que cambie algo visible de la app.
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { servidor, RAIZ } = require('./servidor');
const Ejemplo = require('./ejemplo');

const SALIDA = path.join(RAIZ, 'docs', 'video');
const ANCHO = 390, ALTO = 844;
const L = Ejemplo.LINEAS;

// Se inyecta en la página: carteles, placas y marca de toques. Vive fuera de <main>,
// así sobrevive a los redibujos de la app. El cartel va ARRIBA (debajo de la barra): abajo
// taparía las pestañas y el botón Guardar de las hojas, que es justo lo que se toca.
function preparar() {
  const css = document.createElement('style');
  css.textContent = `
    #v-cartel { position: fixed; left: 12px; right: 12px; top: 72px; z-index: 99; padding: 12px 16px; pointer-events: none;
      background: rgba(10, 70, 84, .94); color: #fff; border-radius: 14px; font: 600 17px/1.35 "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 6px 24px rgba(0,0,0,.25); transition: opacity .35s, transform .35s; }
    #v-cartel.oculto { opacity: 0; transform: translateY(-14px); }
    #v-cartel small { display: block; font-weight: 400; font-size: 14px; opacity: .85; margin-top: 2px; }
    #v-placa { position: fixed; inset: 0; z-index: 100; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 14px; text-align: center; padding: 24px; background: #0f5c6e; color: #fff;
      font-family: "Segoe UI", Roboto, sans-serif; transition: opacity .6s; }
    #v-placa.oculto { opacity: 0; pointer-events: none; }
    #v-placa img { width: 112px; height: 112px; }
    #v-placa h1 { margin: 0; font-size: 34px; } #v-placa h1 span { color: #00c896; }
    #v-placa p { margin: 0; font-size: 18px; opacity: .9; max-width: 300px; line-height: 1.4; }
    #v-placa b { color: #00c896; }
    #v-hoja { position: fixed; inset: 0; z-index: 97; background: #5b6b70; overflow: hidden; transition: opacity .5s; }
    #v-hoja.oculto { opacity: 0; pointer-events: none; }
    #v-hoja img { display: block; width: 360px; margin: 150px auto 0; box-shadow: 0 6px 24px rgba(0,0,0,.35);
      transition: transform 6s ease-in-out; }
    .v-toque { position: fixed; z-index: 98; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
      background: rgba(0, 200, 150, .35); border: 3px solid #00c896; pointer-events: none; animation: v-toque .6s ease-out forwards; }
    @keyframes v-toque { from { transform: scale(.4); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }`;
  document.head.appendChild(css);
  for (const id of ['v-cartel', 'v-placa', 'v-hoja']) {
    const el = document.createElement('div');
    el.id = id; el.className = 'oculto';
    document.body.appendChild(el);
  }
  const cartel = document.getElementById('v-cartel');
  const placa = document.getElementById('v-placa');
  const hoja = document.getElementById('v-hoja');
  document.addEventListener('pointerdown', e => {
    const t = document.createElement('div');
    t.className = 'v-toque'; t.style.left = e.clientX + 'px'; t.style.top = e.clientY + 'px';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 700);
  }, true);
  window.vCartel = (titulo, detalle) => {
    cartel.innerHTML = titulo ? titulo + (detalle ? '<small>' + detalle + '</small>' : '') : '';
    cartel.className = titulo ? '' : 'oculto';
  };
  window.vPlaca = html => {
    if (html) placa.innerHTML = html;
    placa.className = html ? '' : 'oculto';
  };
  // Muestra la hoja A4 (imagen) y la desliza hacia arriba para recorrerla entera.
  window.vHoja = src => {
    if (!src) { hoja.className = 'oculto'; return; }
    hoja.innerHTML = '<img alt="">';
    const img = hoja.firstChild;
    img.onload = () => requestAnimationFrame(() => {
      img.style.transform = `translateY(${-(img.offsetHeight - (innerHeight - 170))}px)`;
    });
    img.src = src;
    hoja.className = '';
  };
}

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const srv = await servidor();
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-video-'));
  const browser = await chromium.launch({ args: ['--lang=es-AR'] });
  const ctx = await browser.newContext({
    viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 2, serviceWorkers: 'block',
    locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires', colorScheme: 'light'
  });
  // Jornada de ejemplo con R1 y R2 cerradas; la recorrida 3 y el lote No conforme se cargan en
  // el video. La empresa queda vacía para cargarla en Ajustes. Se siembra una sola vez (marca
  // en localStorage), así la segunda pestaña (la del PDF) ve lo mismo que la primera.
  await ctx.addInitScript(d => {
    window.print = () => {};   // el diálogo de impresión no se ve en la grabación
    if (localStorage.getItem('demo.sembrado')) return;
    localStorage.setItem('controlLinea.v1', JSON.stringify(d));
    localStorage.setItem('controlLinea.marca.v1', JSON.stringify({ empresa: '', logo: null }));
    localStorage.setItem('demo.sembrado', '1');
  }, Ejemplo.estado({ conR3: false, conNoConforme: false }));
  const page = await ctx.newPage();

  // Grabación: capturas de pantalla seguidas a resolución doble, cada una con su hora.
  // (La grabación propia de Playwright da cuadros de 390 px, que en un celular moderno se
  // ven borrosos.) Después se arma el video respetando cuánto estuvo cada cuadro en pantalla.
  const cuadros = [];
  let grabando = false;
  async function grabar() {
    while (grabando) {
      const t = Date.now() / 1000;
      const archivo = path.join(carpeta, 'c' + String(cuadros.length).padStart(5, '0') + '.jpg');
      try {
        await page.screenshot({ path: archivo, type: 'jpeg', quality: 88, animations: 'allow', caret: 'initial' });
        cuadros.push({ archivo, t });
      } catch (e) { /* la página se está redibujando: se saltea el cuadro */ }
    }
  }
  // Reloj de la app: 11/11/2026 (se lee igual en dd/mm y mm/dd). Se adelanta a mano entre
  // línea y línea para que cada control quede con su propia hora.
  const reloj = hhmm => page.clock.setFixedTime(new Date(`2026-11-11T${hhmm}:00-03:00`));
  await reloj('10:05');
  page.on('dialog', d => d.accept());
  // Si algo no aparece, que falle enseguida y avise (si no, el video queda con la pantalla
  // quieta medio minuto sin que nadie se entere).
  page.setDefaultTimeout(5000);
  page.on('pageerror', e => { throw e; });

  const espera = ms => page.waitForTimeout(ms);
  const cartel = async (t, d, ms) => { await page.evaluate(([a, b]) => window.vCartel(a, b), [t, d || '']); await espera(ms || 2500); };
  const placa = async (html, ms) => { await page.evaluate(h => window.vPlaca(h), html); await espera(ms); };
  // Lleva el elemento al centro de la pantalla (despacio, para que se vea) y lo toca.
  const ver = async (sel, ms = 600) => {
    await page.locator(sel).first().evaluate(e => e.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await espera(ms);
  };
  const tocar = async (sel, ms) => { await ver(sel, 400); await page.locator(sel).first().click(); await espera(ms || 800); };
  // Los resultados (Conforme, Ajuste…) son radios tapados por su etiqueta.
  const opcion = async (valor, ms) => {
    const sel = `input[name="resultado"][value="${valor}"]`;
    await ver(sel, 300); await page.locator(sel).click({ force: true }); await espera(ms || 600);
  };
  const tipear = async (sel, txt, demora = 55) => { await ver(sel, 300); await page.locator(sel).first().click(); await page.keyboard.type(txt, { delay: demora }); await espera(300); };
  const elegir = async (sel, valor) => { await ver(sel, 300); await page.selectOption(sel, valor); await espera(500); };
  const guardar = ms => tocar('.sheet-foot .btn-primary', ms || 1100);
  const linea = l => page.waitForSelector(`#sheetTitle:has-text("${l}")`);

  await page.goto(srv.url);
  await page.waitForSelector('#view section');
  await page.evaluate(preparar);
  grabando = true;
  const grabacion = grabar();
  await espera(300);
  const logo = await page.evaluate(() => new URL('icons/qualityos.svg', location.href).href);

  // ── Apertura ──
  await placa('<img src="' + logo + '" alt=""><h1>Control de <span>Línea</span></h1>' +
    '<p>Las recorridas de control en las líneas de envasado, desde el celular.</p><p><b>Y el reporte del día, listo para gerencia.</b></p>', 4000);
  await placa('', 700);

  // ── 1 · Ajustes ──
  await cartel('1 · Ajustes: tus líneas, en orden', 'Una sola vez: en el orden en que las recorrés', 600);
  await tocar('.tabbar [data-tab="ajustes"]', 2200);
  await ver('#secMarca', 700);
  await cartel('Y el nombre de la empresa', 'Va en el encabezado del reporte', 300);
  await tipear('#secMarca [name="empresa"]', Ejemplo.EMPRESA, 65);
  await espera(900);

  // ── 2 · Recorrida ──
  await page.evaluate(() => window.scrollTo(0, 0));
  await tocar('.tabbar [data-tab="recorrida"]', 500);
  await cartel('2 · Recorrida: línea por línea', 'R1 y R2 ya están cargadas; arranca la R3', 1800);
  await tocar('[data-act="iniciar"]', 900);
  await cartel('Producto y lote vienen de la vuelta anterior', 'Marcás el resultado y seguís', 300);
  // "Guardar y seguir" abre la línea siguiente con la hora del momento: el reloj se adelanta
  // antes de guardar la anterior.
  await linea(L[0]);
  await opcion('conforme');
  await reloj('10:12');
  await guardar();
  await linea(L[1]);
  await opcion('conforme');
  await reloj('10:20');
  await guardar();

  await linea(L[2]);
  await cartel('¿Hubo que corregir algo? Ajuste en línea', 'Qué se ajustó y la relevancia del evento', 300);
  await opcion('ajuste');
  await tipear('[name="detalle"]', 'Peso bajo: se corrigió la dosificadora.', 40);
  await tipear('[name="relDesc"]', 'Se evitó envasar sachets con bajo peso.', 40);
  await tipear('[name="relMag"]', '60', 120);
  await elegir('[name="relUni"]', 'kg');
  await reloj('10:28');
  await guardar();

  await linea(L[3]);
  await cartel('Línea parada: Sin producción', '', 300);
  await opcion('sin_produccion');
  await guardar(1600);
  await cartel('Las 4 líneas verificadas', 'Cerrás la recorrida y la próxima arranca de cero', 300);
  await tocar('[data-act="cerrar-rec"]', 1800);

  // ── 3 · Control final ──
  await reloj('10:35');
  await page.evaluate(() => window.scrollTo(0, 0));
  await tocar('.tabbar [data-tab="final"]', 400);
  await cartel('3 · Control final del lote terminado', 'Conforme, Parcial, Reprocesado o No conforme', 1400);
  await tocar('[data-act="nuevo-final"]', 600);
  await elegir('[name="linea"]', L[3]);
  await tipear('[name="producto"]', 'Gaseosa lima 354 ml', 40);
  await tipear('[name="lote"]', 'L-0402', 70);
  await opcion('no_conforme');
  await tipear('[name="detalle"]', 'Vencimiento ilegible en el fondo de la lata.', 40);
  await guardar(1500);

  // ── 4 · Reporte ──
  await tocar('.tabbar [data-tab="reporte"]', 400);
  await cartel('4 · Reporte del día, se arma solo', 'Pensado para leerse en segundos', 2200);
  await cartel('', '', 100);
  for (const sel of ['.report .r-hero', '.report .r-sec >> nth=0', '.report .r-sec >> nth=2']) await ver(sel, 1800);

  // ── Exportar PDF ──
  // La hoja A4 se fotografía en otra pestaña (misma jornada) con la vista de impresión, y se
  // muestra encima, como la que se guarda al elegir "Guardar como PDF".
  const pdf = await ctx.newPage();
  await pdf.clock.setFixedTime(new Date('2026-11-11T10:36:00-03:00'));
  await pdf.setViewportSize({ width: 794, height: 1123 });
  await pdf.goto(srv.url);
  await pdf.click('.tabbar [data-tab="reporte"]');
  await pdf.emulateMedia({ media: 'print' });
  const a4 = 'data:image/png;base64,' + (await pdf.locator('.report').screenshot()).toString('base64');
  await pdf.close();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await espera(700);
  await tocar('[data-act="imprimir"]', 300);
  await page.evaluate(src => window.vHoja(src), a4);
  await cartel('Exportar PDF: hoja A4', 'Elegís “Guardar como PDF” y lo mandás', 6500);
  await cartel('', '', 300);

  // ── Cierre ──
  await placa('<img src="' + logo + '" alt=""><h1>Control de <span>Línea</span></h1>' +
    '<p>Gratis, sin cuentas y sin señal.</p><p><b>roca-byte.github.io/controlLinea</b></p>', 4000);

  grabando = false;
  await grabacion;
  const fin = Date.now() / 1000;
  await ctx.close();
  await browser.close();
  srv.cerrar();

  // Lista de cuadros con cuánto dura cada uno en pantalla (hasta que llega el siguiente).
  const lista = path.join(carpeta, 'lista.txt');
  fs.writeFileSync(lista, cuadros.map((c, i) => {
    const hasta = i + 1 < cuadros.length ? cuadros[i + 1].t : fin;
    return "file '" + c.archivo + "'\nduration " + Math.max(0.04, hasta - c.t).toFixed(3);
  }).join('\n') + "\nfile '" + cuadros[cuadros.length - 1].archivo + "'\n");

  // Cuadros → MP4 (H.264, preset veryfast) a 25 cuadros por segundo: se reproduce en
  // celulares, WhatsApp, LinkedIn y YouTube. El ancho y el alto tienen que ser pares para H.264.
  const mp4 = path.join(SALIDA, 'control-linea-demo.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lista,
    '-vf', 'fps=25,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
    '-movflags', '+faststart', '-an', mp4]);
  fs.rmSync(carpeta, { recursive: true, force: true });
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim());
  console.log('Cuadros:', cuadros.length, '≈', (cuadros.length / (fin - cuadros[0].t)).toFixed(1), 'por segundo');
  console.log('Video:', path.relative(RAIZ, mp4), Math.round(fs.statSync(mp4).size / 1024) + ' KB,', Math.round(dur) + ' s');
  if (dur > 90) { console.error('✗ El video pasa de 90 s: acortá esperas o pasos.'); process.exit(1); }
})().catch(e => { console.error('✗', e.message); process.exit(1); });
