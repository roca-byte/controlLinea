# Desarrollo — Control de Línea

Información técnica para quien quiera modificar o publicar la app. Para usarla, ver el
[README](README.md). El contexto completo para agentes de IA está en [AGENTS.md](AGENTS.md).

## Tecnologías

HTML + CSS + JavaScript puro, **sin frameworks, sin npm y sin paso de build**. Scripts clásicos (sin módulos), un objeto global por archivo. Datos en `localStorage` (clave `controlLinea.v1`). Sin login ni backend.

## Estructura

```
├── index.html              # Estructura: barra superior, <main id="view"> y pestañas
├── manifest.webmanifest    # Datos de instalación PWA
├── sw.js                   # Service worker (red primero, caché sin señal)
├── css/
│   └── styles.css          # Estilos mobile first y reglas @media print (A4)
├── js/
│   ├── brand.js            # Marca configurable (BRAND)
│   ├── store.js            # Capa de datos (Store)
│   ├── report.js           # Reporte del día y texto para compartir (Report)
│   └── app.js              # Pantallas, formularios y eventos
├── icons/                  # Íconos de la app
├── assets/                 # Logo opcional (ej. assets/logo.png; no incluido)
├── AGENTS.md / CLAUDE.md   # Contexto para agentes de IA
```

Orden de carga de los scripts: `brand` → `store` → `report` → `app`.

## Probar en la compu

Con `file://` el service worker no funciona: hay que servir la carpeta.

```bash
python3 -m http.server 8000
```

Abrir `http://localhost:8000`.

## Publicar en GitHub Pages

1. Subir todos los archivos de esta carpeta al repo.
2. Settings → Pages → Deploy from branch → `main` / `(root)`.

Todas las rutas son relativas, así que funciona en cualquier subdirectorio.

## Personalización de la marca por código

El usuario carga la empresa y el logo desde **Ajustes** (se guardan en el dispositivo; si hay logo, el reporte muestra solo el logo).

Los valores de `js/brand.js` quedan como respaldo cuando la configuración está vacía:

```js
window.BRAND = {
  empresa: '...',
  area: 'Departamento de Calidad',
  logo: '',                  // ej: 'assets/logo.png' (vacío = sin logo)
  colores: {
    primario: '#0f5c6e',     // barra superior, botones y títulos del reporte
    textoSobrePrimario: '#ffffff'
  },
  documento: {
    titulo: 'Reporte de Control del Día',
    codigo: '',              // código de registro controlado (opcional)
    revision: ''
  }
};
```

## Notas de mantenimiento

- Al cambiar cualquier archivo, subir `VERSION` en `sw.js` y mantener `ARCHIVOS` al día; si no, los celulares siguen con la versión vieja.
- Si cambia la forma de los datos, subir la clave a `controlLinea.v2` y migrar desde v1 en `load()` para no perder datos.
- Los datos viven en el dispositivo: borrar los datos del navegador los elimina, por eso conviene el respaldo.
