import { mostrarPopupDeterminantes, mostrarResultadosMapa, resaltarDeterminante, toggleDeterminanteVisibilidad } from './capas.js';
import { API, mapa, setDatosResultado, setDetOcultos, setReporteTexto } from './estado.js';
import { centroideGeoJSON } from './geometria.js';
import { mostrarStep } from './interfaz.js';

export function mostrarResultados(data) {
  window.OOT.log('[DETERMINANTES] mostrarResultados() called');
  window.OOT.log('[DETERMINANTES] data keys:', Object.keys(data));
  window.OOT.log('[DETERMINANTES] modo:', data.modo);
  
  setDatosResultado(data);
  setReporteTexto(data.reporte_final || '');
  
  // Título de resultados: en consulta_area la zona manda (puede cruzar varios municipios),
  // así que se usan los municipios REALES que devuelve el backend (#3), NO el desplegable
  // —que solo es referencia para viabilidad—. Antes mostraba siempre "Santa Marta" (default).
  const tituloMpio = document.getElementById('resultado-municipio');
  if (tituloMpio) {
    // Sin dropdown: el título usa los municipios REALES detectados por el backend a
    // partir de la zona (viabilidad y consulta_area). Si no vienen, etiqueta genérica.
    const reales = Array.isArray(data.municipios_zona) ? data.municipios_zona : [];
    tituloMpio.textContent = reales.length
      ? (reales.length <= 3 ? reales.map(m => m.nombre).join(', ') : reales.length + ' municipios')
      : (data.municipio_detectado || 'Zona consultada');
  }
  
  setTimeout(() => {
    mostrarResultadosMapa(data);
    mostrarPopupDeterminantes();
  }, 500);

  // ── MODO VIABILIDAD ──
  if (data.modo === 'viabilidad') {
    const evalNorm = data.evaluacion_normativa || [];
    const viabilidadMap = data.predios_viabilidad || {};
    const esc = (s) => window.OOT.escapeHtml(s == null ? '' : s);

    // Elementos del DOM (declarados aquí para no depender de los que están más abajo)
    const totalDetsEl = document.getElementById('total-dets');
    const totalPrediosEl = document.getElementById('total-predios');
    const viablesEl = document.getElementById('viables');
    const noViablesEl = document.getElementById('no-viables');
    const listEl = document.getElementById('determinantes-list');
    if (!listEl) { mostrarStep('results'); return; }

    // Contar verdicts
    let nComp = 0, nCond = 0, nNoViab = 0;
    Object.values(viabilidadMap).forEach(function(v) {
      if (v.includes('Compatible')) nComp++;
      else if (v.includes('Condicionado')) nCond++;
      else if (v.includes('No viable')) nNoViab++;
    });

    // Stats cards
    if (totalDetsEl) { totalDetsEl.textContent = evalNorm.length; if (totalDetsEl.nextElementSibling) totalDetsEl.nextElementSibling.textContent = 'Predios'; totalDetsEl.style.color = ''; }
    if (totalPrediosEl) { totalPrediosEl.textContent = nComp; if (totalPrediosEl.nextElementSibling) totalPrediosEl.nextElementSibling.textContent = 'Compatibles'; totalPrediosEl.style.color = 'var(--oot-green)'; }
    if (viablesEl) { viablesEl.textContent = nCond; if (viablesEl.nextElementSibling) viablesEl.nextElementSibling.textContent = 'Condicionados'; viablesEl.style.color = 'var(--oot-ochre)'; }
    if (noViablesEl) { noViablesEl.textContent = nNoViab; if (noViablesEl.nextElementSibling) noViablesEl.nextElementSibling.textContent = 'No Viables'; noViablesEl.style.color = 'var(--oot-red)'; }

    listEl.innerHTML = '';

    // Uso pretendido badge
    if (data.uso_pretendido) {
      const usoEl = document.createElement('div');
      usoEl.className = 'oot-js-determinantes-39';
      usoEl.innerHTML = '<span class="material-symbols-outlined oot-js-determinantes-1">work</span> Uso analizado: <strong>' + window.OOT.escapeHtml(String(data.uso_pretendido)) + '</strong>';
      listEl.appendChild(usoEl);
    }

    if (evalNorm.length === 0) {
      listEl.innerHTML += '<div class="oot-js-determinantes-12">No se encontraron predios que cumplan el área mínima en esta zona.</div>';
    } else {
      const hdr = document.createElement('div');
      hdr.className = 'oot-js-determinantes-40';
      hdr.textContent = 'Predios Evaluados (' + evalNorm.length + ')';
      listEl.appendChild(hdr);

      evalNorm.forEach(function(predio) {
        const npn = predio.numero_predial;
        const viab = viabilidadMap[String(npn)] || 'Sin información';
        const color = _viabColor(viab);
        const claseViab = _viabClase(viab);
        // Compatibilidad: el backend ya no antepone el emoji al veredicto, pero una
        // respuesta cacheada de antes del cambio si puede traerlo. El selector de
        // variacion va contemplado o queda huerfano al principio de la etiqueta.
        const labelCorto = viab.replace(/^[\u{1F534}\u{1F7E1}\u{1F7E2}\u{26AA}]\u{FE0F}?/u, '').trim().split('\n')[0];

        const card = document.createElement('div');
        card.className = 'oot-js-determinantes-41';
        card.style.borderColor = color + '44';

        const header = document.createElement('div');
        header.className = 'oot-js-determinantes-42';
        header.style.background = color + '18';
        header.innerHTML =
          '<span class="oot-js-determinantes-13 oot-viab-dot ' + claseViab + '"></span>' +
          '<div class="oot-js-determinantes-9">' +
            '<div class="oot-js-determinantes-14" title="' + window.OOT.escapeHtml(String(npn)) + '">' + window.OOT.escapeHtml(String(npn)) + '</div>' +
            '<div class="oot-js-determinantes-15">' + (predio.area_ha || '?') + ' ha · ' + window.OOT.escapeHtml(String(predio.clase_pendiente || '—')) + '</div>' +
          '</div>' +
          '<span class="oot-js-determinantes-viab-label">' + window.OOT.escapeHtml(String(labelCorto)) + '</span>' +
          '<span class="material-symbols-outlined oot-js-determinantes-2">expand_more</span>';
        const viabLabelEl = header.querySelector('.oot-js-determinantes-viab-label');
        if (viabLabelEl) viabLabelEl.style.color = color;

        const body = document.createElement('div');
        body.className = 'oot-js-determinantes-43';

        (predio.veredictos || []).forEach(function(v) {
          const vc = _viabColor(v.veredicto || '');
          const vi = _viabIcon(v.veredicto || '');
          const fund = (v.fundamento || '').substring(0, 250);
          const detDiv = document.createElement('div');
          detDiv.className = 'oot-js-determinantes-44';
          detDiv.style.borderLeftColor = vc;
          detDiv.innerHTML =
            '<div class="oot-js-determinantes-16">' +
              '<span class="oot-js-determinantes-17">' + vi + '</span>' +
              '<span class="oot-js-determinantes-18">' + esc(v.determinante || '—') + '</span>' +
            '</div>' +
            (v.categoria ? '<div class="oot-js-determinantes-19">Nivel: ' + esc(v.categoria) + '</div>' : '') +
            '<div class="oot-js-determinantes-20">' + esc(fund) + (fund.length === 250 ? '…' : '') + '</div>';
          body.appendChild(detDiv);
        });

        header.onclick = function() {
          const open = body.style.display !== 'none';
          body.style.display = open ? 'none' : 'block';
          const chev = header.querySelector('.material-symbols-outlined');
          if (chev) chev.textContent = open ? 'expand_more' : 'expand_less';
          if (!open && mapa) {
            // Fly to predio on map when opening
            const feat = (data.predios_geojson || {features:[]}).features.find(function(f) { return String(f.properties.numero_predial) === String(npn); });
            if (feat && feat.geometry) { const c = centroideGeoJSON(feat); if (c) mapa.flyTo({ center: c, zoom: 16, duration: 800 }); }
          }
        };

        card.appendChild(header);
        card.appendChild(body);
        listEl.appendChild(card);
      });
    }

    mostrarStep('results');
    return;
  }

  const esModoPredio = data.modo === 'consulta_predio';
  
  // El backend devuelve determinantes_zona, no determinantes
  let determinantes = data.determinantes_zona || data.determinantes || [];
  let predios = data.predios || [];
  let reporte = data.reporte_final || '';
  let viablesCount = (data.predios_viables || []).length;
  let totalFiltrados = data.total_predios_filtrados || 0;
  
  const totalDetsEl = document.getElementById('total-dets');
  const totalPrediosEl = document.getElementById('total-predios');
  const viablesEl = document.getElementById('viables');
  const noViablesEl = document.getElementById('no-viables');
  
  if (esModoPredio) {
    // Modo predio: estadísticas de predios
    const prediosGeo = data.predios_geojson || { features: [] };
    const totalPredios = data.total_predios || prediosGeo.features.length;
    const conDets = prediosGeo.features.filter(f => (f.properties?.n_determinantes || 0) > 0).length;
    const sinDets = totalPredios - conDets;
    
    if (totalDetsEl) { totalDetsEl.textContent = totalPredios; if (totalDetsEl.nextElementSibling) totalDetsEl.nextElementSibling.textContent = 'Predios'; }
    if (totalPrediosEl) { totalPrediosEl.textContent = conDets; if (totalPrediosEl.nextElementSibling) totalPrediosEl.nextElementSibling.textContent = 'Con Determinantes'; }
    if (viablesEl) { viablesEl.textContent = sinDets; if (viablesEl.nextElementSibling) viablesEl.nextElementSibling.textContent = 'Sin Determinantes'; viablesEl.style.color = 'var(--oot-ochre)'; }
    if (noViablesEl) { noViablesEl.textContent = ''; if (noViablesEl.nextElementSibling) noViablesEl.nextElementSibling.textContent = ''; }
  } else {
    // Modo área: estadísticas normales
    if (totalDetsEl) { totalDetsEl.textContent = determinantes.length; if (totalDetsEl.nextElementSibling) totalDetsEl.nextElementSibling.textContent = 'Determinantes'; }
    if (totalPrediosEl) { totalPrediosEl.textContent = totalFiltrados; if (totalPrediosEl.nextElementSibling) totalPrediosEl.nextElementSibling.textContent = 'Predios'; }
    if (viablesEl) { viablesEl.textContent = viablesCount; if (viablesEl.nextElementSibling) viablesEl.nextElementSibling.textContent = 'Viables'; viablesEl.style.color = 'var(--oot-green)'; }
    if (noViablesEl) { noViablesEl.textContent = totalFiltrados - viablesCount; if (noViablesEl.nextElementSibling) noViablesEl.nextElementSibling.textContent = 'No Viables'; }
  }
  
  const listEl = document.getElementById('determinantes-list');
  if (!listEl) { console.error('[DETERMINANTES] determinantes-list not found'); return; }
  
  listEl.innerHTML = '';
  
  // ── MODO PREDIO ──
  if (esModoPredio) {
    const prediosGeo = data.predios_geojson || { features: [] };
    window.OOT.log('[DETERMINANTES] Modo predio - predios:', prediosGeo.features.length);
    
    if (prediosGeo.features.length > 0) {
      const header = document.createElement('div');
      header.className = 'oot-js-determinantes-45';
      header.textContent = 'Predios Encontrados (' + prediosGeo.features.length + ')';
      listEl.appendChild(header);
      
      prediosGeo.features.forEach((f, idx) => {
        const p = f.properties || {};
        const npn = p.numero_predial || p.NPN || 'N/A';
        const area = p.Shape_Area ? (p.Shape_Area / 10000).toFixed(2) + ' ha' : 'N/A';
        const nDets = p.n_determinantes || 0;
        const item = document.createElement('div');
        item.className = 'determinante-item';
        item.style.marginBottom = '8px';
        item.innerHTML = `
          <div class="determinante-header oot-js-determinantes-3">
            <span class="determinante-name oot-js-determinantes-4">${window.OOT.escapeHtml(String(npn))}</span>
            <span class="oot-js-determinantes-21">${nDets} det.</span>
          </div>
          <div class="determinante-desc oot-js-determinantes-5">Área: ${window.OOT.escapeHtml(String(area))}</div>
        `;
        item.style.cursor = 'pointer';
        item.onclick = () => {
          if (mapa && f.geometry) {
            const center = centroideGeoJSON(f);
            mapa.flyTo({ center: center, zoom: 16, duration: 1000 });
          }
        };
        listEl.appendChild(item);
      });
    } else {
      listEl.innerHTML = '<div class="text-xs text-center p-4 oot-js-determinantes-6">No se encontraron predios en esta zona</div>';
    }
    
    if (data.aviso) {
      const avisoEl = document.createElement('div');
      avisoEl.className = 'oot-js-determinantes-46';
      avisoEl.textContent = data.aviso;
      listEl.appendChild(avisoEl);
    }
  }
  
  // ── MODO ÁREA ──
  window.OOT.log('[DETERMINANTES] Adding determinantes to list...', determinantes.length);
  setDetOcultos([]);   // reset visibilidad por-determinante en cada consulta nueva

  if (determinantes.length > 0) {
    const porCategoria = {};
    determinantes.forEach(det => {
      const cat = det.categoria || 'Otros';
      if (!porCategoria[cat]) porCategoria[cat] = [];
      porCategoria[cat].push(det);
    });
    
    // Iconos por CÓDIGO de nivel (1-6), no por nombre: el backend envía el nombre largo
    // ("Conservación Ambiental y Gestión del Riesgo", ver CATEGORIAS_DTS en consultor_area.py)
    // y este mapa usaba los cortos ("Ambientales"), así que nunca acertaba y todos los
    // grupos salían con el icono genérico.
    const iconosNivel = {
      1: 'forest',                      // Conservación Ambiental y Gestión del Riesgo
      2: 'agriculture',                 // Áreas de Protección para la Producción de Alimentos
      3: 'account_balance',             // Patrimonio Cultural
      4: 'settings_input_component',    // Infraestructura Básica Nacional y Regional
      5: 'location_city',               // Componentes Metropolitanos
      6: 'beach_access'                 // Proyectos Turísticos Especiales
    };
    
    Object.entries(porCategoria).forEach(([cat, items]) => {
      const catHeader = document.createElement('div');
      catHeader.className = 'oot-js-determinantes-47 det-grupo-header';
      // B.1.6 — El título del grupo se pinta con el color de SU nivel. Se toma del campo
      // `codigo` (1-6) que envía el backend, no del nombre: el nombre es texto largo y
      // variable, el código es el dominio LADM estable. El CSS traduce ese número a un par
      // de colores (pleno para el icono, aclarado para el texto: sobre el fondo oscuro del
      // panel los tonos plenos no llegan a contraste AA).
      const nivelCod = parseInt(items[0] && items[0].codigo, 10);
      if (nivelCod >= 1 && nivelCod <= 6) catHeader.dataset.nivel = String(nivelCod);
      // cat proviene de la API (vocabulario controlado, pero se escapa por consistencia/H-12).
      catHeader.innerHTML = `
        <span class="material-symbols-outlined oot-js-determinantes-7">${iconosNivel[nivelCod] || 'category'}</span>
        <span class="oot-js-determinantes-22">${window.OOT.escapeHtml(String(cat))}</span>
        <span class="oot-js-determinantes-23">${items.length}</span>
        <span class="material-symbols-outlined det-grupo-chevron">expand_more</span>
      `;
      listEl.appendChild(catHeader);

      // A.3.5 — Los ítems van dentro de su propio contenedor para poder plegar el grupo
      // entero. Antes se añadían a `listEl` como hermanos del encabezado, así que la
      // lista era una tira plana: con decenas de determinantes no había forma de navegar
      // entre niveles sin hacer scroll a ciegas.
      const grupo = document.createElement('div');
      grupo.className = 'det-grupo';
      listEl.appendChild(grupo);

      catHeader.addEventListener('click', () => {
        const plegado = grupo.classList.toggle('plegado');
        catHeader.classList.toggle('plegado', plegado);
      });

      items.forEach((det, idx) => {
        const item = document.createElement('div');
        item.className = 'determinante-item';
        item.dataset.determ = String(det.codigo ?? '');
        item.dataset.nomdet = String(det.nombre ?? '');
        const areaInt = det.area_interseccion_m2 ? (det.area_interseccion_m2 / 10000).toFixed(2) + ' ha' : 'N/A';
        const cobertura = det.cobertura_zona_pct ? det.cobertura_zona_pct.toFixed(1) + '%' : 'N/A';
        const _esc = (s) => window.OOT.escapeHtml(String(s));
        const nombreDet = det.determinante || det.nombre || ('Determinante ' + (idx + 1));
        item.innerHTML = `
          <div class="determinante-header oot-js-determinantes-8">
            <span class="determinante-name oot-js-determinantes-9">${_esc(nombreDet)}</span>
            <button class="det-eye oot-js-determinantes-24" title="Mostrar / ocultar en el mapa">
              <span class="material-symbols-outlined oot-js-determinantes-10">visibility</span>
            </button>
          </div>
          <div class="determinante-desc">Cobertura: ${cobertura} (${areaInt})</div>
        `;
        item.style.cursor = 'pointer';
        // Ojo → prende/apaga SOLO este determinante en el mapa (sin disparar el resaltado)
        const eyeBtn = item.querySelector('.det-eye');
        if (eyeBtn) eyeBtn.onclick = (ev) => {
          ev.stopPropagation();
          toggleDeterminanteVisibilidad(det.codigo, det.nombre, eyeBtn, item);
        };
        item.onclick = () => {
          if (!mapa) return;
          // Marcar ítem seleccionado en el listado
          document.querySelectorAll('.determinante-item.sel').forEach(el => el.classList.remove('sel'));
          item.classList.add('sel');
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          // Resaltar el polígono completo en amarillo y reencuadrar.
          // Si no hay geometría coincidente, vuela al centroide como fallback.
          if (!resaltarDeterminante(det.codigo, det.nombre)) {
            if (det.centroide_lon != null && det.centroide_lat != null) {
              mapa.flyTo({ center: [det.centroide_lon, det.centroide_lat], zoom: 13, duration: 1000 });
            }
          }
        };
        grupo.appendChild(item);   // A.3.5: dentro del grupo plegable, no suelto en la lista
      });
    });
  }
  
  // También mostrar el reporte si existe
  if (reporte) {
    const reporteEl = document.createElement('div');
    reporteEl.style.marginTop = '16px';
    reporteEl.style.padding = '12px';
    reporteEl.style.background = 'var(--oot-s2)';
    reporteEl.style.borderRadius = '8px';
    reporteEl.style.fontSize = '11px';
    reporteEl.style.color = 'var(--oot-tx2)';
    reporteEl.style.whiteSpace = 'pre-wrap';
    reporteEl.style.maxHeight = '200px';
    reporteEl.style.overflowY = 'auto';
    reporteEl.textContent = reporte;
    listEl.appendChild(reporteEl);
  }
  
  if (determinantes.length === 0 && !reporte) {
    listEl.innerHTML = '<div class="text-xs text-center p-4 oot-js-determinantes-6">No se encontraron determinantes</div>';
  }
  
  const reglasList = document.getElementById('reglas-list');
  if (reglasList) reglasList.innerHTML = '';
  if (reglasList && data.reglas_geojson) {
    const reglas = data.reglas_geojson;
    const reglasKeys = Object.keys(reglas);
    if (reglasKeys.length > 0) {
      const reglasHeader = document.createElement('div');
      reglasHeader.className = 'oot-js-determinantes-48';
      reglasHeader.style.color = 'var(--oot-tx)';
      reglasHeader.textContent = 'Reglas Aplicadas';
      reglasList.appendChild(reglasHeader);
      
      const REGLA_CONFIG = {
        'aislamiento_vias': { nombre: 'Aislamiento de vías', color: 'var(--oot-red)' },
        'priorizacion_1pct': { nombre: 'Priorización compra predios 1%', color: 'var(--oot-blue)' },
        'areas_vida': { nombre: 'Áreas de vida / reforestación', color: 'var(--oot-green)' },
        'centros_poblados': { nombre: 'Centros poblados', color: 'var(--oot-ochre)' },
        'corredor_suburbano': { nombre: 'Corredor Vial Suburbano', color: 'var(--oot-terra)' }
      };
      
      reglasKeys.forEach(key => {
        const cfg = REGLA_CONFIG[key] || { nombre: key, color: 'var(--oot-tx3)' };
        const reglaEl = document.createElement('div');
        reglaEl.className = 'oot-js-determinantes-49';
        reglaEl.style.borderLeftColor = cfg.color;
        const tieneDatos = reglas[key] && reglas[key].features && reglas[key].features.length > 0;
        reglaEl.innerHTML = `
          <span class="oot-js-determinantes-regla-dot oot-viab-dot ${tieneDatos ? 'oot-viab--no-viable' : 'oot-viab--sin-info'}"></span>
          <span class="oot-js-determinantes-25">${cfg.nombre}</span>
          <span class="oot-js-determinantes-23">${tieneDatos ? reglas[key].features.length + ' entidades' : 'sin datos'}</span>
        `;
        const reglaDotEl = reglaEl.querySelector('.oot-js-determinantes-regla-dot');
        if (reglaDotEl) reglaDotEl.style.color = cfg.color;
        reglasList.appendChild(reglaEl);
      });
    }
  }
  
  window.OOT.log('[DETERMINANTES] Calling mostrarStep(results)...');
  mostrarStep('results');
}

function _viabColor(text) {
  const t = text || '';
  if (t.includes('Compatible')) return '#27ae60';
  if (t.includes('Condicionado')) return '#f4a833';
  if (t.includes('No viable') || t.includes('no_viable')) return '#c0392b';
  return '#888888';
}

// El semaforo es un punto pintado por CSS, no un emoji: con emoji el veredicto
// dependia de que el sistema tuviera la fuente instalada, y en un modulo juridico eso
// es la diferencia entre "no viable" y un cuadrito vacio.
function _viabClase(text) {
  const t = text || '';
  if (t.includes('Compatible')) return 'oot-viab--compatible';
  if (t.includes('Condicionado')) return 'oot-viab--condicionado';
  if (t.includes('No viable') || t.includes('no_viable')) return 'oot-viab--no-viable';
  return 'oot-viab--sin-info';
}
