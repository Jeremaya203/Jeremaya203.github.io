/**
 * module-navigator.js — Navegación entre Módulos
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
 *   - ModuleNavigation global (module-navigation.js)
 */
export class ModuleNavigator {
    navigateTo(page, tab) {
        const departmentSelect = document.getElementById('departamentos');
        const municipalitySelect = document.getElementById('municipios');
        const departmentId = departmentSelect?.value || '';
        const municipalityId = municipalitySelect?.value || '';

        const params = new URLSearchParams();
        if (tab) params.set('tab', tab);
        if (municipalityId) params.set('id', municipalityId);
        else if (departmentId && departmentId !== '0') params.set('depto', departmentId);

        const query = params.toString();
        window.registrarAccesoComponente?.(page);
        window.location.href = query ? `${page}?${query}` : page;
    }
}
