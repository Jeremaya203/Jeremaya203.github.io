(function (global) {
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

    function normalizeMunicipioId(value) {
        const normalized = normalizeText(value);
        if (/^\d{5}$/.test(normalized)) return normalized;
        if (/^\d{1,4}$/.test(normalized)) return normalized.padStart(5, "0");
        return "";
    }

    function normalizeDeptoId(value) {
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
        const municipioId = normalizeMunicipioId(firstParam(params, PARAM_ALIASES.municipioId));
        const deptoId = normalizeDeptoId(firstParam(params, PARAM_ALIASES.deptoId)) ||
            (municipioId ? normalizeDeptoId(municipioId.substring(0, 2)) : "");

        return {
            tab: firstParam(params, PARAM_ALIASES.tab) || null,
            municipioId,
            deptoId,
            nivel: firstParam(params, PARAM_ALIASES.nivel) || (municipioId ? "MUNI" : deptoId ? "DEPTO" : ""),
            params
        };
    }

    function resolveDeptoSelectValue(selectDepto, deptoId) {
        if (!selectDepto || !deptoId) return "";
        const normalized = normalizeDeptoId(deptoId);
        const candidates = [deptoId, normalized, String(deptoId).padStart(2, "0")];
        const optionValues = new Set(Array.from(selectDepto.options, option => option.value));
        return [...new Set(candidates)].find(code => optionValues.has(code)) || "";
    }

    function getTerritoryFromSelects(selectDepto, selectMuni) {
        const municipioId = normalizeMunicipioId(selectMuni?.value);
        const deptoRaw = normalizeText(selectDepto?.value);
        let deptoId = "";

        if (municipioId) {
            deptoId = normalizeDeptoId(municipioId.substring(0, 2));
        } else if (deptoRaw && deptoRaw !== "0" && deptoRaw !== "COL") {
            deptoId = normalizeDeptoId(deptoRaw);
        }

        return {
            municipioId,
            deptoId,
            nivel: municipioId ? "MUNI" : deptoId ? "DEPTO" : deptoRaw === "COL" ? "COL" : ""
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
        const municipioId = normalizeMunicipioId(options.municipioId);
        const deptoId = normalizeDeptoId(options.deptoId);
        const nivel = normalizeText(options.nivel);
        const extraParams = options.extraParams || {};

        PARAM_ALIASES.tab.slice(1).forEach(name => currentParams.delete(name));
        PARAM_ALIASES.municipioId.slice(1).forEach(name => currentParams.delete(name));
        PARAM_ALIASES.deptoId.slice(1).forEach(name => currentParams.delete(name));
        PARAM_ALIASES.nivel.slice(1).forEach(name => currentParams.delete(name));

        if (tab) currentParams.set("tab", tab);
        else currentParams.delete("tab");

        if (deptoId) currentParams.set("depto", deptoId);
        else currentParams.delete("depto");

        if (municipioId) currentParams.set("id", municipioId);
        else currentParams.delete("id");

        if (nivel) currentParams.set("nivel", nivel);
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
            municipioId: normalizeMunicipioId(territory.municipioId),
            deptoId: normalizeDeptoId(territory.deptoId)
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
            const selectDepto = document.getElementById("departamentos");
            const selectMuni = document.getElementById("municipios");
            const ready = Boolean(selectDepto && selectMuni && selectDepto.options.length > 1);
            if (ready || attempts >= maxAttempts) {
                global.clearInterval(timer);
                callback({ selectDepto, selectMuni, ready });
            }
        }, intervalMs);
    }

    function applyTerritorySelectionFromUrl(options = {}) {
        const { tab, municipioId, deptoId } = parseComponentUrlParams();
        if (tab && typeof options.onTab === "function") {
            global.setTimeout(() => options.onTab(tab), Number(options.tabDelayMs ?? 500));
        }
        if (!municipioId && !deptoId) return;

        waitForTerritorySelects(({ selectDepto, selectMuni, ready }) => {
            if (!ready) {
                console.warn("No se pudo aplicar territorio desde la URL", { municipioId, deptoId, tab });
                return;
            }

            const resolvedDepto = resolveDeptoSelectValue(selectDepto, deptoId);
            if (resolvedDepto) selectDepto.value = resolvedDepto;

            options.prepareTerritorySelection?.({ municipioId, deptoId, tab, selectDepto, selectMuni });

            if (municipioId) {
                if (resolvedDepto) selectDepto.dispatchEvent(new Event("change"));
                global.setTimeout(() => {
                    selectMuni.value = municipioId;
                    if (selectMuni.value === municipioId) {
                        selectMuni.dispatchEvent(new Event("change"));
                        options.onApplied?.({ municipioId, deptoId, tab });
                    }
                }, Number(options.municipioDelayMs ?? 350));
                return;
            }

            if (resolvedDepto) {
                selectDepto.dispatchEvent(new Event("change"));
                options.onApplied?.({ municipioId: "", deptoId, tab });
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
        normalizeMunicipioId,
        normalizeDeptoId,
        resolveDeptoSelectValue,
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

    global.ComunicacionEntreComponentes = api;
    global.ModuleNavigation = api;
})(window);
