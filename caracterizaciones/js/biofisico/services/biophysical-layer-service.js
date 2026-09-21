import { rgbaArrayToCss } from "../utils/biophysical-arcgis-utils.js";
import { rgbaFromEsriColorArr } from "../utils.js";

export let soilOrderColors = null;
export let ruralCategoryDictionary = null;
export let landformRendererDictionary = null;
export let landformLandscapeDictionary = null;
export let landSuitabilityRendererDictionary = null;
export let landSuitabilityMainDictionary = null;

export async function ensureSoilOrderDictionary(layerUrl28) {
    if (soilOrderColors) return soilOrderColors;

    const url = layerUrl28.replace(/\/+$/, "") + "?f=pjson";
    const res = await fetch(url);
    const json = await res.json();
    const infos = json?.drawingInfo?.renderer?.uniqueValueInfos || [];
    const dict = {};

    infos.forEach(info => {
        const value = String(info.value ?? "").trim();
        const label = String(info.label ?? value).trim();
        const color = rgbaFromEsriColorArr(info?.symbol?.color);
        if (value) dict[value] = { label, color };
    });

    soilOrderColors = dict;
    return dict;
}

export async function ensureRuralCategoryDictionary(layerUrl) {
    if (ruralCategoryDictionary) return ruralCategoryDictionary;

    const url = String(layerUrl).replace(/\/+$/, "") + "?f=pjson";
    const res = await fetch(url);
    const json = await res.json();

    ruralCategoryDictionary = {};
    window.__ruralCategoriaColorMap = {};

    const renderer = json?.drawingInfo?.renderer || {};
    const groups = renderer?.uniqueValueGroups || [];
    const infos = renderer?.uniqueValueInfos || [];

    if (groups.length) {
        groups.forEach(group => {
            (group.classes || []).forEach(cls => {
                const vals = cls.values?.[0] || [];
                const code = String(vals[0] ?? "").trim();
                if (!code) return;

                const fill = rgbaArrayToCss(cls?.symbol?.color, "#999");
                const outline = rgbaArrayToCss(cls?.symbol?.outline?.color, "rgba(0,0,0,0)");
                const width = Number(cls?.symbol?.outline?.width ?? 0);
                const label = String(cls.label || cls.description || code).trim();

                ruralCategoryDictionary[code] = {
                    code,
                    label,
                    fillColor: fill,
                    outlineColor: outline,
                    outlineWidth: width
                };

                window.__ruralCategoriaColorMap[label] = fill;
            });
        });
    }

    if (!Object.keys(ruralCategoryDictionary).length && infos.length) {
        infos.forEach(info => {
            const code = String(info.value ?? "").trim();
            if (!code) return;

            const fill = rgbaArrayToCss(info?.symbol?.color, "#999");
            const outline = rgbaArrayToCss(info?.symbol?.outline?.color, "rgba(0,0,0,0)");
            const width = Number(info?.symbol?.outline?.width ?? 0);
            const label = String(info.label ?? code).trim();

            ruralCategoryDictionary[code] = {
                code,
                label,
                fillColor: fill,
                outlineColor: outline,
                outlineWidth: width
            };

            window.__ruralCategoriaColorMap[label] = fill;
        });
    }

    return ruralCategoryDictionary;
}

export async function ensureLandformDictionary() {
    if (landformRendererDictionary && landformLandscapeDictionary) return;

    const landscapeUrl = "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/8";
    const reliefUrl = "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/9";

    const [landscapeResponse, reliefResponse] = await Promise.all([
        fetch(landscapeUrl + "?f=pjson"),
        fetch(reliefUrl + "?f=pjson")
    ]);

    const [landscapeJson, reliefJson] = await Promise.all([
        landscapeResponse.json(),
        reliefResponse.json()
    ]);

    landformRendererDictionary = {};
    landformLandscapeDictionary = {};
    window.__geoformaPairColorMap = {};
    window.__geoformaPaisajeColorMap = {};

    const landscapeGroups = landscapeJson?.drawingInfo?.renderer?.uniqueValueGroups || [];
    landscapeGroups.forEach(group => {
        (group.classes || []).forEach(cls => {
            const vals = cls.values?.[0] || [];
            const landscape = String(vals[0] ?? "").trim();
            if (!landscape) return;

            const c = cls?.symbol?.color || [150, 150, 150, 255];
            const color = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`;
            const landscapeLabel = String(cls.label || cls.description || landscape).trim();

            landformLandscapeDictionary[landscape] = { code: landscape, label: landscapeLabel, color };
            window.__geoformaPaisajeColorMap[landscapeLabel] = color;
        });
    });

    const reliefGroups = reliefJson?.drawingInfo?.renderer?.uniqueValueGroups || [];
    reliefGroups.forEach(group => {
        (group.classes || []).forEach(cls => {
            const vals = cls.values?.[0] || [];
            const landscape = String(vals[0] ?? "").trim();
            const relief = String(vals[1] ?? "").trim();
            if (!landscape || !relief) return;

            const c = cls?.symbol?.color || [150, 150, 150, 255];
            const color = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`;
            const labelParts = String(cls.label || "").split(",");
            const landscapeLabel = (landformLandscapeDictionary[landscape]?.label) || (labelParts[0] || landscape).trim();
            const reliefLabel = (labelParts[1] || relief).trim();

            landformRendererDictionary[`${landscape}||${relief}`] = {
                paisaje: landscape,
                relieve: relief,
                landscapeLabel,
                reliefLabel,
                color
            };

            window.__geoformaPairColorMap[`${landscapeLabel}||${reliefLabel}`] = color;

            if (!landformLandscapeDictionary[landscape]) {
                landformLandscapeDictionary[landscape] = { code: landscape, label: landscapeLabel, color };
            }

            if (!window.__geoformaPaisajeColorMap[landscapeLabel]) {
                window.__geoformaPaisajeColorMap[landscapeLabel] = landformLandscapeDictionary[landscape].color || color;
            }
        });
    });
}

export async function ensureLandSuitabilityDictionary() {
    if (landSuitabilityRendererDictionary && landSuitabilityMainDictionary) return;

    const urlMain = "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/29";
    const urlDetail = "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/30";

    const [resMain, resDetail] = await Promise.all([
        fetch(urlMain + "?f=pjson"),
        fetch(urlDetail + "?f=pjson")
    ]);

    const [jsonMain, jsonDetail] = await Promise.all([
        resMain.json(),
        resDetail.json()
    ]);

    landSuitabilityRendererDictionary = {};
    landSuitabilityMainDictionary = {};
    window.__vocacionPairColorMap = {};
    window.__vocacionMainColorMap = {};

    const groupsMain = jsonMain?.drawingInfo?.renderer?.uniqueValueGroups || [];
    groupsMain.forEach(group => {
        (group.classes || []).forEach(cls => {
            const vals = cls.values?.[0] || [];
            const landSuitability = String(vals[0] ?? "").trim();
            if (!landSuitability) return;

            const c = cls?.symbol?.color || [150, 150, 150, 255];
            const color = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`;
            const label = String(cls.label || cls.description || landSuitability).trim();

            landSuitabilityMainDictionary[landSuitability] = { code: landSuitability, label, color };
            window.__vocacionMainColorMap[label] = color;
        });
    });

    const groupsDetail = jsonDetail?.drawingInfo?.renderer?.uniqueValueGroups || [];
    groupsDetail.forEach(group => {
        (group.classes || []).forEach(cls => {
            const vals = cls.values?.[0] || [];
            const landSuitability = String(vals[0] ?? "").trim();
            const landUse = String(vals[1] ?? "").trim();
            if (!landSuitability || !landUse) return;

            const c = cls?.symbol?.color || [150, 150, 150, 255];
            const color = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`;
            const parts = String(cls.label || "").split(",");
            const landSuitabilityLabel = (landSuitabilityMainDictionary[landSuitability]?.label) || (parts[0] || landSuitability).trim();
            const landUseLabel = (parts[1] || landUse).trim();

            landSuitabilityRendererDictionary[`${landSuitability}||${landUse}`] = {
                vocacion: landSuitability,
                usopvoc: landUse,
                landSuitabilityLabel,
                usoLabel: landUseLabel,
                color
            };

            window.__vocacionPairColorMap[`${landSuitabilityLabel}||${landUseLabel}`] = color;
        });
    });
}

export function getLandSuitabilityColor(landSuitabilityLabel) {
    return window.__vocacionMainColorMap?.[landSuitabilityLabel] || "#888";
}

export function getLandSuitabilityUseColor(landSuitabilityLabel, usoLabel) {
    return window.__vocacionPairColorMap?.[`${landSuitabilityLabel}||${usoLabel}`] || "#999";
}

export function findLandSuitabilityCodeByLabel(landSuitabilityLabel) {
    for (const item of Object.values(landSuitabilityMainDictionary || {})) {
        if (item.label === landSuitabilityLabel) return item.code;
    }
    return null;
}

export function findLandSuitabilityUseCodesByLabels(landSuitabilityLabel, usoLabel) {
    for (const item of Object.values(landSuitabilityRendererDictionary || {})) {
        if (item.landSuitabilityLabel === landSuitabilityLabel && item.usoLabel === usoLabel) {
            return {
                vocacion: item.vocacion,
                usopvoc: item.usopvoc
            };
        }
    }
    return null;
}

export function getLandformColor(landscapeLabel, reliefLabel) {
    return window.__geoformaPairColorMap?.[`${landscapeLabel}||${reliefLabel}`] || "#999";
}

export function getLandscapeColor(landscapeLabel) {
    return window.__geoformaPaisajeColorMap?.[landscapeLabel] || "#888";
}
