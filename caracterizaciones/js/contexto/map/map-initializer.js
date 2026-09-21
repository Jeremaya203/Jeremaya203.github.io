export class MapInitializer {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        this.extentInicial = null;
    }

    init(containerId = 'mapDiv') {
        return new Promise((resolve) => {
            window.require([
                'esri/Map',
                'esri/views/MapView',
                'esri/Basemap',
                'esri/layers/TileLayer',
                'esri/layers/VectorTileLayer',
                'esri/geometry/Extent'
            ], (EsriMap, MapView, Basemap, TileLayer, VectorTileLayer, Extent) => {
                this._createMap(EsriMap, Basemap, TileLayer, VectorTileLayer);
                this._createView(MapView, containerId);
                this.view.when(() => {
                    this._onViewReady(Extent);
                    resolve();
                });
            });
        });
    }

    _createMap(EsriMap, Basemap, TileLayer, VectorTileLayer) {
        const igacSatelitalTopo = new Basemap({
            title: 'Mapa Satelital-Topográfico Colombia',
            baseLayers: [
                new TileLayer({
                    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
                    attribution: 'Earthstar Geographics'
                }),
                new TileLayer({
                    url: 'https://tiles.arcgis.com/tiles/RVvWzU3lgJISqdke/arcgis/rest/services/BasemapRaster/MapServer',
                    attribution: 'Instituto Geográfico Agustín Codazzi - IGAC'
                }),
                new VectorTileLayer({
                    url: 'https://tiles.arcgis.com/tiles/RVvWzU3lgJISqdke/arcgis/rest/services/BasemapOTT20240925/VectorTileServer',
                    attribution: 'IGAC'
                })
            ]
        });

        this.map = new EsriMap({
            basemap: igacSatelitalTopo,
            layers: []
        });
    }

    _createView(MapView, containerId) {
        this.view = new MapView({
            container: containerId,
            map: this.map,
            center: [-73.5, 4.5],
            zoom: 5,
            ui: {
                components: ['attribution']
            }
        });
    }

    _onViewReady(Extent) {
        this.extentInicial = this.view.map.initialViewProperties?.extent?.clone() || this.view.extent.clone();

        this.state.map = this.map;
        this.state.view = this.view;
        this.eventBus.emit('map:ready', { map: this.map, view: this.view });

        this._setupZoomSlider();
        this._setupZoomButtons();
    }

    _setupZoomSlider() {
        const slider = document.getElementById('zoomSlider');
        if (!slider) return;

        slider.value = this.view.zoom;

        slider.addEventListener('input', () => {
            this.view.zoom = Number(slider.value);
        });

        this.view.watch('zoom', (z) => {
            slider.value = z;
        });
    }

    _setupZoomButtons() {
        const btnIn = document.getElementById('btnZoomIn');
        const btnOut = document.getElementById('btnZoomOut');

        if (btnIn) {
            btnIn.addEventListener('click', () => {
                this.view.goTo({ zoom: this.view.zoom + 1 });
            });
        }

        if (btnOut) {
            btnOut.addEventListener('click', () => {
                this.view.goTo({ zoom: this.view.zoom - 1 });
            });
        }
    }
}
