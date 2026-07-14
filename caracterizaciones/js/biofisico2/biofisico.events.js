export function onElement(id, eventName, handler, options) {
    const el = document.getElementById(id);
    if (!el || typeof handler !== "function") return () => {};

    el.addEventListener(eventName, handler, options);
    return () => el.removeEventListener(eventName, handler, options);
}

export function getSelectedTerritory() {
    return {
        departamento: document.getElementById("departamentos")?.value || "",
        municipio: document.getElementById("municipios")?.value || ""
    };
}

export function preserveMunicipioInUrl(targetPage) {
    const municipio = document.getElementById("municipios")?.value || "";
    return municipio ? `${targetPage}?id=${encodeURIComponent(municipio)}` : targetPage;
}
