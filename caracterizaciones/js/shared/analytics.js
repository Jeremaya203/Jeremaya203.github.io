"use strict";

    const MEASUREMENT_ID = "G-JB8FKBC408";
    const COMPONENTS = Object.freeze({
        "biofisico.html": "Biofísico",
        "socioeconomico.html": "Socioeconómico",
        "contexto.html": "Contexto legal",
        "ordenamiento.html": "Ordenamiento",
        "limites.html": "Límites",
        "ocupacion.html": "Ocupación"
    });

    class AnalyticsManager {
        constructor(windowRef, documentRef) {
            this.window = windowRef;
            this.document = documentRef;
            this.componentNames = new Set(Object.values(COMPONENTS));
            this.lastNavigationComponent = "";
            this.lastNavigationAt = 0;
        }

        initialize() {
            this.loadGoogleTag();
            this.bindAnalyticsEvents();
        }

        getPageName(value) {
            if (typeof value !== "string" || !value.trim()) {
                return "";
            }

            try {
                const url = new URL(value, this.window.location.href);
                return url.pathname.split("/").pop().toLowerCase();
            } catch (_) {
                return "";
            }
        }

        getComponentFromPage(value) {
            return COMPONENTS[this.getPageName(value)] || "";
        }

        obtenerComponenteActual() {
            return this.getComponentFromPage(this.window.location.pathname) || "Componente desconocido";
        }

        isAllowedEvent(nombreEvento, categoria, etiqueta) {
            if (nombreEvento === "acceso_componente" && categoria === "Navegación") {
                return etiqueta.startsWith("Acceso a ")
                    && this.componentNames.has(etiqueta.slice("Acceso a ".length));
            }

            if (nombreEvento === "acceso_descargables" && categoria === "Descargas") {
                return etiqueta.startsWith("Acceso a descargables - ")
                    && this.componentNames.has(etiqueta.slice("Acceso a descargables - ".length));
            }

            return false;
        }

        registrarEvento(nombreEvento, categoria, etiqueta) {
            if (!this.isAllowedEvent(nombreEvento, categoria, etiqueta)
                || typeof this.window.gtag !== "function") {
                return;
            }

            try {
                this.window.gtag("event", nombreEvento, {
                    event_category: categoria,
                    event_label: etiqueta,
                    value: 1
                });
            } catch (_) {
                // Analytics must never interfere with the application flow.
            }
        }

        registrarAccesoComponente(page) {
            const component = this.getComponentFromPage(page);
            const now = Date.now();

            if (!component || component === this.obtenerComponenteActual()) {
                return;
            }

    
            if (component === this.lastNavigationComponent && now - this.lastNavigationAt < 1000) {
                return;
            }

            this.lastNavigationComponent = component;
            this.lastNavigationAt = now;
            this.registrarEvento("acceso_componente", "Navegación", `Acceso a ${component}`);
        }

        registrarAccesoDescargables() {
            const component = this.obtenerComponenteActual();

            if (!this.componentNames.has(component)) {
                return;
            }

            this.registrarEvento(
                "acceso_descargables",
                "Descargas",
                `Acceso a descargables - ${component}`
            );
        }

        loadGoogleTag() {
            if (this.window.__characterizationsAnalyticsInitialized) {
                return;
            }

            this.window.__characterizationsAnalyticsInitialized = true;
            this.window.dataLayer = this.window.dataLayer || [];

            if (typeof this.window.gtag !== "function") {
                this.window.gtag = (...args) => {
                    this.window.dataLayer.push(args);
                };
            }

            try {
                this.window.gtag("js", new Date());
                this.window.gtag("config", MEASUREMENT_ID);
            } catch (_) {
            
            }

            const alreadyLoaded = Array.from(this.document.scripts).some((script) => (
                script.src.includes("googletagmanager.com/gtag/js")
                && script.src.includes(`id=${MEASUREMENT_ID}`)
            ));

            if (alreadyLoaded) {
                return;
            }

            const script = this.document.createElement("script");
            script.async = true;
            script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
            script.dataset.characterizationsGtag = MEASUREMENT_ID;
            script.onerror = function ignoreAnalyticsError() {};
            this.document.head.appendChild(script);
        }

        bindAnalyticsEvents() {
            if (this.window.__characterizationsAnalyticsEventsBound) {
                return;
            }

            this.window.__characterizationsAnalyticsEventsBound = true;
            this.document.addEventListener("click", (event) => {
                if (!(event.target instanceof this.window.Element)) {
                    return;
                }

                if (event.target.closest("#btnDescargables")) {
                    this.registrarAccesoDescargables();
                    return;
                }

                const link = event.target.closest("a[href]");
                if (link) {
                    this.registrarAccesoComponente(link.getAttribute("href"));
                }
            }, true);
        }
    }

    window.AnalyticsManager = AnalyticsManager;

    const analytics = window.CharacterizationsAnalytics
        || new AnalyticsManager(window, document);
    analytics.initialize();

    window.CharacterizationsAnalytics = analytics;
    window.registrarEventoAnalytics = analytics.registrarEvento.bind(analytics);
    window.registrarAccesoComponente = analytics.registrarAccesoComponente.bind(analytics);
    window.obtenerComponenteActual = analytics.obtenerComponenteActual.bind(analytics);
