export function onElement(id, eventName, handler, options) {
    const el = document.getElementById(id);
    if (!el || typeof handler !== "function") return () => {};

    el.addEventListener(eventName, handler, options);
    return () => el.removeEventListener(eventName, handler, options);
}

export function getSelectedTerritory() {
    return {
        department: document.getElementById("departamentos")?.value || "",
        municipality: document.getElementById("municipios")?.value || ""
    };
}

export function preserveMunicipalityInUrl(targetPage) {
    const municipality = document.getElementById("municipios")?.value || "";
    return municipality ? `${targetPage}?id=${encodeURIComponent(municipality)}` : targetPage;
}
