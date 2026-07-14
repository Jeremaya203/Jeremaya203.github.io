import {
    // ensureMunicipalLayerIndex,
    // getLayerListForCurrentLevel,
    clampSubLayerIndex,
    // getActiveLayerConfig
} from "../map/layerManager.js";

export function updateMapViewBadge(nombre) {
    const badgeText = document.getElementById("mapViewBadgeText");
    if (!badgeText) return;
    badgeText.textContent = nombre || "Vista";
}

export function setLegendLayer(layer, titleText) {
    const title = document.getElementById("legendTitle");
    if (title) title.textContent = titleText || "Leyenda";
}

export function initModuleDropdown(dropdownId, triggerId, menuSelector, onItemClick = null) {
    const dropdown = document.getElementById(dropdownId);
    const trigger = document.getElementById(triggerId);
    const menu = dropdown?.querySelector(menuSelector);
    const items = dropdown?.querySelectorAll(".dropdown-item");

    if (!dropdown || !trigger || !menu || !items?.length) return;

    trigger.onclick = function (e) {
        e.stopPropagation();

        document.querySelectorAll(".modulo-dropdown.open").forEach(d => {
            if (d !== dropdown) d.classList.remove("open");
        });

        dropdown.classList.toggle("open");
    };

    items.forEach(item => {
        item.onclick = function (e) {
            e.stopPropagation();

            items.forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            const target = item.dataset.target;

            if (typeof onItemClick === "function") {
                onItemClick(target, item);
            } else {
                console.log("Seleccionado:", target);
            }

            dropdown.classList.remove("open");
        };
    });
}



export function initDropdownDescargables() {
    const dropdown = document.getElementById("descargablesDropdown");
    const trigger = document.getElementById("btnDescargables");
    const panel = document.getElementById("descargablesMenu");
    const items = document.querySelectorAll(".descargables-menu .descargables-item");

    if (!dropdown || !trigger || !panel) {
        console.log("Dropdown descargables no encontrado");
        return;
    }

    trigger.onclick = function (e) {
        e.stopPropagation();
        dropdown.classList.toggle("open");
    };

    document.addEventListener("click", function (e) {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove("open");
        }
    });

    items.forEach(item => {
        item.onclick = function (e) {
            e.stopPropagation();

            const target = item.dataset.download;

            if (target === "memoria") {
                document.getElementById("btnDescargarPDF")?.click();
            } else if (target === "bd") {
                console.log("Descargar base de datos espacial");
                // Logica para descargar la base de datos espacial

            }

            dropdown.classList.remove("open");
        };
    });
}


export function renderControls() {
    if (currentMainModule === "SOCIOECONOMICO") {
        renderSubTabs();
        return;
    }

    clampSubLayerIndex();
    renderSubTabs();
}


export function createUiControlsController({
    getCurrentMainModule,
    setCurrentMainModule,
    setCurrentMode,
    getCurrentOrdenamientoTab,
    setCurrentOrdenamientoTab,
    setCurrentRuralChartView,
    hideTimeSlider,
    destroyGeoformasCharts,
    toggleGeoformasCharts,
    getChartInstance,
    setChartInstance,
    setLegendFilterLabel,
    renderSubTabs,
    clampSubLayerIndex,
    setCurrentSubLayerIndex,
    cargarCapaActual
}) {
    function updateMapViewBadge(nombre) {
        const badgeText = document.getElementById("mapViewBadgeText");
        if (!badgeText) return;
        badgeText.textContent = nombre || "Vista";
    }

    function getCurrentModeLabel(mode) {
        const labels = {
            RELIEVE: "Relieve",
            CLIMA: "Clima",
            HIDROGRAFIA: "Hidrografia",
            ECOSISTEMAS: "Ecosistemas",
            SUELOS: "Suelos",
            FENOMENOS: "Fenomenos Amenazantes"
        };

        return labels[mode] || "Vista";
    }

    function setLegendLayer(layer, titleText) {
        const title = document.getElementById("legendTitle");
        if (title) title.textContent = titleText || "Leyenda";
    }

    function initModuleDropdown(dropdownId, triggerId, menuSelector, onItemClick = null) {
        const dropdown = document.getElementById(dropdownId);
        const trigger = document.getElementById(triggerId);
        const menu = dropdown?.querySelector(menuSelector);
        const items = dropdown?.querySelectorAll(".dropdown-item");

        if (!dropdown || !trigger || !menu || !items?.length) return;

        trigger.onclick = function (e) {
            e.stopPropagation();

            document.querySelectorAll(".modulo-dropdown.open").forEach(currentDropdown => {
                if (currentDropdown !== dropdown) currentDropdown.classList.remove("open");
            });

            dropdown.classList.toggle("open");
        };

        items.forEach(item => {
            item.onclick = function (e) {
                e.stopPropagation();

                items.forEach(currentItem => currentItem.classList.remove("active"));
                item.classList.add("active");

                const target = item.dataset.target;

                if (typeof onItemClick === "function") {
                    onItemClick(target, item);
                } else {
                    console.log("Seleccionado:", target);
                }

                dropdown.classList.remove("open");
            };
        });
    }

    function initAllDropdowns() {
        document.addEventListener("click", function (e) {
            document.querySelectorAll(".modulo-dropdown.open").forEach(dropdown => {
                if (!dropdown.contains(e.target)) {
                    dropdown.classList.remove("open");
                }
            });
        });



        initModuleDropdown("biofisicoDropdown", "biofisicoTrigger", ".dropdown-menu-custom", function (target) {
            // if (target === "Relieve") {
            //     document.getElementById("btnRelieve")?.click();
            // } else if (target === "Clima") {
            //     document.getElementById("btnClima")?.click();
            // } else if (target === "Hidrografia" || target === "Hidrografía") {
            //     document.getElementById("btnHidrografia")?.click();
            // } else if (target === "Ecosistemas") {
            //     document.getElementById("btnEcosistemas")?.click();
            // } else if (target === "Suelos") {
            //     document.getElementById("btnSuelos")?.click();
            // } else if (target === "Fenomenos Amenazantes" || target === "Fenómenos Amenazantes") {
            //     document.getElementById("btnFenomenos")?.click();
            // } else if (target === "Relaciones Ambientales") {
            //     console.log("Pendiente logica para:", target);
            // }
        });


        initModuleDropdown(
            "socioeconomicoDropdown",
            "socioeconomicoTrigger",
            ".dropdown-menu-custom",
            function (target) {

                // console.log("CLICK SOCIOECONOMICO:", target);
                // console.log("setCurrentMode:", setCurrentMode);
                // console.log("setCurrentMainModule:", setCurrentMainModule);
                // console.log("renderSubTabs:", renderSubTabs);



                //  USAR LAS FUNCIONES INYECTADAS
                setCurrentMainModule("SOCIOECONOMIC");

                if (target === "Infraestructura") {

                    window.currentSocioTab = "INFRASTRUCTURE";          
                    setCurrentMode("SOCIOECONOMIC_INFRASTRUCTURE");

                    //   console.log(
                    //     "Modo actual:",
                    //     getCurrentModeLabel?.("SOCIOECONOMIC_INFRASTRUCTURE") 
                    //   );

                } else if (target === "Dinámicas Socioeconómicas") {

                    // console.log("Entra a dinamicas");

                    window.currentSocioTab = "DYNAMICS";
                    setCurrentMode("SOCIOECONOMIC_SOCIAL_DYNAMICS");

                    //   setCurrentMode("SOCIOECONOMIC");

                } else if (target === "Condiciones Socioeconómicas") {

                    window.currentSocioTab = "CONDITIONS";
                    setCurrentMode("SOCIOECONOMIC_CONDITIONS");

                } else if (target === "Presiones Socioeconómicas") {

                    window.currentSocioTab = "PRESSURES";
                    setCurrentMode("SOCIOECONOMIC");
                }

                console.log("ANTES renderSubTabs");


                setCurrentSubLayerIndex(0);
                renderSubTabs();
                console.log("Despues renderSubTabs");
                (cargarCapaActual || window.cargarCapaActual)?.();
            }
        );

    }



    function initDropdownDescargables() {
        const dropdown = document.getElementById("descargablesDropdown");
        const trigger = document.getElementById("btnDescargables");
        const panel = document.getElementById("descargablesMenu");
        const items = document.querySelectorAll(".descargables-menu .descargables-item");

        if (!dropdown || !trigger || !panel) {
            console.log("Dropdown descargables no encontrado");
            return;
        }

        trigger.onclick = function (e) {
            e.stopPropagation();
            dropdown.classList.toggle("open");
        };

        document.addEventListener("click", function (e) {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove("open");
            }
        });

        items.forEach(item => {
            item.onclick = function (e) {
                e.stopPropagation();

                const target = item.dataset.download;

                if (target === "memoria") {
                    document.getElementById("btnDescargarPDF")?.click();
                } else if (target === "bd") {
                    console.log("Descargar base de datos espacial");
                }

                dropdown.classList.remove("open");
            };
        });
    }

    function renderControls() {
        if (getCurrentMainModule() === "SOCIOECONOMICO") {
            renderSubTabs();
            return;
        }

        clampSubLayerIndex();

        renderSubTabs();

    }



    return {
        updateMapViewBadge,
        getCurrentModeLabel,
        setLegendLayer,
        initModuleDropdown,
        initAllDropdowns,
        initDropdownDescargables,
        renderControls
    };
}
