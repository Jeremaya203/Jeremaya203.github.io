 
export function getCurrentModeLabel(mode = currentMode) {
            const labels = {
                RELIEVE: "Relieve",
                CLIMA: "Clima",
                HIDROGRAFIA: "Hidrografía",
                ECOSISTEMAS: "Ecosistemas",
                SUELOS: "Suelos",
                FENOMENOS: "Fenómenos Amenazantes"
            };
            return labels[mode] || "Vista";
}

export function rgbaArrayToCss(arr, fallback = "#999") {
            if (!Array.isArray(arr) || arr.length < 3) return fallback;
            const [r, g, b, a = 255] = arr;
            return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
        }
