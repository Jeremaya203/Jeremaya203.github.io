// =============================================================================
// coloresOcupacion.js
// Diccionarios de colores para el módulo de Procesos de Ocupación.
// Colores extraídos del renderer de ArcGIS MapServer (componenteocupacion).
// Patrón idéntico a coloresBiofisico.js
// =============================================================================

// ─── MapServer/11 ─────────────────────────────────────────────────────────────
// Densidad de población — campo renderer: denpobha (classBreaks, naturalBreaks)
// Colores del gradiente verde-pálido → violeta del renderer real
const clasesBreaksDensidad = [
    { max: 14.82267113,  color: "rgba(198,214,178,1)", label: "0,000 - 14,82 hab/ha" },
    { max: 39.866406,    color: "rgba(207,198,165,1)", label: "14,83 - 39,86 hab/ha" },
    { max: 67.759722,    color: "rgba(204,161,153,1)", label: "39,87 - 67,75 hab/ha" },
    { max: 112.190705,   color: "rgba(196,139,168,1)", label: "67,76 - 112,19 hab/ha" },
    { max: Infinity,     color: "rgba(184,126,194,1)", label: "112,20 - 234,25 hab/ha" }
];

// Retorna { color, rangeLabel } según el valor de denpobha
function getColorByDensidad(value) {
    for (const cls of clasesBreaksDensidad) {
        if (value <= cls.max) return { color: cls.color, rangeLabel: cls.label };
    }
    return { color: "rgba(184,126,194,1)", rangeLabel: "> 112,20 hab/ha" };
}

// Labels fijos por tipo de zona (campo tzn) — para etiquetas de la gráfica
const tznLabels = {
    1: "Cabecera",
    2: "Centro poblado",
    3: "Rural"
};

// Mapeo inverso label → código tzn (para filtrarPorAtributo)
const densidadLabelToTzn = {
    "Cabecera":       1,
    "Centro poblado": 2,
    "Rural":          3,
    "Cabecera Municipal": 1,
    "Centros Poblados":   2,
    "Rural Disperso":     3
};

// ─── MapServer/15 ─────────────────────────────────────────────────────────────
// Estructura población edad y área (campos: nm, nf, jm, jf, am, af, amm, amf)
const coloresComposicion = {
    "amf": { color: "#C0504D", label: "Adultos mayores femenino" },
    "amm": { color: "#767100", label: "Adultos mayores masculino" },
    "af":  { color: "#92D050", label: "Adultos femenino" },
    "am":  { color: "#FFFF00", label: "Adultos masculino" },
    "jf":  { color: "#FABF8F", label: "Jóvenes femenino" },
    "jm":  { color: "#4B6432", label: "Jóvenes masculino" },
    "nf":  { color: "#953735", label: "Niños femenino" },
    "nm":  { color: "#F79646", label: "Niños masculino" }
};

// Orden deseado para la leyenda (de arriba a abajo)
const ordenComposicion = ["amf", "amm", "af", "am", "jf", "jm", "nf", "nm"];

// ─── MapServer/6 ─────────────────────────────────────────────────────────────
// Áreas de ocupación del territorio (campo: descripcion, uniqueValue)
const coloresAreasOcupacion = {
    "Explotaciones mineras":        { color: "rgba(245,162,122,0.80)", label: "Explotaciones mineras" },
    "Region Caribe":                { color: "rgba(56,168,0,1)",       label: "Región Caribe" },
    "Region Central":               { color: "rgba(76,0,115,1)",       label: "Región Central" },
    "Region Occidental":            { color: "rgba(245,122,122,1)",    label: "Región Occidental" },
    "Valles aluviales":             { color: "rgba(252,215,251,0.80)", label: "Valles aluviales" },
    "Áreas de altiplanos":          { color: "rgba(255,211,127,0.80)", label: "Áreas de altiplanos" },
    "Urabá":                        { color: "rgba(245,122,122,1)",    label: "Urabá" },
    "Orinoquía":                    { color: "rgba(76,0,115,1)",       label: "Orinoquía" },
    "Muisca":                       { color: "rgba(255,210,128,1)",    label: "Ocupación Indígena" },
    "Yarigui":                      { color: "rgba(255,210,128,1)",    label: "Ocupación Indígena" },
    "Yalcón":                       { color: "rgba(255,210,128,1)",    label: "Ocupación Indígena" },
    "Tumaco":                       { color: "rgba(255,210,128,1)",    label: "Ocupación Indígena" },
    "Tairona":                      { color: "rgba(255,210,128,1)",    label: "Ocupación Indígena" },
    "Sinú":                         { color: "rgba(255,210,128,1)",    label: "Ocupación Indígena" },
    "Quillacinga-Pasto":            { color: "rgba(255,210,128,1)",    label: "Ocupación Indígena" },
    "Pijao":                        { color: "rgba(255,210,128,1)",    label: "Ocupación Indígena" },
    "Paez":                         { color: "rgba(255,210,128,1)",    label: "Ocupación Indígena" },
    "Loma":                         { color: "rgba(255,210,128,1)",    label: "Ocupación Indígena" },
    "Guambiano":                    { color: "rgba(255,210,128,1)",    label: "Ocupación Indígena" },
    "Guane":                        { color: "rgba(255,210,128,1)",    label: "Ocupación Indígena" },
    "Embera":                       { color: "rgba(255,210,128,1)",    label: "Ocupación Indígena" },
    "Ansema,Quimbaya,Quindio":      { color: "rgba(255,210,128,1)",    label: "Ocupación Indígena" },
    "Cuna":                         { color: "rgba(255,210,128,1)",    label: "Ocupación Indígena" },
    "Chimila":                      { color: "rgba(255,210,128,1)",    label: "Ocupación Indígena" },
    "Magdalena Medio":              { color: "rgba(92,137,68,1)",      label: "Magdalena Medio" },
    "Amazonía":                     { color: "rgba(255,211,127,1)",    label: "Amazonía" }
};
