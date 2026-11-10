/* Datos de ejemplo para las capturas y el video. 100 % inventados: empresa ficticia, sin logo,
 * sin nombres de personas, productos y lotes genéricos.
 *
 * No son parte de la app: se escriben en localStorage (clave 'controlLinea.v1', mismo modelo
 * que js/store.js) ANTES de abrirla, desde tools/demo.js y tools/video.js.
 */
const FECHA = '2026-11-11';            // el reloj de la grabación queda fijo en este día, 10:30
const EMPRESA = 'Envasadora Demo S.A.';

const LINEAS = ['Línea 1 · Botellas', 'Línea 2 · Bidones', 'Línea 3 · Sachets', 'Línea 4 · Latas'];
const PRODUCTO = {
  'Línea 1 · Botellas': ['Jugo de naranja 1 L', 'L-0412'],
  'Línea 2 · Bidones': ['Agua mineral 5 L', 'L-0418'],
  'Línea 3 · Sachets': ['Salsa de tomate 340 g', 'L-0421'],
  'Línea 4 · Latas': ['Gaseosa lima 354 ml', 'L-0427']
};

const config = () => ({
  checker: 'Checker de turno',
  lineas: [...LINEAS],
  unidades: ['L', 'kg', 'unid.', 'min'],
  turnos: ['Mañana', 'Tarde', 'Noche']
});

let n = 0;
const id = () => 'demo' + (++n);

// Control de línea dentro de una recorrida.
function linea(rec, l, hora, resultado, detalle = '', relevancia = null) {
  const [producto, lote] = PRODUCTO[l];
  return {
    id: id(), tipo: 'linea', recorridaId: rec, linea: l,
    producto, lote: resultado === 'sin_produccion' ? '' : lote, hora, resultado,
    excluir: false, palletsNoOk: null, detalle, relevancia
  };
}
function final(l, producto, lote, hora, resultado, detalle = '', extra = {}) {
  return Object.assign({
    id: id(), tipo: 'final', recorridaId: null, linea: l, producto, lote, hora, resultado,
    excluir: false, palletsNoOk: null, detalle,
    relevancia: resultado === 'conforme' ? null : { descripcion: '', magnitud: null, unidad: 'L' }
  }, extra);
}

/**
 * Arma el estado completo.
 * opciones.conR3:        incluir la recorrida 3 abierta (con dos líneas cargadas).
 * opciones.conNoConforme: incluir el lote No conforme del control final.
 */
function estado({ conR3 = true, conNoConforme = true } = {}) {
  n = 0;
  const recorridas = [
    { id: 'r1', numero: 1, inicio: '07:00', fin: '07:42' },
    { id: 'r2', numero: 2, inicio: '08:30', fin: '09:05' }
  ];
  const controles = [
    linea('r1', LINEAS[0], '07:04', 'conforme'),
    linea('r1', LINEAS[1], '07:15', 'ajuste', 'Tapas mal roscadas: se ajustó el torque de la capsuladora.',
      { descripcion: 'Se evitó envasar bidones con tapa floja.', magnitud: 120, unidad: 'L' }),
    linea('r1', LINEAS[2], '07:26', 'conforme'),
    linea('r1', LINEAS[3], '07:38', 'sin_produccion', 'Cambio de formato.'),
    linea('r2', LINEAS[0], '08:34', 'conforme'),
    linea('r2', LINEAS[1], '08:45', 'conforme'),
    linea('r2', LINEAS[2], '08:57', 'ajuste', 'Sellado vertical abierto: se subió la temperatura de la mordaza.',
      { descripcion: 'Se evitó parar la línea para revisar sachets al 100 %.', magnitud: 15, unidad: 'min' }),
    // Línea 4 no se cargó en la recorrida 2: aparece "+ Línea 4 · Latas" en el registro.
    final(LINEAS[0], 'Jugo de naranja 1 L', 'L-0405', '08:10', 'conforme'),
    final(LINEAS[1], 'Agua mineral 5 L', 'L-0409', '09:20', 'parcial', 'Pallets 3 y 7 con film roto: se reembalan antes de despachar.', { palletsNoOk: 2 }),
    final(LINEAS[2], 'Salsa de tomate 340 g', 'L-0410', '09:40', 'reprocesado', 'Etiqueta corrida en una caja: se reetiquetó.')
  ];
  if (conNoConforme) {
    controles.push(final(LINEAS[3], 'Gaseosa lima 354 ml', 'L-0402', '10:00', 'no_conforme', 'Fecha de vencimiento ilegible en el fondo de la lata.'));
  }
  if (conR3) {
    recorridas.push({ id: 'r3', numero: 3, inicio: '10:05', fin: null });
    controles.push(linea('r3', LINEAS[0], '10:09', 'conforme'), linea('r3', LINEAS[1], '10:18', 'conforme'));
  }
  return { config: config(), dias: { [FECHA]: { turno: 'Mañana', recorridas, controles } } };
}

/** Solo los Ajustes cargados (líneas de la planta), sin ninguna jornada. */
const soloAjustes = () => ({ config: config(), dias: {} });

module.exports = { FECHA, EMPRESA, LINEAS, estado, soloAjustes };
