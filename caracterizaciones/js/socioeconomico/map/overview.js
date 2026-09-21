export function createOverviewController({
    view,
    overviewView,
    overviewGraphics,
    overviewDivEl,
    Extent,
    Graphic
}) {
    function syncOverviewExtent() {
        if (!view || !overviewView || !view.extent) return;
        if (overviewDivEl.classList.contains("minimized")) return;

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
        if (overviewDivEl.classList.contains("minimized")) return;

        overviewGraphics.removeAll();

        const graphic = new Graphic({
            geometry: view.extent.clone(),
            symbol: {
                type: "simple-fill",
                color: [0, 120, 255, 0.03],
                outline: {
                    color: [0, 120, 255, 0.9],
                    width: 2
                }
            }
        });

        overviewGraphics.add(graphic);
    }

    function bindOverviewEvents() {
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
    }

    return {
        syncOverviewExtent,
        drawMainExtent,
        bindOverviewEvents
    };
}
