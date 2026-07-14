export { rgbaFromEsriColor, rgbaFromEsriColorArr } from "../utils.js";

export function rgbaArrayToCss(arr, fallback = "#999") {
    if (!Array.isArray(arr) || arr.length < 3) return fallback;
    const [r, g, b, a = 255] = arr;
    return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}
