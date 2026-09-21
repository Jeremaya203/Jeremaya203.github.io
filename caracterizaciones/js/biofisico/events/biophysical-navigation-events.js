export function updateBiofisicoUrlByModule(module) {
    const url = new URL(window.location.href);
    url.searchParams.delete("vista");

    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function getInitialBiofisicoModuleFromUrl() {
    return "BIOFISICO";
}
