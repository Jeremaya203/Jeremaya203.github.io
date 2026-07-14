import { socioeconomicoLayerUrl } from "../services/serviceRoots.js?v=sigi-service-roots-20260604";
import { MUNICIPALITY_REQUIRED_SUMMARY_MESSAGE } from "../charts/ui/municipalityRequiredState.js?v=global-municipality-required-state-20260604";

export function createSummaryController({
    getFiltroNivel,
    getMunicipioActual,
    getDeptoActual,
    getMunicipioInfo,
    setMunicipioInfo,
    getActiveLayerConfig,
    hideTimeSlider,
    setTimeSliderTouched
}) {
    let pendingTextSourceKey = "";
    const defaultUnavailableText = "La información descriptiva para este municipio aún no se encuentra disponible. Actualmente la base de datos se encuentra en proceso de actualización y carga de información.";
    const pibTextSource = {
        url: socioeconomicoLayerUrl(44),
        field: "analisispib",
        filterField: "mpcodigo"
    };

    function getMunicipalTextSource(config) {
        const activeChartTextSource = window.__activeSocioChartConfig?.textSource;
        if (activeChartTextSource?.url && (activeChartTextSource?.field || activeChartTextSource?.fields?.length)) return activeChartTextSource;
        if (config?.textSource?.url && (config?.textSource?.field || config?.textSource?.fields?.length)) return config.textSource;
        const chartTitle = document.getElementById("chartTitle")?.textContent || "";
        const isPib = config?.chartVariantKey === "PIB" ||
            config?.key === "PIB_DEPARTMENT" ||
            /PIB por departamento/i.test(chartTitle);
        return isPib ? pibTextSource : null;
    }

    async function cargarInfoMunicipio(codigo) {
        hideTimeSlider();
        setTimeSliderTouched(false);

        const config = getActiveLayerConfig();
        const textSource = getMunicipalTextSource(config);
        if (textSource?.url && (textSource?.field || textSource?.fields?.length)) {
            const filterField = textSource.filterField || "mpcodigo";
            const outFields = textSource.fields?.length ? textSource.fields.join(",") : textSource.field;
            const queryUrl = `${textSource.url}/query?where=${filterField}='${String(codigo).replace(/'/g, "''")}'&outFields=${outFields}&returnGeometry=false&f=json`;

            try {
                const res = await fetch(queryUrl);
                const json = await res.json();
                setMunicipioInfo(json.features && json.features.length > 0 ? json.features[0].attributes : null);
                actualizarResumen();
                return;
            } catch (e) {
                console.error("Error cargando texto municipal de la capa", e);
                setMunicipioInfo(null);
                actualizarResumen();
                return;
            }
        }

        const url = "https://mapas2.igac.gov.co/server/rest/services/ordenamiento/componentebiofisico/MapServer/40";
        const queryUrl = `${url}/query?where=mpcodigo='${codigo}'&outFields=*&returnGeometry=false&f=json`;

        try {
            const res = await fetch(queryUrl);
            const json = await res.json();
            setMunicipioInfo(json.features && json.features.length > 0 ? json.features[0].attributes : null);
            actualizarResumen();
        } catch (e) {
            console.error("Error cargando info municipio", e);
            setMunicipioInfo(null);
            actualizarResumen();
        }
    }

    async function cargarTextoMunicipal(codigo, textSource) {
        const filterField = textSource.filterField || "mpcodigo";
        const outFields = textSource.fields?.length ? textSource.fields.join(",") : textSource.field;
        const queryUrl = `${textSource.url}/query?where=${filterField}='${String(codigo).replace(/'/g, "''")}'&outFields=${outFields}&returnGeometry=false&f=json`;
        const res = await fetch(queryUrl);
        const json = await res.json();
        return json.features && json.features.length > 0 ? json.features[0].attributes : null;
    }

    function hasRealContent(value) {
        if (value == null) return false;
        const normalized = String(value).trim();
        return normalized !== "" && normalized.toLowerCase() !== "undefined" && normalized.toLowerCase() !== "null";
    }

    function getUnavailableMessage(config, textSource) {
        return textSource?.emptyMessage || config?.emptySummaryMessage || defaultUnavailableText;
    }

    function renderSummaryText(div, text) {
        div.innerHTML = "";
        const p = document.createElement("p");
        p.textContent = text;
        div.appendChild(p);
    }

    function renderSummaryTexts(div, entries = []) {
        div.innerHTML = "";
        entries.forEach(entry => {
            const p = document.createElement("p");
            if (entry.label) {
                const strong = document.createElement("strong");
                strong.textContent = `${entry.label}: `;
                p.appendChild(strong);
            }
            p.appendChild(document.createTextNode(entry.text));
            div.appendChild(p);
        });
    }

    function buildTourismMergedNarrative(attrs, unavailableMessage) {
        const obs = hasRealContent(attrs?.obsitr) ? String(attrs.obsitr).trim() : "";
        const ana = hasRealContent(attrs?.analisisitr) ? String(attrs.analisisitr).trim() : "";
        if (!obs && !ana) return unavailableMessage;
        if (!obs) return ana;
        if (!ana) return obs;
        return `${obs}\n\n${ana}`;
    }

    function buildFieldsMergedNarrative(attrs, fields = [], unavailableMessage) {
        const blocks = fields
            .map(fieldName => hasRealContent(attrs?.[fieldName]) ? String(attrs[fieldName]).trim() : "")
            .filter(Boolean);
        return blocks.length ? blocks.join("\n\n") : unavailableMessage;
    }

    function renderMergedFieldsSummary(div, attrs, fields, config, textSource) {
        const narrative = buildFieldsMergedNarrative(
            attrs,
            fields,
            getUnavailableMessage(config, textSource)
        );
        const blocks = narrative.split(/\n\s*\n/).map(item => item.replace(/\s+/g, " ").trim()).filter(Boolean);
        if (blocks.length > 1) {
            renderSummaryTexts(div, blocks.map(text => ({ text })));
        } else {
            renderSummaryText(div, blocks[0] || narrative);
        }
    }

    function actualizarResumen() {
        const div = document.getElementById("summaryDiv");
        if (!div) return;

        const config = getActiveLayerConfig();
        const selectedMunicipality = String(document.getElementById("municipios")?.value || "").trim();

        if (config?.key === "POVERTY_LEVEL" && !/^\d{5}$/.test(selectedMunicipality)) {
            pendingTextSourceKey = "";
            div.innerHTML = MUNICIPALITY_REQUIRED_SUMMARY_MESSAGE;
            return;
        }

        if (getFiltroNivel() === "DEPTO") {
            div.innerHTML = MUNICIPALITY_REQUIRED_SUMMARY_MESSAGE;
            return;
        }

        const municipioInfo = getMunicipioInfo();

        if (!getMunicipioActual()) {
            div.innerHTML = "Seleccione un municipio para ver el resumen.";
            return;
        }

        if (!config || !municipioInfo) {
            div.innerHTML = "Cargando información o no disponible...";
            return;
        }

        const field = config.summaryField;
        if (field && hasRealContent(municipioInfo[field])) {
            renderSummaryText(div, municipioInfo[field]);
        } else {
            const textSource = getMunicipalTextSource(config);
            const municipio = getMunicipioActual();
            const textField = textSource?.field;
            const textFields = textSource?.fields || (textField ? [textField] : []);
            if (textSource && municipio) {
                const key = `${textSource.url}|${textFields.join(",")}|${municipio}`;
                const hasAllTextFields = textFields.every(fieldName =>
                    Object.prototype.hasOwnProperty.call(municipioInfo || {}, fieldName)
                );
                if (
                    textSource.mergeStrategy === "tourism_obs_then_analysis" &&
                    municipioInfo &&
                    hasAllTextFields
                ) {
                    const narrative = buildTourismMergedNarrative(
                        municipioInfo,
                        getUnavailableMessage(config, textSource)
                    );
                    const blocks = narrative.split(/\n\s*\n/).map(item => item.replace(/\s+/g, " ").trim()).filter(Boolean);
                    if (blocks.length > 1) {
                        renderSummaryTexts(div, blocks.map(text => ({ text })));
                    } else {
                        renderSummaryText(div, blocks[0] || narrative);
                    }
                    return;
                }
                if (
                    textSource.mergeStrategy === "fields_without_labels" &&
                    municipioInfo &&
                    hasAllTextFields
                ) {
                    renderMergedFieldsSummary(div, municipioInfo, textFields, config, textSource);
                    return;
                }
                if (textFields.length > 1 && municipioInfo && hasAllTextFields) {
                    const entries = textFields.map(fieldName => ({
                        label: textSource.labels?.[fieldName] || fieldName,
                        text: hasRealContent(municipioInfo?.[fieldName])
                            ? municipioInfo[fieldName]
                            : getUnavailableMessage(config, textSource)
                    }));
                    renderSummaryTexts(div, entries);
                    return;
                }

                if (hasRealContent(municipioInfo?.[textField])) {
                    const transform = typeof window.__activeSocioChartConfig?.textTransform === "function"
                        ? window.__activeSocioChartConfig.textTransform
                        : null;
                    const renderedText = transform
                        ? transform(municipioInfo[textField], getUnavailableMessage(config, textSource))
                        : municipioInfo[textField];
                    renderSummaryText(div, renderedText);
                    return;
                }

                if (municipioInfo && textField && Object.prototype.hasOwnProperty.call(municipioInfo, textField)) {
                    renderSummaryText(div, getUnavailableMessage(config, textSource));
                    return;
                }

                if (pendingTextSourceKey !== key) {
                    pendingTextSourceKey = key;
                    div.innerHTML = "Cargando información...";
                    cargarTextoMunicipal(municipio, textSource)
                        .then(attrs => {
                            pendingTextSourceKey = "";
                            setMunicipioInfo(attrs);
                            actualizarResumen();
                        })
                        .catch(e => {
                            pendingTextSourceKey = "";
                            console.error("Error cargando texto municipal de la capa", e);
                            renderSummaryText(div, getUnavailableMessage(config, textSource));
                        });
                    return;
                }

                div.innerHTML = "Cargando información...";
            } else {
                renderSummaryText(div, getUnavailableMessage(config, textSource));
            }
        }
    }

    return {
        cargarInfoMunicipio,
        actualizarResumen
    };
}
