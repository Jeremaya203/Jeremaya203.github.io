class ModuleNavigation {
    static normalizeTerritoryCode(value) {
        return String(value ?? "").trim();
    }

    static normalizeMunicipioId(value) {
        const normalized = this.normalizeTerritoryCode(value);
        if (/^\d{5}$/.test(normalized)) return normalized;
        if (/^\d{1,4}$/.test(normalized)) return normalized.padStart(5, "0");
        return "";
    }

    static normalizeDeptoId(value) {
        const normalized = this.normalizeTerritoryCode(value);
        if (/^\d{2}$/.test(normalized)) return normalized;
        if (/^\d$/.test(normalized)) return normalized.padStart(2, "0");
        return "";
    }

    static resolveDeptoSelectValue(selectDepto, deptoId) {
        if (!selectDepto || !deptoId) return "";

        const candidates = [deptoId, this.normalizeDeptoId(deptoId)];
        if (/^\d+$/.test(deptoId)) {
            candidates.push(deptoId.padStart(2, "0"));
        }

        const optionValues = new Set(Array.from(selectDepto.options, option => option.value));
        return [...new Set(candidates)].find(code => optionValues.has(code)) || "";
    }

    static parseComponentUrlParams(search = window.location.search) {
        const params = new URLSearchParams(search);
        return {
            tab: params.get("tab"),
            municipioId: this.normalizeMunicipioId(params.get("id")),
            deptoId: this.normalizeDeptoId(params.get("depto"))
        };
    }

    static buildComponentHref(targetPage, options = {}) {
        const tab = options.tab ?? null;
        const municipioId = this.normalizeMunicipioId(options.municipioId);
        const deptoId = this.normalizeDeptoId(options.deptoId);
        const extraParams = options.extraParams || {};
        const params = new URLSearchParams();

        if (tab) params.set("tab", tab);
        if (deptoId) params.set("depto", deptoId);
        if (municipioId) params.set("id", municipioId);

        Object.entries(extraParams).forEach(([key, value]) => {
            const normalized = this.normalizeTerritoryCode(value);
            if (normalized) params.set(key, normalized);
        });

        const query = params.toString();
        return query ? `${targetPage}?${query}` : targetPage;
    }

    static getTerritoryFromSelects(selectDepto, selectMuni) {
        const municipioId = this.normalizeMunicipioId(selectMuni?.value);
        const deptoRaw = this.normalizeTerritoryCode(selectDepto?.value);
        let deptoId = "";

        if (municipioId) {
            deptoId = municipioId.substring(0, 2);
        } else if (deptoRaw && deptoRaw !== "0" && deptoRaw !== "COL") {
            deptoId = this.normalizeDeptoId(deptoRaw);
        }

        return { municipioId, deptoId };
    }

    static mergeHrefWithTerritory(href, territory = {}) {
        const url = new URL(href, window.location.href);
        const municipioId = this.normalizeMunicipioId(territory.municipioId);
        const deptoId = this.normalizeDeptoId(territory.deptoId);

        if (deptoId) url.searchParams.set("depto", deptoId);
        else url.searchParams.delete("depto");

        if (municipioId) url.searchParams.set("id", municipioId);
        else url.searchParams.delete("id");

        return `${url.pathname}${url.search}${url.hash}`;
    }

    static waitForTerritorySelects(callback, options = {}) {
        const maxAttempts = Number(options.maxAttempts ?? 20);
        const intervalMs = Number(options.intervalMs ?? 500);
        let attempts = 0;

        const timer = window.setInterval(() => {
            attempts += 1;

            const selectDepto = document.getElementById("departamentos");
            const selectMuni = document.getElementById("municipios");
            const deptoSelectReady = Boolean(selectDepto && selectDepto.options.length > 1);
            const muniSelectReady = Boolean(selectMuni);
            const ready = Boolean(selectDepto && selectMuni && deptoSelectReady && muniSelectReady);

            if (ready || attempts >= maxAttempts) {
                window.clearInterval(timer);
                callback({ selectDepto, selectMuni, ready });
            }
        }, intervalMs);
    }

    static applyTerritorySelectionFromUrl(options = {}) {
        const { tab, municipioId: urlMunicipioId, deptoId: urlDeptoId } = this.parseComponentUrlParams();
        const municipioId = urlMunicipioId;
        const deptoId = this.normalizeDeptoId(urlDeptoId) || (municipioId ? this.normalizeDeptoId(municipioId.substring(0, 2)) : "");

        if (tab && typeof options.onTab === "function") {
            window.setTimeout(() => options.onTab(tab), Number(options.tabDelayMs ?? 500));
        }

        if (!municipioId && !deptoId) return;

        this.waitForTerritorySelects(({ selectDepto, selectMuni, ready }) => {
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
                const resolvedDepto = this.resolveDeptoSelectValue(selectDepto, deptoId);
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
                if (deptoId) syncDeptoSelectValue();

                options.prepareTerritorySelection?.({
                    municipioId,
                    deptoId,
                    tab,
                    selectDepto,
                    selectMuni
                });

                window.setTimeout(() => {
                    applyMunicipio();
                }, Number(options.municipioDelayMs ?? (deptoId ? 350 : 0)));
                return;
            }

            options.prepareTerritorySelection?.({
                municipioId,
                deptoId,
                tab,
                selectDepto,
                selectMuni
            });

            applyDepto();
        }, { urlParams: { municipioId, deptoId, tab } });
    }

    static navigateToComponent(targetPage, tab, extraParams = {}) {
        window.location.href = this.buildComponentHref(targetPage, {
            tab,
            ...this.getTerritoryFromSelects(
                document.getElementById("departamentos"),
                document.getElementById("municipios")
            ),
            extraParams
        });
    }
}

window.ModuleNavigation = ModuleNavigation;
