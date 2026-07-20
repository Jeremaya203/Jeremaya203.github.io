export {
    buildLegendFromRenderer,
    getSymbolColorRGBA,
    syncLegendToLabelSelection,
    sortLegendEntries
} from "../legend.js";

export function toggleBiofisicoLegend() {
    const content = document.getElementById("legendContent");
    const toggle = document.getElementById("legendToggle");

    if (content.classList.contains("collapsed")) {
        content.classList.remove("collapsed");
        toggle.textContent = "−";
    } else {
        content.classList.add("collapsed");
        toggle.textContent = "+";
    }
}

export function renderBiofisicoLegend({
    labels,
    colors,
    codes = null,
    config,
    layer = null,
    ordenDegradacion,
    ordenSismica
}) {
    const content = document.getElementById("legendContent");
    const title = document.getElementById("legendTitle");

    if (!content || !title) return;

    if (!config) {
        content.innerHTML = "<p class='oot-js-biofisico-legend-1'>No hay capa activa</p>";
        title.textContent = "Leyenda";
        return;
    }

    title.textContent = config.title || "Leyenda";
    window.__lastLegendRenderKey = window.__lastLegendRenderKey || "";

    if (!labels || !labels.length) {
        content.innerHTML = "<p class='oot-js-biofisico-legend-1'>Sin clases</p>";
        return;
    }

    let keys = (codes && codes.length === labels.length)
        ? codes.map(value => String(value ?? "").trim())
        : labels.map(value => String(value ?? "").trim());

    if (
        config?.isFenomenos &&
        ["inundaciones", "remocion", "degradacion", "sismica"].includes(config?.fenomenosType)
    ) {
        let orden = null;

        if (config.fenomenosType === "inundaciones" || config.fenomenosType === "remocion") {
            orden = {
                "Muy baja": 1,
                "Baja": 2,
                "Media": 3,
                "Alta": 4,
                "Muy alta": 5,
                "Sin información": 99
            };
        }

        if (config.fenomenosType === "degradacion") {
            orden = ordenDegradacion;
        }

        if (config.fenomenosType === "sismica") {
            orden = ordenSismica;
        }

        const items = labels.map((label, index) => ({
            label,
            color: colors[index] || "#ccc",
            code: keys[index]
        }));

        items.sort((a, b) => (orden?.[a.label] ?? 999) - (orden?.[b.label] ?? 999));

        labels = items.map(item => item.label);
        colors = items.map(item => item.color);
        keys = items.map(item => item.code);
    }

    const normalizedItems = labels
        .map((label, index) => ({
            label,
            color: colors[index],
            code: String(keys[index] ?? label ?? "").trim()
        }))
        .filter(item =>
            String(item.label ?? "").trim() &&
            item.code &&
            item.code.toLowerCase() !== "null" &&
            item.code.toLowerCase() !== "undefined"
        );

    labels = normalizedItems.map(item => item.label);
    colors = normalizedItems.map(item => item.color);
    keys = normalizedItems.map(item => item.code);

    if (!labels.length) {
        content.innerHTML = "<p class='oot-js-biofisico-legend-1'>Sin clases</p>";
        window.__legendState = {
            ...(window.__legendState || {}),
            allCodes: [],
            activeCodes: new Set(),
            field: null,
            fields: []
        };
        return;
    }

    content.innerHTML = "";

    const fragment = document.createDocumentFragment();
    const isInteractive = config.legendInteractive !== false;
    const allCodes = keys.map(value => String(value ?? "").trim()).filter(Boolean);
    const fields = getLegendFilterFields(config, layer);
    const field = fields[0] || null;
    const previousState = window.__legendState || {};
    const previousAllCodes = Array.isArray(previousState.allCodes)
        ? previousState.allCodes.map(value => String(value ?? "").trim())
        : [];
    const previousActiveCodes = previousState.activeCodes instanceof Set
        ? previousState.activeCodes
        : null;
    const isSameLegendState =
        previousState.field === field &&
        previousAllCodes.length === allCodes.length &&
        previousAllCodes.every((code, index) => code === allCodes[index]);
    const activeCodes = isSameLegendState && previousActiveCodes
        ? new Set(allCodes.filter(code => previousActiveCodes.has(code)))
        : new Set(allCodes);

    window.__legendState = {
        ...previousState,
        allCodes,
        activeCodes,
        field,
        fields,
        baseWhere: previousState.baseWhere || "1=1"
    };

    labels.forEach((label, index) => {
        const row = document.createElement("div");
        const code = String(keys[index] ?? label ?? "").trim();
        const isActive = activeCodes.has(code);
        row.className = "legend-item legend-row";
        row.dataset.code = code;
        if (isInteractive) {
            row.setAttribute("role", "button");
            row.setAttribute("tabindex", "0");
            row.setAttribute("aria-pressed", isActive ? "true" : "false");
            row.title = "Activar/desactivar categoria";
        }
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.gap = "8px";
        row.style.marginBottom = "6px";
        row.style.cursor = isInteractive ? "pointer" : "default";

        row.classList.toggle("active", isActive);

        if (!isActive) {
            row.classList.add("off");
        }

        const swatch = document.createElement("span");
        swatch.className = "legend-swatch";
        swatch.style.display = "inline-block";
        swatch.style.width = "12px";
        swatch.style.height = "12px";
        swatch.style.minWidth = "12px";
        swatch.style.borderRadius = "2px";
        swatch.style.marginRight = "8px";
        swatch.style.flex = "0 0 12px";
        swatch.style.background = colors[index] || "#999";

        const text = document.createElement("span");
        text.className = "legend-label";
        text.textContent = label ?? "Sin etiqueta";

        row.appendChild(swatch);
        row.appendChild(text);
        fragment.appendChild(row);
    });

    content.appendChild(fragment);
}

function getLegendFilterFields(config, layer) {
    if (!config) return [];
    if (config.legendInteractive === false) return [];

    const url = String(layer?.url || "");

    if (config.id === "pendientes") return ["categoria"];
    if (config.id === "hipsometria" || config.id === "hipsometria_depto") return ["rangoh"];
    if (config.isGeoforma) return ["paisaje", "trelieve"];

    const rendererFields = getRendererFields(layer);
    if (rendererFields.length) return rendererFields;

    if (config.isHidro && config.hidroType === "cuencas") return ["szhid"];
    if (config.isEcosistema && config.ecosistemaType === "ecosistemas" && url.endsWith("/25")) return ["condicion"];
    if (config.isEcosistema && config.ecosistemaType === "ecosistemas") return ["ecosgen"];
    if (config.isSuelos && config.suelosType === "orden") return ["ordsuelo"];
    if (config.isSuelos && config.suelosType === "vocacion") {
        const hasUsoField = Array.isArray(layer?.fields) &&
            layer.fields.some(field => String(field?.name || "").toLowerCase() === "usopvoc");
        return (hasUsoField || url.endsWith("/30")) ? ["vocacion", "usopvoc"] : ["vocacion"];
    }
    if (config.isFenomenos && config.fenomenosType === "degradacion") return ["gradodeg"];
    return config.labelField ? [config.labelField] : [];
}

function getRendererFields(layer) {
    const renderer = layer?.renderer;
    const rendererJson = typeof renderer?.toJSON === "function" ? renderer.toJSON() : renderer;
    const type = String(renderer?.type || rendererJson?.type || "").toLowerCase();
    if (!renderer || (type !== "unique-value" && type !== "uniquevalue")) return [];

    return [
        renderer.field || renderer.field1 || rendererJson?.field || rendererJson?.field1,
        renderer.field2 || rendererJson?.field2,
        renderer.field3 || rendererJson?.field3
    ]
        .map(value => String(value ?? "").trim())
        .filter(Boolean);
}

export function getBiofisicoLegendOutFields(config, layer) {
    if (config.isDeptoRiskCount) return [];
    if (config.isBF3) return ["paisaje"];
    if (!config) return ["*"];

    if (config.isRadar) return [config.labelField || "riesgocc"];
    if (config.isGeoforma) return ["paisaje", "trelieve"];

    if (config.isClima) {
        return [config.labelField];
    }

    if (config.isHidro) {
        if (config.hidroType === "cuencas") {
            const rendererFields = getRendererFields(layer);
            return (rendererFields.length ? rendererFields : ["szhid", "areahidro", "zonahid"]);
        }
        return [config.labelField];
    }

    if (config.isEcosistema) {
        const url = String(layer?.url || "");
        if (config.ecosistemaType === "ecosistemas" && url.endsWith("/25")) return ["condicion"];
        if (config.ecosistemaType === "ecosistemas") return ["ecosgen"];
        return [config.labelField];
    }

    if (config.isSuelos) {
        if (config.suelosType === "vocacion") return ["vocacion", "usopvoc"];
        if (config.suelosType === "orden") return ["ordsuelo"];
        return [config.labelField];
    }

    if (config.isFenomenos) return [config.labelField];

    return [config.labelField];
}

export function buildPaisajeDictFromRenderer(layer, {
    getSymbolColorRGBA,
    normKey
}) {
    const map = new Map();
    const renderer = layer?.renderer;
    const rendererJson = typeof renderer?.toJSON === "function" ? renderer.toJSON() : renderer;
    const type = String(renderer?.type || rendererJson?.type || "").toLowerCase();
    if (!renderer || (type !== "unique-value" && type !== "uniquevalue")) return map;

    const uniqueValueInfos = renderer.uniqueValueInfos || rendererJson?.uniqueValueInfos || [];
    const uniqueValueGroups = renderer.uniqueValueGroups || rendererJson?.uniqueValueGroups || [];

    const fallbackColor = (() => {
        const info = uniqueValueInfos.find(item => getSymbolColorRGBA(item.symbol));
        if (info) return getSymbolColorRGBA(info.symbol);
        for (const group of uniqueValueGroups) {
            const cls = (group.classes || []).find(item => getSymbolColorRGBA(item.symbol));
            if (cls) return getSymbolColorRGBA(cls.symbol);
        }
        return null;
    })();

    uniqueValueInfos.forEach(info => {
        const value = String(info.value ?? "").trim();
        const label = String(info.label ?? value).trim();
        const color = getSymbolColorRGBA(info.symbol) || fallbackColor || "#5f7fec";

        if (value) map.set(value, { label, color });
        if (label) map.set(normKey(label), { label, color });
    });

    uniqueValueGroups.forEach(group => {
        (group.classes || []).forEach(cls => {
            const rawValues = Array.isArray(cls?.values) && cls.values.length
                ? cls.values
                : [cls?.value || []];
            const label = String(cls.label || cls.description || "").trim();
            const color = getSymbolColorRGBA(cls.symbol) || fallbackColor || "#5f7fec";

            rawValues.forEach(raw => {
                const code = Array.isArray(raw)
                    ? raw.flat(Infinity).map(part => String(part ?? "").trim()).filter(Boolean).join(",")
                    : String(raw ?? "").trim();
                const finalLabel = label || code;

                if (code) map.set(code, { label: finalLabel, color });
                if (finalLabel) map.set(normKey(finalLabel), { label: finalLabel, color });
            });
        });
    });

    return map;
}
