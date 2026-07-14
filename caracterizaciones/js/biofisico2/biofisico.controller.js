import { resetBiofisicoState } from "./biofisico.state.js";

let bootstrapPromise = null;

export async function initializeBiofisico() {
    resetBiofisicoState();

    if (!bootstrapPromise) {
        bootstrapPromise = import("./main.js?v=component-nav-biofisico-20260623");
    }

    await bootstrapPromise;
}

initializeBiofisico().catch(error => {
    console.error("No se pudo inicializar el modulo Biofisico:", error);
});
export function updateBiofisicoNavbarActive(mode) {
    document.querySelectorAll("#navbar button").forEach(button => button.classList.remove("active"));

    const map = {
        RELIEVE: "btnRelieve",
        CLIMA: "btnClima",
        HIDROGRAFIA: "btnHidrografia",
        ECOSISTEMAS: "btnEcosistemas",
        SUELOS: "btnSuelos",
        FENOMENOS: "btnFenomenos"
    };

    const id = map[mode];
    if (id) document.getElementById(id)?.classList.add("active");

    syncBiofisicoDropdown(mode);
}

export function syncBiofisicoDropdown(mode) {
    const items = document.querySelectorAll("#dropdownBiofisico .dropdown-item");
    if (!items.length) return;

    items.forEach(item => item.classList.remove("active"));

    const map = {
        RELIEVE: "itemRelieve",
        CLIMA: "itemClima",
        HIDROGRAFIA: "itemHidrografia",
        ECOSISTEMAS: "itemEcosistemas",
        SUELOS: "itemSuelos",
        FENOMENOS: "itemFenomenos"
    };

    const activeId = map[mode];
    if (activeId) {
        document.getElementById(activeId)?.classList.add("active");
    }
}
