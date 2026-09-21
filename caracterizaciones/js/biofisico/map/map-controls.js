import { resetToColombia } from "./zoom.js";

export function initMapControls({
    view,
    Home,
    Locate,
    BasemapGallery
}) {
    const btnZoomIn = document.getElementById("btnZoomIn");
    const btnZoomOut = document.getElementById("btnZoomOut");

    if (btnZoomIn) {
        btnZoomIn.onclick = () => {
            view.goTo({ zoom: view.zoom + 1 });
        };
    }

    if (btnZoomOut) {
        btnZoomOut.onclick = () => {
            view.goTo({ zoom: view.zoom - 1 });
        };
    }

    const homeWidget = new Home({ view });

    const locateWidget = new Locate({
        view,
        useHeadingEnabled: false,
        goToOverride: (view, goToParams) =>
            view.goTo(goToParams.target, { duration: 800 })
    });

    new BasemapGallery({
        view,
        container: "basemapGalleryDiv"
    });

    document.getElementById("btnHome")?.addEventListener("click", () => {
        homeWidget.go();
    });

    document.getElementById("btnLocate")?.addEventListener("click", () => {
        locateWidget.locate();
    });

    document.getElementById("btnResetZoom")?.addEventListener("click", () => {
        resetToColombia();
    });

    const btnBasemaps = document.getElementById("btnBasemaps");
    const basemapPanel = document.getElementById("basemapPanel");
    const basemapWrap = document.querySelector(".tool-dropdown-wrap");

    btnBasemaps?.addEventListener("click", (e) => {
        e.stopPropagation();

        const visible = basemapPanel.style.display !== "none";
        basemapPanel.style.display = visible ? "none" : "block";
    });

    document.addEventListener("click", (e) => {
        if (basemapWrap && !basemapWrap.contains(e.target)) {
            basemapPanel.style.display = "none";
        }
    });
}