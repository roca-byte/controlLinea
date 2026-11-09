/* Servidor local para tools/demo.js y tools/video.js.
 * Levanta `python3 -m http.server` sobre la carpeta del repo (la misma forma de probar la app
 * que dice AGENTS.md; con file:// el service worker no anda). Usa un puerto libre, así no
 * choca con un servidor que ya tengas abierto en el 8000.
 * La app no tiene backend: los datos viven en el navegador de la grabación (un perfil nuevo
 * cada vez), así que nada sale de la máquina.
 */
const { spawn } = require('child_process');
const net = require('net');
const http = require('http');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

function puertoLibre() {
  return new Promise((ok, mal) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); });
    s.on('error', mal);
  });
}

// Espera a que el servidor conteste (python tarda un momento en arrancar).
function esperar(url, intentos = 50) {
  return new Promise((ok, mal) => {
    const probar = n => http.get(url, r => { r.resume(); ok(); })
      .on('error', () => (n ? setTimeout(() => probar(n - 1), 100) : mal(new Error('El servidor no arrancó: ' + url))));
    probar(intentos);
  });
}

/** Arranca el servidor. Devuelve { url, cerrar }. */
async function servidor() {
  const puerto = await puertoLibre();
  const proc = spawn('python3', ['-m', 'http.server', String(puerto), '--bind', '127.0.0.1', '--directory', RAIZ], { stdio: 'ignore' });
  const url = 'http://127.0.0.1:' + puerto + '/';
  await esperar(url);
  return { url, cerrar: () => proc.kill() };
}

module.exports = { servidor, RAIZ };
