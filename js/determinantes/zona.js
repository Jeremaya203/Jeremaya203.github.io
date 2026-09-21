import { dibujarZonaEnMapa } from './dibujo.js';
import { API, mapa, setRutaZona, setZonaGeoJSON, zonaGeoJSON } from './estado.js';

export function handleFileSelect() {
  // Invocado por delegación (data-oot-change): `this` = el <input type=file>.
  const input = this;
  const file = input.files && input.files[0];
  if (!file) return;
  // Limpiar ruta anterior para forzar re-subida
  setRutaZona(null);
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'geojson' || ext === 'json') {
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        setZonaGeoJSON(JSON.parse(evt.target.result));
        if (!zonaGeoJSON.features && !zonaGeoJSON.geometry) throw new Error('GeoJSON inválido');
        mostrarArchivoCargado(file.name);
        _avisoPreview(false);            // GeoJSON: sí hay vista previa local
        dibujarZonaEnMapa(zonaGeoJSON);
      } catch(err) { window.OOT.notify('Error: ' + err.message, 'error'); }
    };
    reader.readAsText(file);
  } else if (ext === 'zip') {
    // H-19: Validar que el zip contenga al menos un archivo .shp en el navegador
    validarZipContieneShp(file, function(valido) {
      if (!valido) {
        window.OOT.notify('El archivo ZIP no contiene un Shapefile válido. Asegúrese de incluir el archivo .shp dentro del ZIP junto con los archivos .dbf, .shx y .prj.', 'error');
        input.value = '';
        return;
      }
      subirArchivoBackend(file, ext);
    });
  } else if (ext === 'kmz' || ext === 'kml') {
    subirArchivoBackend(file, ext);
  } else {
    window.OOT.notify(ext === 'shp'
      ? 'Un shapefile debe subirse comprimido en un .zip que incluya también .dbf, .shx y .prj.'
      : 'Formato no soportado: ' + ext, 'warn');
  }
  input.value = '';
}

function validarZipContieneShp(file, callback) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const buffer = e.target.result;
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const text = decoder.decode(new Uint8Array(buffer));
      if (text.indexOf('.shp') !== -1 || text.indexOf('.SHP') !== -1) {
        callback(true);
      } else {
        callback(false);
      }
    } catch(err) {
      callback(false);
    }
  };
  // Se leen cabecera Y cola: los local file headers estan al principio, pero el
  // directorio central (que lista TODAS las entradas) esta al final. Mirar solo el primer
  // MB rechazaba shapefiles validos cuyo .shp fuera la ultima entrada.
  const trozo = Math.min(file.size, 512 * 1024);
  reader.readAsArrayBuffer(new Blob([file.slice(0, trozo), file.slice(Math.max(0, file.size - trozo))]));
}

function subirArchivoBackend(file, ext) {
  const formData = new FormData();
  formData.append('zona', file);
  fetch(API + '/api/determinantes/upload', { method: 'POST', body: formData })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('Upload fallido')))
    .then(data => {
      setRutaZona(data.ruta);
      mostrarArchivoCargado(file.name);
      // Antes se intentaba `fetch(data.ruta)` para pintar una vista previa. `ruta` es la
      // ruta del archivo en el SISTEMA DE ARCHIVOS del servidor (router.py devuelve
      // str(Path)), no una URL, y no hay endpoint que sirva uploads/ -> el fetch siempre
      // fallaba y el .catch lo mostraba como "Error subiendo archivo". Los formatos que
      // llegan aqui (zip/kml/kmz) tampoco tienen vista previa local posible.
      _avisoPreview(true, 'Vista previa en el mapa no disponible para ' + ext.toUpperCase() +
        '. El archivo se cargó correctamente; la zona se dibujará al ejecutar el análisis.');
    })
    .catch(err => window.OOT.notify('Error subiendo archivo: ' + err.message, 'error'));
}

// H-19: muestra/oculta el aviso de "sin vista previa" para formatos no-GeoJSON.
function _avisoPreview(show, msg) {
  const el = document.getElementById('preview-aviso');
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
  el.textContent = show ? (msg || '') : '';
}

export function mostrarArchivoCargado(name) {
  window.OOT.log('[DETERMINANTES] mostrarArchivoCargado:', name);
  const dz = document.getElementById('drop-zone');
  if (!dz) { console.error('[DETERMINANTES] No se encontro #drop-zone'); return; }
  
  dz.classList.add('loaded');
  // Buscar los elementos internos correctamente
  const spans = dz.querySelectorAll('span');
  const divs = dz.querySelectorAll('div');
  if (divs.length >= 1) divs[0].textContent = 'Archivo cargado';
  if (divs.length >= 2) divs[1].textContent = name;
  
  const fileInfo = document.getElementById('file-info');
  const fileName = document.getElementById('file-name');
  const btnEjecutar = document.getElementById('btn-ejecutar');
  
  if (fileInfo) fileInfo.classList.remove('hidden');
  if (fileName) fileName.textContent = name;
  if (btnEjecutar) btnEjecutar.disabled = false;
  
  window.OOT.log('[DETERMINANTES] Archivo cargado, botón habilitado');
}

export function limpiarArchivo() {
  window.OOT.log('[DETERMINANTES] limpiarArchivo()');
  setZonaGeoJSON(null);
  setRutaZona(null);
  
  const dz = document.getElementById('drop-zone');
  if (dz) {
    dz.classList.remove('loaded');
    const divs = dz.querySelectorAll('div');
    if (divs.length >= 1) divs[0].textContent = 'Arrastra tu archivo';
    if (divs.length >= 2) divs[1].textContent = '.geojson, .zip (shapefile), .kmz, .kml';
  }
  _avisoPreview(false);
  
  const fileInfo = document.getElementById('file-info');
  const btnEjecutar = document.getElementById('btn-ejecutar');
  
  if (fileInfo) fileInfo.classList.add('hidden');
  if (btnEjecutar) btnEjecutar.disabled = true;
  
  // Limpiar mapa correctamente
  if (mapa) {
    ['draw-points','draw-polygon-line','draw-polygon','zona-consulta-line','zona-consulta'].forEach(lid => {
      if (mapa.getLayer(lid)) mapa.removeLayer(lid);
    });
    ['draw-points','draw-polygon','zona-consulta'].forEach(sid => {
      if (mapa.getSource(sid)) mapa.removeSource(sid);
    });
  }
  window.OOT.log('[DETERMINANTES] Archivo limpiado');
}
