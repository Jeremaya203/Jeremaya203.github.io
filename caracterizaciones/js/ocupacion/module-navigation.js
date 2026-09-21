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

    static resolveDeptoSelectValue(departmentSelect, departmentId) {
        if (!departmentSelect || !departmentId) return "";

        const candidates = [departmentId, this.normalizeDeptoId(departmentId)];
        if (/^\d+$/.test(departmentId)) {
            candidates.push(departmentId.padStart(2, "0"));
        }

        const optionValues = new Set(Array.from(departmentSelect.options, option => option.value));
        return [...new Set(candidates)].find(code => optionValues.has(code)) || "";
    }

    static parseComponentUrlParams(search = window.location.search) {
        const params = new URLSearchParams(search);
        return {
            tab: params.get("tab"),
            municipalityId: this.normalizeMunicipioId(params.get("id")),
            departmentId: this.normalizeDeptoId(params.get("depto"))
        };
    }

    static buildComponentHref(targetPage, options = {}) {
        const tab = options.tab ?? null;
        const municipalityId = this.normalizeMunicipioId(options.municipalityId);
        const departmentId = this.normalizeDeptoId(options.departmentId);
        const extraParams = options.extraParams || {};
        const params = new URLSearchParams();

        if (tab) params.set("tab", tab);
        if (departmentId) params.set("depto", departmentId);
        if (municipalityId) params.set("id", municipalityId);

        Object.entries(extraParams).forEach(([key, value]) => {
            const normalized = this.normalizeTerritoryCode(value);
            if (normalized) params.set(key, normalized);
        });

        const query = params.toString();
        return query ? `${targetPage}?${query}` : targetPage;
    }

    static getTerritoryFromSelects(departmentSelect, selectMuni) {
        const municipalityId = this.normalizeMunicipioId(selectMuni?.value);
        const rawDepartmentId = this.normalizeTerritoryCode(departmentSelect?.value);
        let departmentId = "";

        if (municipalityId) {
            departmentId = municipalityId.substring(0, 2);
        } else if (rawDepartmentId && rawDepartmentId !== "0" && rawDepartmentId !== "COL") {
            departmentId = this.normalizeDeptoId(rawDepartmentId);
        }

        return { municipalityId, departmentId };
    }

    static mergeHrefWithTerritory(href, territory = {}) {
        const url = new URL(href, window.location.href);
        const municipalityId = this.normalizeMunicipioId(territory.municipalityId);
        const departmentId = this.normalizeDeptoId(territory.departmentId);

        if (departmentId) url.searchParams.set("depto", departmentId);
        else url.searchParams.delete("depto");

        if (municipalityId) url.searchParams.set("id", municipalityId);
        else url.searchParams.delete("id");

        return `${url.pathname}${url.search}${url.hash}`;
    }

    static waitForTerritorySelects(callback, options = {}) {
        const maxAttempts = Number(options.maxAttempts ?? 20);
        const intervalMs = Number(options.intervalMs ?? 500);
        let attempts = 0;

        const timer = window.setInterval(() => {
            attempts += 1;

            const departmentSelect = document.getElementById("departamentos");
            const selectMuni = document.getElementById("municipios");
            const departmentSelectReady = Boolean(departmentSelect && departmentSelect.options.length > 1);
            const muniSelectReady = Boolean(selectMuni);
            const ready = Boolean(departmentSelect && selectMuni && departmentSelectReady && muniSelectReady);

            if (ready || attempts >= maxAttempts) {
                window.clearInterval(timer);
                callback({ departmentSelect, selectMuni, ready });
            }
        }, intervalMs);
    }

    static applyTerritorySelectionFromUrl(options = {}) {
        const { tab, municipalityId: urlMunicipioId, departmentId: urlDeptoId } = this.parseComponentUrlParams();
        const municipalityId = urlMunicipioId;
        const departmentId = this.normalizeDeptoId(urlDeptoId) || (municipalityId ? this.normalizeDeptoId(municipalityId.substring(0, 2)) : "");

        if (tab && typeof options.onTab === "function") {
            window.setTimeout(() => options.onTab(tab), Number(options.tabDelayMs ?? 500));
        }

        if (!municipalityId && !departmentId) return;

        this.waitForTerritorySelects(({ departmentSelect, selectMuni, ready }) => {
            if (!ready) {
                console.warn("No se pudo aplicar territorio desde la URL:", { municipalityId, departmentId, tab });
                return;
            }

            const applyMunicipality = () => {
                if (!municipalityId || !selectMuni) return false;

                selectMuni.value = municipalityId;
                if (selectMuni.value !== municipalityId) {
                    console.warn("No se pudo autoseleccionar el municipio desde la URL:", municipalityId);
                    return false;
                }

                selectMuni.dispatchEvent(new Event("change"));
                options.onApplied?.({ municipalityId, departmentId, tab });
                return true;
            };

            const syncDepartmentSelectValue = () => {
                const resolvedDepartment = this.resolveDeptoSelectValue(departmentSelect, departmentId);
                if (!resolvedDepartment) return false;
                departmentSelect.value = resolvedDepartment;
                return true;
            };

            const applyDepartment = () => {
                if (!syncDepartmentSelectValue()) return false;
                departmentSelect.dispatchEvent(new Event("change"));
                options.onApplied?.({ municipalityId: "", departmentId, tab });
                return true;
            };

            if (municipalityId) {
                if (departmentId) syncDepartmentSelectValue();

                options.prepareTerritorySelection?.({
                    municipalityId,
                    departmentId,
                    tab,
                    departmentSelect,
                    selectMuni
                });

                window.setTimeout(() => {
                    applyMunicipality();
                }, Number(options.municipioDelayMs ?? (departmentId ? 350 : 0)));
                return;
            }

            options.prepareTerritorySelection?.({
                municipalityId,
                departmentId,
                tab,
                departmentSelect,
                selectMuni
            });

            applyDepartment();
        }, { urlParams: { municipalityId, departmentId, tab } });
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
