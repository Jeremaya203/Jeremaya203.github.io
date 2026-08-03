const GEOJSON_URL = new URL("../../../Data/frontera_internacional_municipios_web.geojson", import.meta.url);

const COUNTRY_BY_DEPARTMENT = Object.freeze({
    "15": "Venezuela",
    "20": "Venezuela",
    "27": "Panamá",
    "44": "Venezuela",
    "52": "Ecuador",
    "54": "Venezuela",
    "81": "Venezuela",
    "99": "Venezuela"
});

const COUNTRY_BY_MUNICIPALITY = Object.freeze({
    "86568": "Ecuador",
    "86757": "Ecuador",
    "86865": "Ecuador",
    "91263": "Perú",
    "91407": "Brasil",
    "91530": "Perú",
    "91536": "Perú",
    "91540": "Perú",
    "94001": "Venezuela",
    "94883": "Venezuela",
    "94884": "Venezuela",
    "94885": "Venezuela",
    "94886": "Venezuela",
    "94887": "Brasil",
    "97001": "Brasil",
    "97511": "Brasil",
    "97666": "Brasil",
    "97889": "Brasil"
});

let geoJsonPromise = null;
let borderLayer = null;
let mapRef = null;
let GraphicCtor = null;
let renderToken = 0;
let borderVisible = true;

function normalizeDivipola(value) {
    return String(value ?? "").replace(/\D/g, "").padStart(5, "0").slice(-5);
}

function geometrySignature(feature) {
    return normalizeDivipola(feature?.properties?.DIVIPOLA) + "|" + JSON.stringify(feature?.geometry?.coordinates || []);
}

function loadGeoJsonOnce() {
    if (!geoJsonPromise) {
        geoJsonPromise = fetch(GEOJSON_URL)
            .then(function(response) {
                if (!response.ok) throw new Error("No fue posible cargar la frontera internacional");
                return response.json();
            })
            .then(function(data) {
                const seen = new Set();
                return (data?.features || []).filter(function(feature) {
                    const code = normalizeDivipola(feature?.properties?.DIVIPOLA);
                    const coordinates = feature?.geometry?.coordinates;
                    if (!/^\d{5}$/.test(code) || !Array.isArray(coordinates) || coordinates.length < 2) return false;
                    const signature = geometrySignature(feature);
                    if (seen.has(signature)) return false;
                    seen.add(signature);
                    return true;
                });
            })
            .catch(function(error) {
                geoJsonPromise = null;
                throw error;
            });
    }
    return geoJsonPromise;
}

function averageLongitude(coordinates) {
    if (!coordinates.length) return 0;
    return coordinates.reduce(function(sum, coordinate) { return sum + Number(coordinate[0] || 0); }, 0) / coordinates.length;
}

function classifyWholeFeature(code, coordinates) {
    const departmentCode = code.slice(0, 2);
    if (COUNTRY_BY_DEPARTMENT[departmentCode]) return COUNTRY_BY_DEPARTMENT[departmentCode];
    if (COUNTRY_BY_MUNICIPALITY[code]) return COUNTRY_BY_MUNICIPALITY[code];

    // Leticia y Tarapacá tienen segmentos independientes hacia Perú y Brasil.
    if (code === "91001") return coordinates.length <= 2 ? "Perú" : "Brasil";
    if (code === "91798") return averageLongitude(coordinates) < -70 ? "Perú" : "Brasil";
    return "";
}

function splitPuertoLeguizamo(coordinates) {
    // El municipio 86573 toca Ecuador al occidente y Perú al oriente.
    // El cambio de frontera se encuentra junto a la desembocadura del río Güepí.
    let splitIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    coordinates.forEach(function(coordinate, index) {
        const distance = Math.hypot(coordinate[0] - (-75.25), coordinate[1] - (-0.08));
        if (distance < nearestDistance) {
            nearestDistance = distance;
            splitIndex = index;
        }
    });

    const first = coordinates.slice(0, splitIndex + 1);
    const second = coordinates.slice(splitIndex);
    return [first, second]
        .filter(function(path) { return path.length >= 2; })
        .map(function(path) {
            return {
                country: averageLongitude(path) < -75.25 ? "Ecuador" : "Perú",
                coordinates: path
            };
        });
}

export function classifyBorderFeature(feature) {
    const code = normalizeDivipola(feature?.properties?.DIVIPOLA);
    const coordinates = feature?.geometry?.coordinates || [];
    if (code === "86573") return splitPuertoLeguizamo(coordinates);

    const country = classifyWholeFeature(code, coordinates);
    return country ? [{ country: country, coordinates: coordinates }] : [];
}

function lineMidpoint(paths) {
    const segments = [];
    let totalLength = 0;

    paths.forEach(function(path) {
        for (let index = 1; index < path.length; index += 1) {
            const start = path[index - 1];
            const end = path[index];
            const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
            if (!Number.isFinite(length) || length <= 0) continue;
            segments.push({ start: start, end: end, length: length });
            totalLength += length;
        }
    });

    if (!segments.length) return null;
    const target = totalLength / 2;
    let traversed = 0;
    for (const segment of segments) {
        if (traversed + segment.length >= target) {
            const ratio = (target - traversed) / segment.length;
            return [
                segment.start[0] + ((segment.end[0] - segment.start[0]) * ratio),
                segment.start[1] + ((segment.end[1] - segment.start[1]) * ratio)
            ];
        }
        traversed += segment.length;
    }
    return segments[segments.length - 1].end;
}

function removeBorderLegendItem() {
    document.querySelector(".limites-border-legend-toggle")?.remove();
}

function renderBorderLegendItem() {
    removeBorderLegendItem();
    if (!borderLayer || !borderLayer.graphics?.length) return;

    const content = document.getElementById("legendContent");
    if (!content) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "limites-legend-item limites-border-legend-toggle active";
    button.setAttribute("data-legend-kind", "international-border");
    button.setAttribute("aria-pressed", borderVisible ? "true" : "false");
    button.title = "Mostrar u ocultar límite fronterizo";
    if (!borderVisible) button.classList.add("inactive");

    const swatch = document.createElement("span");
    swatch.className = "limites-legend-swatch limites-border-legend-swatch";
    const label = document.createElement("span");
    label.className = "limites-legend-label";
    label.textContent = "Límite fronterizo";
    button.append(swatch, label);

    button.addEventListener("click", function(event) {
        event.preventDefault();
        event.stopPropagation();
        borderVisible = !borderVisible;
        borderLayer.visible = borderVisible;
        button.classList.toggle("inactive", !borderVisible);
        button.setAttribute("aria-pressed", borderVisible ? "true" : "false");
    });
    content.appendChild(button);
}

export function initializeInternationalBorder(options) {
    if (borderLayer || !options?.map || !options?.GraphicsLayer || !options?.Graphic) return borderLayer;
    mapRef = options.map;
    GraphicCtor = options.Graphic;
    borderLayer = new options.GraphicsLayer({
        title: "Límite fronterizo",
        listMode: "hide",
        visible: false
    });
    options.map.add(borderLayer);
    return borderLayer;
}

export function clearInternationalBorder() {
    renderToken += 1;
    borderVisible = true;
    if (borderLayer) {
        borderLayer.removeAll();
        borderLayer.visible = false;
    }
    removeBorderLegendItem();
}

export async function showInternationalBorder(options) {
    const token = ++renderToken;
    borderVisible = true;
    if (!borderLayer || !GraphicCtor) return false;

    borderLayer.removeAll();
    borderLayer.visible = false;
    removeBorderLegendItem();

    const municipalityCode = normalizeDivipola(options?.municipalityCode);
    const departmentCode = String(options?.departmentCode || municipalityCode.slice(0, 2)).replace(/\D/g, "").padStart(2, "0").slice(-2);
    if (!/^\d{2}$/.test(departmentCode) || departmentCode === "00") return false;

    try {
        const features = await loadGeoJsonOnce();
        if (token !== renderToken) return false;

        const selected = features.filter(function(feature) {
            const code = normalizeDivipola(feature.properties.DIVIPOLA);
            return options?.municipalityCode ? code === municipalityCode : code.startsWith(departmentCode);
        });

        const countryPaths = new Map();
        selected.forEach(function(feature) {
            classifyBorderFeature(feature).forEach(function(part) {
                if (!part.country || part.coordinates.length < 2) return;
                if (!countryPaths.has(part.country)) countryPaths.set(part.country, []);
                countryPaths.get(part.country).push(part.coordinates);
            });
        });

        const lineGraphics = [];
        const labelGraphics = [];
        countryPaths.forEach(function(paths, country) {
            paths.forEach(function(path) {
                lineGraphics.push(new GraphicCtor({
                    geometry: { type: "polyline", paths: [path], spatialReference: { wkid: 4326 } },
                    symbol: { type: "simple-line", color: [0, 0, 0, 255], width: 3.5 },
                    attributes: { type: "international-border", country: country }
                }));
            });

            const center = lineMidpoint(paths);
            if (center) {
                labelGraphics.push(new GraphicCtor({
                    geometry: { type: "point", longitude: center[0], latitude: center[1], spatialReference: { wkid: 4326 } },
                    symbol: {
                        type: "text",
                        text: country,
                        color: [0, 0, 0, 255],
                        haloColor: [255, 255, 255, 245],
                        haloSize: 1.5,
                        font: { family: "Outfit", size: 12, weight: "bold" }
                    },
                    attributes: { type: "international-border-label", country: country }
                }));
            }
        });

        const graphics = lineGraphics.concat(labelGraphics);
        if (token !== renderToken || !lineGraphics.length) return false;
        borderLayer.addMany(graphics);
        borderLayer.visible = true;
        if (mapRef?.reorder) mapRef.reorder(borderLayer, mapRef.layers.length - 1);
        renderBorderLegendItem();
        return true;
    } catch (error) {
        if (token === renderToken) clearInternationalBorder();
        console.warn("No fue posible mostrar el límite fronterizo:", error);
        return false;
    }
}
