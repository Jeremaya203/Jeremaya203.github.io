(function (global) {
    "use strict";

    const COMPONENT_PAGES = {
        limites: "limites.html",
        ordenamiento: "ordenamiento.html",
        legal: "contexto.html",
        contexto: "contexto.html",
        biofisico: "biofisico.html",
        ocupacion: "ocupacion.html",
        socioeconomico: "socioeconomico.html"
    };

    const PARAM_ALIASES = {
        tab: ["tab", "componente", "submenu"],
        municipioId: ["id", "municipio", "mpcodigo", "divipola"],
        deptoId: ["depto", "departamento", "dpcodigo"],
        nivel: ["nivel", "filtroNivel"]
    };

    function normalizeText(value) {
        return String(value ?? "").trim();
    }

    function normalizeMunicipalityId(value) {
        const normalized = normalizeText(value);
        if (/^\d{5}$/.test(normalized)) return normalized;
        if (/^\d{1,4}$/.test(normalized)) return normalized.padStart(5, "0");
        return "";
    }

    function normalizeDepartmentId(value) {
        const normalized = normalizeText(value);
        if (/^\d{2}$/.test(normalized)) return normalized;
        if (/^\d$/.test(normalized)) return normalized.padStart(2, "0");
        return "";
    }

    function firstParam(params, names) {
        for (const name of names) {
            const value = params.get(name);
            if (value != null && normalizeText(value)) return value;
        }
        return "";
    }

    function parseComponentUrlParams(search = global.location.search) {
        const params = new URLSearchParams(search);
        const municipalityId = normalizeMunicipalityId(firstParam(params, PARAM_ALIASES.municipioId));
        const departmentId = normalizeDepartmentId(firstParam(params, PARAM_ALIASES.deptoId)) ||
            (municipalityId ? normalizeDepartmentId(municipalityId.substring(0, 2)) : "");

        return {
            tab: firstParam(params, PARAM_ALIASES.tab) || null,
            municipioId: municipalityId,
            deptoId: departmentId,
            nivel: firstParam(params, PARAM_ALIASES.nivel) || (municipalityId ? "MUNI" : departmentId ? "DEPTO" : ""),
            params
        };
    }

    function resolveDepartmentSelectValue(departmentSelect, departmentId) {
        if (!departmentSelect || !departmentId) return "";
        const normalized = normalizeDepartmentId(departmentId);
        const candidates = [departmentId, normalized, String(departmentId).padStart(2, "0")];
        const optionValues = new Set(Array.from(departmentSelect.options, (option) => option.value));
        return [...new Set(candidates)].find(code => optionValues.has(code)) || "";
    }

    function getTerritoryFromSelects(departmentSelect, municipalitySelect) {
        const municipalityId = normalizeMunicipalityId(municipalitySelect?.value);
        const rawDepartmentId = normalizeText(departmentSelect?.value);
        let departmentId = "";

        if (municipalityId) {
            departmentId = normalizeDepartmentId(municipalityId.substring(0, 2));
        } else if (rawDepartmentId && rawDepartmentId !== "0" && rawDepartmentId !== "COL") {
            departmentId = normalizeDepartmentId(rawDepartmentId);
        }

        return {
            municipioId: municipalityId,
            deptoId: departmentId,
            nivel: municipalityId ? "MUNI" : departmentId ? "DEPTO" : rawDepartmentId === "COL" ? "COL" : ""
        };
    }

    function currentComponentState() {
        const urlContext = parseComponentUrlParams();
        const selectState = getTerritoryFromSelects(
            document.getElementById("departamentos"),
            document.getElementById("municipios")
        );

        return {
            ...urlContext,
            ...selectState,
            municipioId: selectState.municipioId || urlContext.municipioId,
            deptoId: selectState.deptoId || urlContext.deptoId,
            nivel: selectState.nivel || urlContext.nivel
        };
    }

    function buildComponentHref(targetPage, options = {}) {
        const currentParams = options.preserveParams === false
            ? new URLSearchParams()
            : new URLSearchParams(global.location.search);
        const tab = options.tab ?? options.componente ?? options.submenu ?? null;
        const municipalityId = normalizeMunicipalityId(options.municipioId);
        const departmentId = normalizeDepartmentId(options.deptoId);
        const level = normalizeText(options.nivel);
        const extraParams = options.extraParams || {};

        PARAM_ALIASES.tab.slice(1).forEach(name => currentParams.delete(name));
        PARAM_ALIASES.municipioId.slice(1).forEach(name => currentParams.delete(name));
        PARAM_ALIASES.deptoId.slice(1).forEach(name => currentParams.delete(name));
        PARAM_ALIASES.nivel.slice(1).forEach(name => currentParams.delete(name));

        if (tab) currentParams.set("tab", tab);
        else currentParams.delete("tab");

        if (departmentId) currentParams.set("depto", departmentId);
        else currentParams.delete("depto");

        if (municipalityId) currentParams.set("id", municipalityId);
        else currentParams.delete("id");

        if (level) currentParams.set("nivel", level);
        else currentParams.delete("nivel");

        Object.entries(extraParams).forEach(([key, value]) => {
            const normalized = normalizeText(value);
            if (normalized) currentParams.set(key, normalized);
            else currentParams.delete(key);
        });

        const query = currentParams.toString();
        return query ? `${targetPage}?${query}` : targetPage;
    }

    function mergeHrefWithTerritory(href, territory = {}) {
        const url = new URL(href, global.location.href);
        const state = {
            ...parseComponentUrlParams(url.search),
            ...territory,
            municipioId: normalizeMunicipalityId(territory.municipioId),
            deptoId: normalizeDepartmentId(territory.deptoId)
        };
        const merged = buildComponentHref(url.pathname.replace(/^\//, ""), {
            preserveParams: true,
            tab: url.searchParams.get("tab"),
            municipioId: state.municipioId,
            deptoId: state.deptoId,
            nivel: territory.nivel || state.nivel
        });
        return `${merged}${url.hash || ""}`;
    }

    function waitForTerritorySelects(callback, options = {}) {
        const maxAttempts = Number(options.maxAttempts ?? 24);
        const intervalMs = Number(options.intervalMs ?? 400);
        let attempts = 0;
        const timer = global.setInterval(() => {
            attempts += 1;
            const departmentSelect = document.getElementById("departamentos");
            const municipalitySelect = document.getElementById("municipios");
            const ready = Boolean(departmentSelect && municipalitySelect && departmentSelect.options.length > 1);
            if (ready || attempts >= maxAttempts) {
                global.clearInterval(timer);
                callback({ selectDepto: departmentSelect, selectMuni: municipalitySelect, ready });
            }
        }, intervalMs);
    }

    function applyTerritorySelectionFromUrl(options = {}) {
        const { tab, municipioId: municipalityId, deptoId: departmentId } = parseComponentUrlParams();
        if (tab && typeof options.onTab === "function") {
            global.setTimeout(() => options.onTab(tab), Number(options.tabDelayMs ?? 500));
        }
        if (!municipalityId && !departmentId) return;

        waitForTerritorySelects(({ selectDepto: departmentSelect, selectMuni: municipalitySelect, ready }) => {
            if (!ready) {
                console.warn("Unable to apply the territory from the URL", { municipalityId, departmentId, tab });
                return;
            }

            const resolvedDepartment = resolveDepartmentSelectValue(departmentSelect, departmentId);
            if (resolvedDepartment) departmentSelect.value = resolvedDepartment;

            options.prepareTerritorySelection?.({ municipioId: municipalityId, deptoId: departmentId, tab, selectDepto: departmentSelect, selectMuni: municipalitySelect });

            if (municipalityId) {
                if (resolvedDepartment) departmentSelect.dispatchEvent(new Event("change"));
                global.setTimeout(() => {
                    municipalitySelect.value = municipalityId;
                    if (municipalitySelect.value === municipalityId) {
                        municipalitySelect.dispatchEvent(new Event("change"));
                        options.onApplied?.({ municipioId: municipalityId, deptoId: departmentId, tab });
                    }
                }, Number(options.municipioDelayMs ?? 350));
                return;
            }

            if (resolvedDepartment) {
                departmentSelect.dispatchEvent(new Event("change"));
                options.onApplied?.({ municipioId: "", deptoId: departmentId, tab });
            }
        });
    }

    function navigateToComponent(targetPage, tab, extraParams = {}) {
        const state = currentComponentState();
        global.registrarAccesoComponente?.(targetPage);
        global.location.href = buildComponentHref(targetPage, {
            tab,
            municipioId: state.municipioId,
            deptoId: state.deptoId,
            nivel: state.nivel,
            extraParams
        });
    }

    function bindTrigger(triggerId, targetPage, options = {}) {
        const trigger = document.getElementById(triggerId);
        if (!trigger || trigger.dataset.componentNavigationBound === "true") return;
        trigger.dataset.componentNavigationBound = "true";
        trigger.addEventListener("click", (event) => {
            const tab = options.tab ?? trigger.dataset.target ?? null;
            if (options.preventDefault !== false) event.preventDefault();
            navigateToComponent(targetPage, tab, options.extraParams || {});
        });
    }

    function bindDefaultModuleTriggers() {
        bindTrigger("limitesTrigger", COMPONENT_PAGES.limites);
        bindTrigger("ordenamientoTrigger", COMPONENT_PAGES.ordenamiento);
        bindTrigger("legalTrigger", COMPONENT_PAGES.contexto);
        bindTrigger("biofisicoTrigger", COMPONENT_PAGES.biofisico);
        bindTrigger("ocupacionTrigger", COMPONENT_PAGES.ocupacion);
        bindTrigger("socioeconomicoTrigger", COMPONENT_PAGES.socioeconomico);
    }

    const api = {
        normalizeTerritoryCode: normalizeText,
        normalizeMunicipalityId,
        normalizeDepartmentId,
        resolveDepartmentSelectValue,
        parseComponentUrlParams,
        buildComponentHref,
        getTerritoryFromSelects,
        currentComponentState,
        mergeHrefWithTerritory,
        waitForTerritorySelects,
        applyTerritorySelectionFromUrl,
        navigateToComponent,
        bindTrigger,
        bindDefaultModuleTriggers
    };

    // Deprecated aliases remain temporarily available for existing integrations.
    api.normalizeMunicipioId = normalizeMunicipalityId;
    api.normalizeDeptoId = normalizeDepartmentId;
    api.resolveDeptoSelectValue = resolveDepartmentSelectValue;
    global.ComunicacionEntreComponentes = api;
    global.ModuleNavigation = api;
})(window);
