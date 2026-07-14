/**
 * Paleta de colores estable para líneas limítrofes municipales.
 * Cada LLIdentif se mapea a un color determinístico mediante hash.
 * La misma paleta se usa en mapa (UniqueValueRenderer), leyenda y gráfico de barras.
 */

const PALETA = [
    [230, 40, 40],     // rojo
    [40, 120, 200],    // azul
    [60, 180, 75],     // verde
    [255, 160, 0],     // naranja
    [140, 80, 200],    // púrpura
    [220, 80, 150],    // rosa
    [30, 180, 180],    // cian
    [180, 140, 60],    // dorado oscuro
    [100, 160, 40],    // verde oliva
    [200, 60, 100],    // granate
    [50, 100, 180],    // azul medio
    [210, 120, 50],    // terracota
    [80, 50, 160],     // índigo
    [160, 200, 40],    // lima
    [50, 180, 120],    // verde mar
    [190, 80, 80],     // ladrillo
    [70, 140, 210],    // celeste
    [220, 180, 40],    // amarillo oscuro
    [120, 60, 160],    // violeta
    [40, 150, 100],    // esmeralda
    [230, 100, 30],    // naranja quemado
    [90, 80, 180],     // azul violáceo
    [180, 50, 50],     // rojo oscuro
    [60, 120, 200],    // azul real
    [200, 160, 100],   // beige oscuro
    [130, 40, 150],    // magenta oscuro
    [50, 160, 180],    // turquesa
    [210, 90, 130],    // coral
    [80, 140, 60],     // verde bosque
    [170, 100, 200],   // lila
];

const COLOR_CACHE = new Map();

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

/**
 * Retorna un color RGB [r, g, b] determinístico para un LLIdentif.
 * @param {string} llIdentif - Valor del campo LLIdentif
 * @returns {number[]} Array [r, g, b]
 */
export function getColorForLinea(llIdentif) {
    if (llIdentif === null || llIdentif === undefined || llIdentif === "") {
        return [180, 180, 180]; // gris para valores nulos
    }
    const key = String(llIdentif);
    if (COLOR_CACHE.has(key)) return COLOR_CACHE.get(key);
    const idx = hashString(key) % PALETA.length;
    const color = PALETA[idx];
    COLOR_CACHE.set(key, color);
    return color;
}

/**
 * Retorna el color en formato CSS `rgb(r, g, b)`.
 */
export function getColorCSS(llIdentif) {
    const [r, g, b] = getColorForLinea(llIdentif);
    return `rgb(${r},${g},${b})`;
}

/**
 * Retorna el color en formato hex.
 */
export function getColorHex(llIdentif) {
    const [r, g, b] = getColorForLinea(llIdentif);
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}