import { AppState } from "../app/state.js";

function escapeSql(value) {
    return String(value ?? "").replace(/'/g, "''");
}

export function buildWhereBase(config = {}) {
    const municipioActual = AppState.municipioActual;
    const deptoActual = AppState.deptoActual;
    const filtroNivel = AppState.filtroNivel;

    const filterField = config?.filterField || "mpcodigo";

    if (filtroNivel === "MUNI" && municipioActual) {
        return `${filterField} = '${escapeSql(municipioActual)}'`;
    }

    if (filtroNivel === "DEPTO" && deptoActual) {
        if (config?.deptoFilterField) {
            return `${config.deptoFilterField} = '${escapeSql(deptoActual)}'`;
        }

        if (
            filterField.toLowerCase() === "mpcodigo" ||
            filterField.toLowerCase() === "mp_codigo"
        ) {
            return `SUBSTRING(${filterField},1,2) = '${escapeSql(deptoActual)}'`;
        }

        return "1=1";
    }

    return "1=1";
}

export function buildDefinitionExpression({
    baseWhere = "1=1",
    extraWhere = ""
} = {}) {
    const base = String(baseWhere || "1=1").trim();
    const extra = String(extraWhere || "").trim();

    if (!extra) return base || "1=1";
    if (!base || base === "1=1") return extra;

    return `${base} AND ${extra}`;
}

export function buildExtraWhere(config, context = {}) {
    const {
        timePeriod,
        field,
        value
    } = context;

    //  DEFORESTACIÓN
    if (config?.ecosistemaType === "deforestacion") {
        if (!timePeriod || timePeriod === "Todos") return "";
        return `periodobosque = '${timePeriod}'`;
    }

    //  CLIMA STACKED
    if (config?.isClima && config?.periodField) {
        if (!timePeriod || timePeriod === "Todos") return "";
        return `${config.periodField} = '${timePeriod}'`;
    }

    //  FILTRO GENÉRICO (click en gráfica)
    if (field && value !== undefined) {
        return `${field} = '${String(value).replace(/'/g, "''")}'`;
    }

    return "";
}

/**
 * Factory que crea las funciones de filtro por atributo/rango/periodo
 */
export function createAttributeFilters(deps) {
    const {
        getActiveLayerConfig,
        getWhereBase,
        getLayerGlobal,
        getView,
        getBf3LabelToCode,
        applyWhereToActiveLayers,
        syncLegendToLabelSelection,
        cachedQueryExtent,
        sqlEquals,
        andWhere,
        coloresGeoformas,
        coloresTemperatura,
        coloresPrecipitacion,
        coloresClimas,
        coloresCambioTemp,
        coloresCambioPrecip,
        coloresEscorrentia,
        coloresEcosistemas,
        coloresVocacion,
        coloresConflictos,
        coloresInundaciones,
        coloresRemocion,
        coloresDegradacion,
        coloresSismica,
        coloresHipsometricos
    } = deps;

    function filtrarPorRangoPeriodo(rangeCode, periodo) {
        const config = getActiveLayerConfig();
        if (!config || !config.periodField) return;

        const whereBase = getWhereBase();
        const where = andWhere(
            whereBase,
            `${sqlEquals(config.labelField, rangeCode)} AND ${sqlEquals(config.periodField, periodo)}`
        );

        const layerGlobal = getLayerGlobal();
        const view = getView();
        if (layerGlobal && where) {
            applyWhereToActiveLayers(where);
            const queryExtent = cachedQueryExtent || ((targetLayer, query) => targetLayer.queryExtent(query));
            queryExtent(layerGlobal, { where }).then(res => {
                if (res.extent) view.goTo(res.extent.expand(1.3));
            });
        }
    }

    function filtrarPorRangoCodigo(rangeCode) {
        const config = getActiveLayerConfig();
        if (!config) return;

        const whereBase = getWhereBase();
        const where = andWhere(whereBase, sqlEquals(config.labelField, rangeCode));

        const layerGlobal = getLayerGlobal();
        const view = getView();
        if (layerGlobal && where) {
            applyWhereToActiveLayers(where);
            const queryExtent = cachedQueryExtent || ((targetLayer, query) => targetLayer.queryExtent(query));
            queryExtent(layerGlobal, { where }).then(res => {
                if (res.extent) view.goTo(res.extent.expand(1.3));
            });
        }
    }

    function filtrarPorAtributo(val) {
        const config = getActiveLayerConfig();
        if (!config) return;
        if (config.isRadar) return;

        const whereBase = getWhereBase();
        let where = "";

        if (config.isBF3) {
            const bf3LabelToCode = getBf3LabelToCode();
            const code = bf3LabelToCode?.get(val);
            if (code != null) {
                const s = String(code).trim();
                const isNum = /^-?\d+(\.\d+)?$/.test(s);
                where = isNum
                    ? `${whereBase} AND paisaje = ${s}`
                    : `${whereBase} AND paisaje = '${s.replace(/'/g, "''")}'`;
            }
        } else if (config.isGeoforma) {
            let foundKey = null;
            for (const [key, info] of Object.entries(coloresGeoformas || {})) {
                if (info.label === val) { foundKey = key; break; }
            }
            if (foundKey) {
                const [p, t] = foundKey.split(",");
                where = `${whereBase} AND paisaje = ${p} AND trelieve = ${t}`;
            }
        } else if (config.isClima) {
            let dict = {};
            if (config.climaType === 'temp') dict = coloresTemperatura || {};
            else if (config.climaType === 'precip') dict = coloresPrecipitacion || {};
            else if (config.climaType === 'clima_tipo') dict = coloresClimas || {};
            else if (config.climaType === 'temp_cc') dict = coloresCambioTemp || {};
            else if (config.climaType === 'precip_cc') dict = coloresCambioPrecip || {};
            let foundKey = null;
            for (const [key, info] of Object.entries(dict)) {
                if (info.label === val) { foundKey = key; break; }
            }
            if (foundKey != null) where = `${whereBase} AND ${config.labelField} = ${foundKey}`;
        } else if (config.isHidro) {
            if (config.hidroType === 'cuencas') {
                const s = String(val).trim();
                const isNum = /^-?\d+(\.\d+)?$/.test(s);
                where = isNum
                    ? `${whereBase} AND ${config.labelField} = ${s}`
                    : `${whereBase} AND ${config.labelField} = '${s.replace(/'/g, "''")}'`;
            } else {
                let foundKey = null;
                for (const [key, info] of Object.entries(coloresEscorrentia || {})) {
                    if (info.label === val) { foundKey = key; break; }
                }
                if (foundKey) where = `${whereBase} AND ${config.labelField} = ${foundKey}`;
            }
        } else if (config.isEcosistema) {
            if (config.ecosistemaType === 'deforestacion') {
                const foundKey = (val === "Deforestación") ? 14001 : (val === "Regeneración") ? 14002 : null;
                if (foundKey) where = `${whereBase} AND ${config.labelField} = ${foundKey}`;
            } else {
                let foundKey = null;
                for (const [k, info] of Object.entries(coloresEcosistemas || {})) {
                    if (info.label === val) { foundKey = k; break; }
                }
                const valueToSearch = foundKey || val;
                where = `${whereBase} AND ${config.labelField} = '${String(valueToSearch).replace(/'/g, "''")}'`;
            }
        } else if (config.isSuelos) {
            if (config.suelosType === 'vocacion') {
                let foundKey = null;
                for (const [k, info] of Object.entries(coloresVocacion || {})) {
                    if (info.label === val) { foundKey = k; break; }
                }
                if (foundKey) {
                    const [v, u] = foundKey.split(",");
                    where = `${whereBase} AND vocacion = ${v} AND usopvoc = ${u}`;
                }
            } else {
                let foundKey = null;
                for (const [k, info] of Object.entries(coloresConflictos || {})) {
                    if (info.label === val) { foundKey = k; break; }
                }
                if (foundKey) where = `${whereBase} AND ${config.labelField} = ${foundKey}`;
            }
        } else if (config.isFenomenos) {
            let dict = {};
            if (config.fenomenosType === 'inundaciones') dict = coloresInundaciones || {};
            if (config.fenomenosType === 'remocion') dict = coloresRemocion || {};
            if (config.fenomenosType === 'degradacion') dict = coloresDegradacion || {};
            if (config.fenomenosType === 'sismica') dict = coloresSismica || {};
            let foundKey = null;
            for (const [k, info] of Object.entries(dict || {})) {
                if (info.label === val) { foundKey = k; break; }
            }
            if (foundKey != null) where = `${whereBase} AND ${config.labelField} = ${foundKey}`;
        } else {
            let foundKey = null;
            for (const [k, info] of Object.entries(coloresHipsometricos || {})) {
                if (info.label === val) { foundKey = k; break; }
            }
            if (foundKey != null) where = `${whereBase} AND ${config.labelField} = ${foundKey}`;
        }

        const layerGlobal = getLayerGlobal();
        const view = getView();
        if (layerGlobal && where) {
            applyWhereToActiveLayers(where);
            const queryExtent = cachedQueryExtent || ((targetLayer, query) => targetLayer.queryExtent(query));
            queryExtent(layerGlobal, { where }).then(res => {
                if (res.extent) view.goTo(res.extent.expand(1.3));
            });
            syncLegendToLabelSelection(val);
        }
    }

    return { filtrarPorRangoPeriodo, filtrarPorRangoCodigo, filtrarPorAtributo };
}
