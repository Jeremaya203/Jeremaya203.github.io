import { AppState } from "../app/state.js";

export function createMainMap({
    EsriMap,
    MapView,
    Basemap,
    TileLayer,
    VectorTileLayer
}) {
    const igacSatelitalTopo = new Basemap({
        title: "Mapa Satelital-Topográfico Colombia",
        baseLayers: [
            new TileLayer({
                url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
                attribution: "Earthstar Geographics"
            }),
            new TileLayer({
                url: "https://tiles.arcgis.com/tiles/RVvWzU3lgJISqdke/arcgis/rest/services/BasemapRaster/MapServer",
                attribution: "Instituto Geográfico Agustín Codazzi - IGAC"
            }),
            new VectorTileLayer({
                url: "https://tiles.arcgis.com/tiles/RVvWzU3lgJISqdke/arcgis/rest/services/BasemapOTT20240925/VectorTileServer",
                attribution: "IGAC"
            })
        ]
    });

    AppState.map = new EsriMap({
        basemap: igacSatelitalTopo,
        layers: []
    });

    AppState.view = new MapView({
        container: "mapDiv",
        map: AppState.map,
        center: [-73.5, 4.5],
        zoom: 5,
        ui: {
            components: ["attribution"]
        }
    });

    return {
        map: AppState.map,
        view: AppState.view,
        basemap: igacSatelitalTopo
    };
}