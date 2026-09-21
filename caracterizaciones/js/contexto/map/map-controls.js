export class MapControls {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        this.eventBus.on('map:ready', () => this._onMapReady());
    }

    _onMapReady() {
        window.require([
            'esri/widgets/Home',
            'esri/widgets/Locate',
            'esri/widgets/BasemapGallery',
            'esri/widgets/ScaleBar'
        ], (Home, Locate, BasemapGallery, ScaleBar) => {
            this._initWidgets(Home, Locate, BasemapGallery, ScaleBar);
            this._bindButtons();
        });
    }

    _initWidgets(Home, Locate, BasemapGallery, ScaleBar) {
        const view = this.state.view;
        if (!view) return;

        const scaleBar = new ScaleBar({ view, unit: 'metric', style: 'ruler' });
        view.ui.add(scaleBar, { position: 'bottom-left' });

        this.homeWidget = new Home({ view });
        this.locateWidget = new Locate({
            view,
            useHeadingEnabled: false,
            goToOverride: (v, goToParams) => v.goTo(goToParams.target, { duration: 800 })
        });

        new BasemapGallery({ view, container: 'basemapGalleryDiv' });
    }

    _bindButtons() {
        const view = this.state.view;
        if (!view) return;

        const btnHome = document.getElementById('btnHome');
        const btnLocate = document.getElementById('btnLocate');
        const btnReset = document.getElementById('btnResetZoom');
        const btnBasemaps = document.getElementById('btnBasemaps');
        const basemapPanel = document.getElementById('basemapPanel');
        const basemapWrap = document.querySelector('.tool-dropdown-wrap');

        if (btnHome) {
            btnHome.addEventListener('click', () => this.homeWidget.go());
        }

        if (btnLocate) {
            btnLocate.addEventListener('click', () => this.locateWidget.locate());
        }

        if (btnReset) {
            btnReset.addEventListener('click', () => {
                view.goTo(
                    { center: [-73.5, 4.5], zoom: 5 },
                    { duration: 700, easing: 'ease-in-out' }
                );
            });
        }

        if (btnBasemaps && basemapPanel) {
            btnBasemaps.addEventListener('click', (e) => {
                e.stopPropagation();
                basemapPanel.style.display = basemapPanel.style.display !== 'none' ? 'none' : 'block';
            });
        }

        if (basemapWrap) {
            document.addEventListener('click', (e) => {
                if (!basemapWrap.contains(e.target) && basemapPanel) {
                    basemapPanel.style.display = 'none';
                }
            });
        }
    }
}
