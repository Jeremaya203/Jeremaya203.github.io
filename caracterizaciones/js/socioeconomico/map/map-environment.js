export function createMapEnvironment({
    state,
    mapDeps,
    mapControls,
    basemapController,
    overviewControllerFactory,
    onMapClick
}) {
    const {
        EsriMap,
        MapView,
        Basemap,
        TileLayer,
        VectorTileLayer,
        GraphicsLayer,
        Graphic,
        Extent,
        Home,
        Locate,
        BasemapGallery,
        ScaleBar
    } = mapDeps;

    const {
        createIgacSatelitalTopo,
        initBasemapGallery,
        bindBasemapPanelToggle
    } = basemapController;

    const {
        bindMapActionButtons,
        bindOverviewToggle
    } = mapControls;

    const igacSatelitalTopo = createIgacSatelitalTopo({
        Basemap,
        TileLayer,
        VectorTileLayer
    });

    const map = new EsriMap({
        basemap: igacSatelitalTopo,
        layers: []
    });

    const view = new MapView({
        container: "mapDiv",
        map,
        center: [-73.5, 4.5],
        zoom: 5,
        ui: {
            components: ["attribution"]
        }
    });

    state.set("map", map);
    state.set("view", view);

    if (typeof onMapClick === "function") {
        view.on("click", onMapClick);
    }

    const scaleBar = new ScaleBar({
        view,
        unit: "metric",
        style: "ruler"
    });

    view.ui.add(scaleBar, {
        position: "bottom-left"
    });

    const homeWidget = new Home({ view });
    const locateWidget = new Locate({
        view,
        useHeadingEnabled: false,
        goToOverride: (currentView, goToParams) => currentView.goTo(goToParams.target, { duration: 800 })
    });

    initBasemapGallery({
        view,
        BasemapGallery
    });

    bindMapActionButtons({
        view,
        homeWidget,
        locateWidget
    });

    const overviewDivEl = document.getElementById("overviewDiv");
    bindBasemapPanelToggle();

    const overviewMap = new EsriMap({
        basemap: igacSatelitalTopo
    });

    const overviewGraphics = new GraphicsLayer({ listMode: "hide" });
    overviewMap.add(overviewGraphics);

    const overviewView = new MapView({
        container: "overviewMap",
        map: overviewMap,
        constraints: { rotationEnabled: false },
        ui: { components: [] }
    });

    const {
        syncOverviewExtent,
        drawMainExtent,
        bindOverviewEvents
    } = overviewControllerFactory({
        view,
        overviewView,
        overviewGraphics,
        overviewDivEl,
        Extent,
        Graphic
    });

    bindOverviewToggle({
        overviewView,
        syncOverviewExtent,
        drawMainExtent
    });

    bindOverviewEvents();

    function bindViewReady({ hideTimeSlider, bindZoomButtons }) {
        view.when(() => {
            state.set("extentInicial", view.map.initialViewProperties?.extent?.clone() || view.extent.clone());
            hideTimeSlider();
            bindZoomButtons({ view });
        });
    }

    return {
        map,
        view,
        bindViewReady
    };
}
