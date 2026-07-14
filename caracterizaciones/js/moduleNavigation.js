(function (global) {
    function normalizeTerritoryCode(value) {
        return String(value ?? "").trim();
    }

    function normalizeMunicipioId(value) {
        const normalized = normalizeTerritoryCode(value);
        if (/^\d+$/.test(normalized) && normalized.length > 0 && normalized.length < 5) {
            return normalized.padStart(5, "0");
        }
        return normalized;
    }

    function normalizeDeptoId(value) {
        const normalized = normalizeTerritoryCode(value);
        if (/^\d+$/.test(normalized) && normalized.length > 0 && normalized.length < 2) {
            return normalized.padStart(2, "0");
        }
        return normalized;
    }

    function resolveDeptoSelectValue(selectDepto, deptoId) {
        if (!selectDepto || !deptoId) return "";

        const candidates = [
            deptoId,
            normalizeDeptoId(deptoId)
        ];

        if (/^\d+$/.test(deptoId)) {
            candidates.push(deptoId.padStart(2, "0"));
        }

        return [...new Set(candidates)].find((code) =>
            selectDepto.querySelector(`option[value="${code}"]`)
        ) || "";
    }

    function parseComponentUrlParams(search = global.location.search) {
        const params = new URLSearchParams(search);
        return {
            tab: params.get("tab"),
            municipioId: normalizeMunicipioId(params.get("id")),
            deptoId: normalizeDeptoId(params.get("depto"))
        };
    }

    function buildComponentHref(targetPage, options = {}) {
        const tab = options.tab ?? null;
        const municipioId = normalizeMunicipioId(options.municipioId);
        const deptoId = normalizeDeptoId(options.deptoId);
        const extraParams = options.extraParams || {};
        const params = new URLSearchParams();

        if (tab) params.set("tab", tab);
        if (deptoId) params.set("depto", deptoId);
        if (municipioId) params.set("id", municipioId);

        Object.entries(extraParams).forEach(([key, value]) => {
            const normalized = normalizeTerritoryCode(value);
            if (normalized) params.set(key, normalized);
        });

        const query = params.toString();
        return query ? `${targetPage}?${query}` : targetPage;
    }

    function getTerritoryFromSelects(selectDepto, selectMuni) {
        const municipioId = normalizeMunicipioId(selectMuni?.value);
        const deptoRaw = normalizeTerritoryCode(selectDepto?.value);
        let deptoId = "";

        if (municipioId) {
            deptoId = municipioId.substring(0, 2);
        } else if (deptoRaw && deptoRaw !== "0" && deptoRaw !== "COL") {
            deptoId = normalizeDeptoId(deptoRaw);
        }

        return { municipioId, deptoId };
    }

    function mergeHrefWithTerritory(href, territory = {}) {
        const url = new URL(href, global.location.href);
        const municipioId = normalizeMunicipioId(territory.municipioId);
        const deptoId = normalizeDeptoId(territory.deptoId);

        if (deptoId) url.searchParams.set("depto", deptoId);
        else url.searchParams.delete("depto");

        if (municipioId) url.searchParams.set("id", municipioId);
        else url.searchParams.delete("id");

        return `${url.pathname}${url.search}${url.hash}`;
    }

    function waitForTerritorySelects(callback, options = {}) {
        const urlParams = options.urlParams || parseComponentUrlParams();
        const maxAttempts = Number(options.maxAttempts ?? 20);
        const intervalMs = Number(options.intervalMs ?? 500);
        let attempts = 0;

        const timer = global.setInterval(() => {
            attempts += 1;

            const selectDepto = document.getElementById("departamentos");
            const selectMuni = document.getElementById("municipios");
            const deptoSelectReady = Boolean(
                selectDepto &&
                selectDepto.options.length > 1
            );
            const muniSelectReady = Boolean(selectMuni);
            const ready = Boolean(selectDepto && selectMuni && deptoSelectReady && muniSelectReady);

            if (ready || attempts >= maxAttempts) {
                global.clearInterval(timer);
                callback({
                    selectDepto,
                    selectMuni,
                    ready
                });
            }
        }, intervalMs);
    }

    function applyTerritorySelectionFromUrl(options = {}) {
        const { tab, municipioId: urlMunicipioId, deptoId: urlDeptoId } = parseComponentUrlParams();
        const municipioId = urlMunicipioId;
        const deptoId = normalizeDeptoId(urlDeptoId) || (municipioId ? normalizeDeptoId(municipioId.substring(0, 2)) : "");

        if (tab && typeof options.onTab === "function") {
            global.setTimeout(() => options.onTab(tab), Number(options.tabDelayMs ?? 500));
        }

        if (!municipioId && !deptoId) return;

        waitForTerritorySelects(({ selectDepto, selectMuni, ready }) => {
            if (!ready) {
                console.warn("No se pudo aplicar territorio desde la URL:", { municipioId, deptoId, tab });
                return;
            }

            const applyMunicipio = () => {
                if (!municipioId || !selectMuni) return false;

                selectMuni.value = municipioId;
                if (selectMuni.value !== municipioId) {
                    console.warn("No se pudo autoseleccionar el municipio desde la URL:", municipioId);
                    return false;
                }

                selectMuni.dispatchEvent(new Event("change"));
                options.onApplied?.({ municipioId, deptoId, tab });
                return true;
            };

            const syncDeptoSelectValue = () => {
                const resolvedDepto = resolveDeptoSelectValue(selectDepto, deptoId);
                if (!resolvedDepto) return false;
                selectDepto.value = resolvedDepto;
                return true;
            };

            const applyDepto = () => {
                if (!syncDeptoSelectValue()) return false;
                selectDepto.dispatchEvent(new Event("change"));
                options.onApplied?.({ municipioId: "", deptoId, tab });
                return true;
            };

            if (municipioId) {
                if (deptoId) {
                    syncDeptoSelectValue();
                }

                if (typeof options.prepareTerritorySelection === "function") {
                    options.prepareTerritorySelection({
                        municipioId,
                        deptoId,
                        tab,
                        selectDepto,
                        selectMuni
                    });
                }

                global.setTimeout(() => {
                    applyMunicipio();
                }, Number(options.municipioDelayMs ?? (deptoId ? 350 : 0)));
                return;
            }

            if (typeof options.prepareTerritorySelection === "function") {
                options.prepareTerritorySelection({
                    municipioId,
                    deptoId,
                    tab,
                    selectDepto,
                    selectMuni
                });
            }

            applyDepto();
        }, { urlParams: { municipioId, deptoId, tab } });
    }

    function navigateToComponent(targetPage, tab, extraParams = {}) {
        global.location.href = buildComponentHref(targetPage, {
            tab,
            ...getTerritoryFromSelects(
                document.getElementById("departamentos"),
                document.getElementById("municipios")
            ),
            extraParams
        });
    }

    global.ModuleNavigation = {
        normalizeTerritoryCode,
        normalizeMunicipioId,
        normalizeDeptoId,
        resolveDeptoSelectValue,
        parseComponentUrlParams,
        buildComponentHref,
        getTerritoryFromSelects,
        mergeHrefWithTerritory,
        waitForTerritorySelects,
        applyTerritorySelectionFromUrl,
        navigateToComponent
    };
})(window);
