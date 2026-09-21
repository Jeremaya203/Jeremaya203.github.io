export function bindZoomButtons({
    view,
    btnZoomInId = "btnZoomIn",
    btnZoomOutId = "btnZoomOut"
}) {
    const btnZoomIn = document.getElementById(btnZoomInId);
    const btnZoomOut = document.getElementById(btnZoomOutId);

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
}

export function bindMapActionButtons({
    view,
    homeWidget,
    locateWidget,
    btnHomeId = "btnHome",
    btnLocateId = "btnLocate",
    btnResetZoomId = "btnResetZoom"
}) {
    document.getElementById(btnHomeId)?.addEventListener("click", () => {
        homeWidget.go();
    });

    document.getElementById(btnLocateId)?.addEventListener("click", () => {
        locateWidget.locate();
    });

    document.getElementById(btnResetZoomId)?.addEventListener("click", () => {
        view.goTo({
            center: [-73.5, 4.5],
            zoom: 5
        }, {
            duration: 700,
            easing: "ease-in-out"
        });
    });
}

export function bindOverviewToggle({
    overviewView,
    syncOverviewExtent,
    drawMainExtent,
    overviewDivId = "overviewDiv",
    toggleId = "overviewMiniToggle"
}) {
    const overviewDivEl = document.getElementById(overviewDivId);
    const overviewMiniToggle = document.getElementById(toggleId);

    if (!overviewDivEl || !overviewMiniToggle) return;

    overviewMiniToggle.addEventListener("click", (e) => {
        e.stopPropagation();

        const minimized = overviewDivEl.classList.toggle("minimized");
        overviewMiniToggle.textContent = minimized ? "+" : "-";
        overviewMiniToggle.title = minimized ? "Expandir mapa" : "Minimizar mapa";

        if (!minimized) {
            setTimeout(() => {
                overviewView?.resize?.();
                syncOverviewExtent();
                drawMainExtent();
            }, 50);
        }
    });
}
