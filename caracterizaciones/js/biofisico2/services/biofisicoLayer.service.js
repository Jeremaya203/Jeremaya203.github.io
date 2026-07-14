import { rgbaArrayToCss } from "../utils/biofisicoArcgis.utils.js";
import { rgbaFromEsriColorArr } from "../utils.js";

export let coloresOrdenSuelo = null;
export let ruralCategoriaDict = null;
export let geoformasRendererDict = null;
export let geoformasPaisajeDict = null;
export let vocacionRendererDict = null;
export let vocacionMainDict = null;

export async function ensureOrdenSueloDict(layerUrl28) {
    if (coloresOrdenSuelo) return coloresOrdenSuelo;

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

    coloresOrdenSuelo = dict;
    return dict;
}

export async function ensureRuralCategoriaDict(layerUrl) {
    if (ruralCategoriaDict) return ruralCategoriaDict;

    const url = String(layerUrl).replace(/\/+$/, "") + "?f=pjson";
    const res = await fetch(url);
    const json = await res.json();

    ruralCategoriaDict = {};
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

                ruralCategoriaDict[code] = {
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

    if (!Object.keys(ruralCategoriaDict).length && infos.length) {
        infos.forEach(info => {
            const code = String(info.value ?? "").trim();
            if (!code) return;

            const fill = rgbaArrayToCss(info?.symbol?.color, "#999");
            const outline = rgbaArrayToCss(info?.symbol?.outline?.color, "rgba(0,0,0,0)");
            const width = Number(info?.symbol?.outline?.width ?? 0);
            const label = String(info.label ?? code).trim();

            ruralCategoriaDict[code] = {
                code,
                label,
                fillColor: fill,
                outlineColor: outline,
                outlineWidth: width
            };

            window.__ruralCategoriaColorMap[label] = fill;
        });
    }

    return ruralCategoriaDict;
}

export async function ensureGeoformasDict() {
    if (geoformasRendererDict && geoformasPaisajeDict) return;

    const urlPaisaje = "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/8";
    const urlRelieve = "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/9";

    const [resPaisaje, resRelieve] = await Promise.all([
        fetch(urlPaisaje + "?f=pjson"),
        fetch(urlRelieve + "?f=pjson")
    ]);

    const [jsonPaisaje, jsonRelieve] = await Promise.all([
        resPaisaje.json(),
        resRelieve.json()
    ]);

    geoformasRendererDict = {};
    geoformasPaisajeDict = {};
    window.__geoformaPairColorMap = {};
    window.__geoformaPaisajeColorMap = {};

    const groupsPaisaje = jsonPaisaje?.drawingInfo?.renderer?.uniqueValueGroups || [];
    groupsPaisaje.forEach(group => {
        (group.classes || []).forEach(cls => {
            const vals = cls.values?.[0] || [];
            const paisaje = String(vals[0] ?? "").trim();
            if (!paisaje) return;

            const c = cls?.symbol?.color || [150, 150, 150, 255];
            const color = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`;
            const paisajeLabel = String(cls.label || cls.description || paisaje).trim();

            geoformasPaisajeDict[paisaje] = { code: paisaje, label: paisajeLabel, color };
            window.__geoformaPaisajeColorMap[paisajeLabel] = color;
        });
    });

    const groupsRelieve = jsonRelieve?.drawingInfo?.renderer?.uniqueValueGroups || [];
    groupsRelieve.forEach(group => {
        (group.classes || []).forEach(cls => {
            const vals = cls.values?.[0] || [];
            const paisaje = String(vals[0] ?? "").trim();
            const relieve = String(vals[1] ?? "").trim();
            if (!paisaje || !relieve) return;

            const c = cls?.symbol?.color || [150, 150, 150, 255];
            const color = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`;
            const labelParts = String(cls.label || "").split(",");
            const paisajeLabel = (geoformasPaisajeDict[paisaje]?.label) || (labelParts[0] || paisaje).trim();
            const relieveLabel = (labelParts[1] || relieve).trim();

            geoformasRendererDict[`${paisaje}||${relieve}`] = {
                paisaje,
                relieve,
                paisajeLabel,
                relieveLabel,
                color
            };

            window.__geoformaPairColorMap[`${paisajeLabel}||${relieveLabel}`] = color;

            if (!geoformasPaisajeDict[paisaje]) {
                geoformasPaisajeDict[paisaje] = { code: paisaje, label: paisajeLabel, color };
            }

            if (!window.__geoformaPaisajeColorMap[paisajeLabel]) {
                window.__geoformaPaisajeColorMap[paisajeLabel] = geoformasPaisajeDict[paisaje].color || color;
            }
        });
    });
}

export async function ensureVocacionDict() {
    if (vocacionRendererDict && vocacionMainDict) return;

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

    vocacionRendererDict = {};
    vocacionMainDict = {};
    window.__vocacionPairColorMap = {};
    window.__vocacionMainColorMap = {};

    const groupsMain = jsonMain?.drawingInfo?.renderer?.uniqueValueGroups || [];
    groupsMain.forEach(group => {
        (group.classes || []).forEach(cls => {
            const vals = cls.values?.[0] || [];
            const vocacion = String(vals[0] ?? "").trim();
            if (!vocacion) return;

            const c = cls?.symbol?.color || [150, 150, 150, 255];
            const color = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`;
            const label = String(cls.label || cls.description || vocacion).trim();

            vocacionMainDict[vocacion] = { code: vocacion, label, color };
            window.__vocacionMainColorMap[label] = color;
        });
    });

    const groupsDetail = jsonDetail?.drawingInfo?.renderer?.uniqueValueGroups || [];
    groupsDetail.forEach(group => {
        (group.classes || []).forEach(cls => {
            const vals = cls.values?.[0] || [];
            const vocacion = String(vals[0] ?? "").trim();
            const usopvoc = String(vals[1] ?? "").trim();
            if (!vocacion || !usopvoc) return;

            const c = cls?.symbol?.color || [150, 150, 150, 255];
            const color = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`;
            const parts = String(cls.label || "").split(",");
            const vocacionLabel = (vocacionMainDict[vocacion]?.label) || (parts[0] || vocacion).trim();
            const usoLabel = (parts[1] || usopvoc).trim();

            vocacionRendererDict[`${vocacion}||${usopvoc}`] = {
                vocacion,
                usopvoc,
                vocacionLabel,
                usoLabel,
                color
            };

            window.__vocacionPairColorMap[`${vocacionLabel}||${usoLabel}`] = color;
        });
    });
}

export function getVocacionColor(vocacionLabel) {
    return window.__vocacionMainColorMap?.[vocacionLabel] || "#888";
}

export function getVocacionUsoColor(vocacionLabel, usoLabel) {
    return window.__vocacionPairColorMap?.[`${vocacionLabel}||${usoLabel}`] || "#999";
}

export function findVocacionCodeByLabel(vocacionLabel) {
    for (const item of Object.values(vocacionMainDict || {})) {
        if (item.label === vocacionLabel) return item.code;
    }
    return null;
}

export function findVocacionUsoCodesByLabels(vocacionLabel, usoLabel) {
    for (const item of Object.values(vocacionRendererDict || {})) {
        if (item.vocacionLabel === vocacionLabel && item.usoLabel === usoLabel) {
            return {
                vocacion: item.vocacion,
                usopvoc: item.usopvoc
            };
        }
    }
    return null;
}

export function getGeoformaColor(paisajeLabel, relieveLabel) {
    return window.__geoformaPairColorMap?.[`${paisajeLabel}||${relieveLabel}`] || "#999";
}

export function getPaisajeColor(paisajeLabel) {
    return window.__geoformaPaisajeColorMap?.[paisajeLabel] || "#888";
}
