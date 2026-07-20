/**
 * ModuleNavigator.js — Navegación entre Módulos
 *
 * Maneja la navegación entre los diferentes módulos del geovisor
 * (contexto.html, biofisico.html, limites.html, etc.) preservando
 * el departamento y municipio seleccionados.
 *
 * Responsabilidad:
 *   - navigateTo(page, tab): redirige a otra página con parámetros
 *   - buildUrl(page, tab, deptoId, municipioId): construye URL con params
 *
 * Dependencias:
 *   - ModuleNavigation global (moduleNavigation.js)
 */
export class ModuleNavigator {
    navigateTo(page, tab) {
        const selectDepto = document.getElementById('departamentos');
        const selectMuni = document.getElementById('municipios');
        const depto = selectDepto?.value || '';
        const muni = selectMuni?.value || '';

        const params = new URLSearchParams();
        if (tab) params.set('tab', tab);
        if (muni) params.set('id', muni);
        else if (depto && depto !== '0') params.set('depto', depto);

        const query = params.toString();
        window.registrarAccesoComponente?.(page);
        window.location.href = query ? `${page}?${query}` : page;
    }
}
