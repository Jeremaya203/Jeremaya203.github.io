import { API, mapa, modoActual, rutaZona, zonaGeoJSON } from './estado.js';
import { _setProcesoPasos, actualizarProceso, mostrarStep } from './interfaz.js';
import { mostrarResultados } from './resultados.js';

export async function ejecutarAnalisis() {
  if (window.OOT && OOT.track) OOT.track('analisis_determinantes', { modo: (typeof modoActual !== 'undefined' ? modoActual : '') });
  window.OOT.log('[DETERMINANTES] === ejecutarAnalisis() ===');
  window.OOT.log('[DETERMINANTES] modoActual:', modoActual);
  window.OOT.log('[DETERMINANTES] zonaGeoJSON:', zonaGeoJSON ? 'CARGADO' : 'NULL');
  window.OOT.log('[DETERMINANTES] API:', API);
  
  if (!zonaGeoJSON && !rutaZona) { 
    window.OOT.notify('No hay zona de consulta. Cargue un archivo GeoJSON o dibuje una zona en el mapa.', 'warn');
    return; 
  }

  // Selector "Municipio de referencia" eliminado (era vestigial). Se envía vacío a
  // propósito: la viabilidad detecta el municipio real de la zona (gestor._resolver_municipio)
  // y la consulta de área es dirigida por la geometría.
  const codMpio = '', nombreMpio = '';
  const areaMinima = parseFloat(document.getElementById('area-minima')?.value) || 6;
  const reglas = [];
  // Los identificadores DEBEN coincidir con los que evalua agentes/consultor_area.py.
  // 'paramos' no existe alli: la casilla se marcaba y la regla no se ejecutaba nunca,
  // sin error. El nombre real de la regla de paramos/humedales/rondas es
  // 'priorizacion_1pct' — el mismo que este archivo ya usaba en REGLA_CONFIG.
  if (document.getElementById('regla-aislamiento')?.checked) reglas.push('aislamiento_vias');
  if (document.getElementById('regla-paramos')?.checked) reglas.push('priorizacion_1pct');
  if (document.getElementById('regla-areas-vida')?.checked) reglas.push('areas_vida');
  if (document.getElementById('regla-centros')?.checked) reglas.push('centros_poblados');
  if (document.getElementById('regla-corredor')?.checked) reglas.push('corredor_suburbano');

  window.OOT.log('[DETERMINANTES] Params:', { codMpio, nombreMpio, areaMinima, reglas, modoActual });
  document.getElementById('placeholder')?.classList.add('hidden');
  mostrarStep('processing');
  actualizarProceso(1);

  try {
    window.OOT.log('[DETERMINANTES] ===== ANALISIS COMPLETO =====');

    // MODO VIABILIDAD PREDIAL (LLM)
    if (modoActual === 'viabilidad') {
      window.OOT.log('[DETERMINANTES] Modo: viabilidad (LLM)');
      const usoPretendido = document.getElementById('uso-pretendido')?.value || 'uso no especificado';

      // Actualizar labels de pasos para viabilidad
      const procTit = document.getElementById('proc-titulo');
      const procSub = document.getElementById('proc-subtitulo');
      if (procTit) procTit.textContent = 'Analizando viabilidad...';
      if (procSub) procSub.textContent = 'El análisis IA puede tardar varios minutos';
      _setProcesoPasos(['Cargando predios y determinantes', 'Evaluando normativa con IA', 'Generando reporte']);

      // Subir zona si no tenemos ruta
      let ruta = rutaZona;
      if (!ruta && zonaGeoJSON) {
        const formData = new FormData();
        const blob = new Blob([JSON.stringify(zonaGeoJSON)], { type: 'application/json' });
        formData.append('zona', blob, 'zona.geojson');
        const uploadRes = await fetch(API + '/api/determinantes/upload', { method: 'POST', body: formData });
        if (!uploadRes.ok) throw new Error('Error al subir archivo');
        const uploadData = await uploadRes.json();
        ruta = uploadData.ruta;
      }
      if (!ruta) throw new Error('No hay zona para analizar');

      actualizarProceso(1);

      // Health check
      const health = await fetch(API + '/api/health').catch(() => null);
      if (!health || !health.ok) throw new Error('El servicio de análisis no está disponible en este momento. Intente nuevamente en unos minutos.');

      actualizarProceso(2);

      // Timeout largo: LLM puede tardar minutos (25 predios × múltiples determinantes)
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 300000); // 5 min

      try {
        const res = await fetch(API + '/api/determinantes/ejecutar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            ruta_zona_interes: ruta,
            cod_municipio: codMpio,
            nombre_municipio: nombreMpio,
            area_minima_ha: areaMinima,
            uso_pretendido: usoPretendido,
            modo: 'viabilidad',
            max_predios: 25
          })
        });
        clearTimeout(timeout);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Error HTTP ' + res.status);
        }
        const data = await res.json();
        actualizarProceso(3);
        mostrarResultados(data);
      } catch(fetchErr) {
        clearTimeout(timeout);
        if (fetchErr.name === 'AbortError') throw new Error('El análisis superó el tiempo límite (5 min). Intente con una zona más pequeña o menor área mínima.');
        throw fetchErr;
      }
      return;
    }

    // MODO CONSULTA ÁREA (original)
    window.OOT.log('[DETERMINANTES] Modo: consulta_area');
    const procTitA = document.getElementById('proc-titulo');
    const procSubA = document.getElementById('proc-subtitulo');
    if (procTitA) procTitA.textContent = 'Procesando...';
    if (procSubA) procSubA.textContent = 'Analizando determinantes';
    _setProcesoPasos(['Intersectando zonas', 'Aplicando reglas', 'Evaluando normativa']);
    
    // Verificar conexión primero
    const healthUrl = API + '/api/health';
    const healthCheck = await fetch(healthUrl).catch(e => {
      console.error('[DETERMINANTES] Error health:', e);
      return null;
    });
    
    if (!healthCheck || !healthCheck.ok) {
      throw new Error('El servicio de análisis no está disponible en este momento. Intente nuevamente en unos minutos.');
    }
    
    // Usar rutaZona existente si ya tenemos archivo subido, sino subir zonaGeoJSON
    let rutaParaAnalisis = rutaZona;
    
    if (!rutaParaAnalisis && zonaGeoJSON) {
      window.OOT.log('[DETERMINANTES] Subiendo zona para análisis...');
      const formData = new FormData();
      const blob = new Blob([JSON.stringify(zonaGeoJSON)], { type: 'application/json' });
      formData.append('zona', blob, 'zona.geojson');
      
      const uploadUrl = API + '/api/determinantes/upload';
      const uploadRes = await fetch(uploadUrl, { method: 'POST', body: formData });
      
      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error('Error al subir archivo: ' + uploadRes.status + '\n' + errText);
      }
      
      const uploadData = await uploadRes.json();
      rutaParaAnalisis = uploadData.ruta;
      window.OOT.log('[DETERMINANTES] Ruta obtenida:', rutaParaAnalisis);
    }
    
    if (!rutaParaAnalisis) {
      throw new Error('No hay zona para analizar');
    }
    
    actualizarProceso(2);
    
    window.OOT.log('[DETERMINANTES] Ejecutando análisis...');
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 120000);
    
    const ejecutarUrl = API + '/api/determinantes/ejecutar';
    window.OOT.log('[DETERMINANTES] Ejecutar URL:', ejecutarUrl);
    
    const analysisRes = await fetch(ejecutarUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        ruta_zona_interes: rutaParaAnalisis,
        cod_municipio: codMpio,
        nombre_municipio: nombreMpio,
        area_minima_ha: areaMinima,
        uso_pretendido: '',
        modo: 'consulta_area',
        reglas_activas: reglas,
        max_predios: 25
      })
    });
    clearTimeout(timeout);
    window.OOT.log('[DETERMINANTES] Analysis response:', analysisRes.status);
    
    if (!analysisRes.ok) {
      const errText = await analysisRes.text();
      throw new Error('Error en análisis: ' + analysisRes.status + ' - ' + errText);
    }
    
    const result = await analysisRes.json();
    window.OOT.log('[DETERMINANTES] Result:', result);
    actualizarProceso(3);
    mostrarResultados(result);
    
  } catch(err) {
    console.error('[DETERMINANTES] Error:', err);
    // El abort del timeout (consulta_area) lanza un DOMException poco claro
    // ("signal is aborted without reason"); se traduce a un mensaje accionable.
    // La ruta de viabilidad ya arroja su propio mensaje amigable (no coincide con
    // /aborted/), así que este bloque no lo pisa.
    const esAbort = err && (err.name === 'AbortError' || /aborted/i.test(err.message || ''));
    const msg = esAbort
      ? 'El análisis superó el tiempo límite. Puede deberse a una zona muy extensa o a alta carga del servidor. Intente con una zona más pequeña o vuelva a intentarlo en unos minutos.'
      : (err && err.message ? err.message : 'Ocurrió un error al ejecutar el análisis.');
    const errEl = document.getElementById('error-msg');
    if (errEl) errEl.textContent = msg;
    mostrarStep('error');
  }
}
