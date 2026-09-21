export function createIgacSatelitalTopo({ Basemap, TileLayer, VectorTileLayer }) {
    return new Basemap({
        title: "Mapa Satelital-Topográfico Colombia",
        baseLayers: [
            new TileLayer({
                url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
                attribution: "Earthstar Geographics"
            }),
            new TileLayer({
                url: "https://tiles.arcgis.com/tiles/RVvWzU3lgJISqdke/arcgis/rest/services/BasemapRaster/MapServer",
                attribution: "Instituto Geográfico Agustin Codazzi - IGAC"
            }),
            new VectorTileLayer({
                url: "https://tiles.arcgis.com/tiles/RVvWzU3lgJISqdke/arcgis/rest/services/BasemapOTT20240925/VectorTileServer",
                attribution: "IGAC"
            })
        ]
    });
}

export function initBasemapGallery({ view, BasemapGallery, container = "basemapGalleryDiv" }) {
    return new BasemapGallery({ view, container });
}

export function bindBasemapPanelToggle({
    buttonId = "btnBasemaps",
    panelId = "basemapPanel",
    wrapSelector = ".tool-dropdown-wrap"
} = {}) {
    const btnBasemaps = document.getElementById(buttonId);
    const basemapPanel = document.getElementById(panelId);
    const basemapWrap = document.querySelector(wrapSelector);

    if (!btnBasemaps || !basemapPanel || !basemapWrap) return;

    btnBasemaps.addEventListener("click", (e) => {
        e.stopPropagation();
        const visible = basemapPanel.style.display !== "none";
        basemapPanel.style.display = visible ? "none" : "block";
    });

    document.addEventListener("click", (e) => {
        if (!basemapWrap.contains(e.target)) {
            basemapPanel.style.display = "none";
        }
    });
}
