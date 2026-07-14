import { AppState } from "../app/state.js";

export function initOverview({
    EsriMap,
    MapView,
    Basemap,
    TileLayer,
    GraphicsLayer,
    Graphic,
    Extent,
    basemap
}) {
    const view = AppState.view;
    if (!view) return null;

    const overviewDivEl = document.getElementById("overviewDiv");
    const overviewMiniToggle = document.getElementById("overviewMiniToggle");

    const overviewBasemap = new Basemap({
        title: "Mapa satelital",
        baseLayers: [
            new TileLayer({
                url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
                attribution: "Earthstar Geographics"
            })
        ]
    });

    const overviewMap = new EsriMap({ basemap: overviewBasemap });

    const overviewGraphics = new GraphicsLayer({ listMode: "hide" });
    overviewMap.add(overviewGraphics);

    const overviewView = new MapView({
        container: "overviewMap",
        map: overviewMap,
        constraints: { rotationEnabled: false },
        ui: { components: [] }
    });

    function syncOverviewExtent() {
        if (!view || !overviewView || !view.extent) return;
        if (overviewDivEl?.classList.contains("minimized")) return;

        const center = view.extent.center;
        const width = view.extent.width * 4;
        const height = view.extent.height * 4;

        overviewView.extent = new Extent({
            xmin: center.x - width / 2,
            ymin: center.y - height / 2,
            xmax: center.x + width / 2,
            ymax: center.y + height / 2,
            spatialReference: view.extent.spatialReference
        });
    }

    function drawMainExtent() {
        if (!view?.extent) return;
        if (overviewDivEl?.classList.contains("minimized")) return;

        overviewGraphics.removeAll();

        overviewGraphics.add(new Graphic({
            geometry: view.extent.clone(),
            symbol: {
                type: "simple-fill",
                color: [0, 120, 255, 0.03],
                outline: {
                    color: [0, 120, 255, 0.9],
                    width: 2
                }
            }
        }));
    }

    overviewMiniToggle?.addEventListener("click", (e) => {
        e.stopPropagation();

        const minimized = overviewDivEl.classList.toggle("minimized");
        overviewMiniToggle.textContent = minimized ? "+" : "−";
        overviewMiniToggle.title = minimized ? "Expandir mapa" : "Minimizar mapa";

        if (!minimized) {
            setTimeout(() => {
                overviewView?.resize?.();
                syncOverviewExtent();
                drawMainExtent();
            }, 50);
        }
    });

    view.watch("stationary", (isStationary) => {
        if (isStationary) {
            syncOverviewExtent();
            drawMainExtent();
        }
    });

    overviewView.when(() => {
        syncOverviewExtent();
        drawMainExtent();
    });

    let isDragging = false;

    overviewView.on("drag", (event) => {
        event.stopPropagation();

        const mapPoint = overviewView.toMap(event);
        if (!mapPoint) return;

        if (event.action === "start") {
            isDragging = true;
        }

        if (isDragging) {
            view.center = mapPoint;
        }

        if (event.action === "end") {
            isDragging = false;
        }
    });

    AppState.overviewView = overviewView;

    return overviewView;
}
