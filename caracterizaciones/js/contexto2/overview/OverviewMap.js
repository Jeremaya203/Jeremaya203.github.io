export class OverviewMap {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        this.overviewView = null;
        this.overviewGraphics = null;
        this._Extent = null;
        this._Graphic = null;
        this.eventBus.on('map:ready', () => this._onMapReady());
    }

    _onMapReady() {
        window.require([
            'esri/Map',
            'esri/views/MapView',
            'esri/Basemap',
            'esri/layers/TileLayer',
            'esri/layers/VectorTileLayer',
            'esri/layers/GraphicsLayer',
            'esri/Graphic',
            'esri/geometry/Extent'
        ], (EsriMap, MapView, Basemap, TileLayer, VectorTileLayer, GraphicsLayer, Graphic, Extent) => {
            this._Extent = Extent;
            this._Graphic = Graphic;
            this._createOverview(EsriMap, MapView, Basemap, TileLayer, VectorTileLayer, GraphicsLayer);
            this._bindToggle();
            this._syncOnStationary();
            this._initOverview();
        });
    }

    _createOverview(EsriMap, MapView, Basemap, TileLayer, VectorTileLayer, GraphicsLayer) {
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

        const overviewMap = new EsriMap({ basemap: igacSatelitalTopo });
        this.overviewGraphics = new GraphicsLayer({ listMode: 'hide' });
        overviewMap.add(this.overviewGraphics);

        this.overviewView = new MapView({
            container: 'overviewMap',
            map: overviewMap,
            constraints: { rotationEnabled: false },
            ui: { components: [] }
        });
    }

    _bindToggle() {
        const toggleBtn = document.getElementById('overviewMiniToggle');
        const overviewDiv = document.getElementById('overviewDiv');

        if (toggleBtn && overviewDiv) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const minimized = overviewDiv.classList.toggle('minimized');
                toggleBtn.textContent = minimized ? '+' : '−';
                toggleBtn.title = minimized ? 'Expandir mapa' : 'Minimizar mapa';

                if (!minimized) {
                    setTimeout(() => {
                        this.overviewView?.resize?.();
                        this.syncExtent();
                        this.drawMainExtent();
                    }, 50);
                }
            });
        }
    }

    _syncOnStationary() {
        const view = this.state.view;
        if (!view) return;

        view.watch('stationary', (isStationary) => {
            if (isStationary) {
                this.syncExtent();
                this.drawMainExtent();
            }
        });
    }

    _initOverview() {
        this.overviewView.when(() => {
            this.syncExtent();
            this.drawMainExtent();
        });
    }

    syncExtent() {
        const view = this.state.view;
        if (!view || !this.overviewView || !view.extent) return;

        const overviewDiv = document.getElementById('overviewDiv');
        if (overviewDiv && overviewDiv.classList.contains('minimized')) return;

        const center = view.extent.center;
        const width = view.extent.width * 4;
        const height = view.extent.height * 4;

        if (this._Extent) {
            this.overviewView.extent = new this._Extent({
                xmin: center.x - width / 2,
                ymin: center.y - height / 2,
                xmax: center.x + width / 2,
                ymax: center.y + height / 2,
                spatialReference: view.extent.spatialReference
            });
        }
    }

    drawMainExtent() {
        const view = this.state.view;
        if (!view?.extent || !this.overviewGraphics) return;

        const overviewDiv = document.getElementById('overviewDiv');
        if (overviewDiv && overviewDiv.classList.contains('minimized')) return;

        this.overviewGraphics.removeAll();

        if (this._Graphic) {
            const graphic = new this._Graphic({
                geometry: view.extent.clone(),
                symbol: {
                    type: 'simple-fill',
                    color: [0, 120, 255, 0.03],
                    outline: { color: [0, 120, 255, 0.9], width: 2 }
                }
            });
            this.overviewGraphics.add(graphic);
        }
    }
}
