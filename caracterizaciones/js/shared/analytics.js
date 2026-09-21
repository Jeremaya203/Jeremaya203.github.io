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
        } catch {
                return "";
            }
        }

        getComponentFromPage(value) {
            return COMPONENTS[this.getPageName(value)] || "";
        }

        getCurrentComponent() {
            return this.getComponentFromPage(this.window.location.pathname) || "Componente desconocido";
        }

        isAllowedEvent(eventName, category, label) {
            if (eventName === "acceso_componente" && category === "Navegación") {
                return label.startsWith("Acceso a ")
                    && this.componentNames.has(label.slice("Acceso a ".length));
            }

            if (eventName === "acceso_descargables" && category === "Descargas") {
                return label.startsWith("Acceso a descargables - ")
                    && this.componentNames.has(label.slice("Acceso a descargables - ".length));
            }

            return false;
        }

        trackEvent(eventName, category, label) {
            if (!this.isAllowedEvent(eventName, category, label)
                || typeof this.window.gtag !== "function") {
                return;
            }

            try {
                this.window.gtag("event", eventName, {
                    event_category: category,
                    event_label: label,
                    value: 1
                });
            } catch {
                // Analytics must never interfere with the application flow.
            }
        }

        trackComponentAccess(page) {
            const component = this.getComponentFromPage(page);
            const now = Date.now();

            if (!component || component === this.getCurrentComponent()) {
                return;
            }

    
            if (component === this.lastNavigationComponent && now - this.lastNavigationAt < 1000) {
                return;
            }

            this.lastNavigationComponent = component;
            this.lastNavigationAt = now;
            this.trackEvent("acceso_componente", "Navegación", `Acceso a ${component}`);
        }

        trackDownloadsAccess() {
            const component = this.getCurrentComponent();

            if (!this.componentNames.has(component)) {
                return;
            }

            this.trackEvent(
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
            } catch {
            
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
                    this.trackDownloadsAccess();
                    return;
                }

                const link = event.target.closest("a[href]");
                if (link) {
                    this.trackComponentAccess(link.getAttribute("href"));
                }
            }, true);
        }
    }

    window.AnalyticsManager = AnalyticsManager;

    const analytics = window.CharacterizationsAnalytics
        || new AnalyticsManager(window, document);
    analytics.initialize();

    window.CharacterizationsAnalytics = analytics;
    window.trackAnalyticsEvent = analytics.trackEvent.bind(analytics);
    window.trackComponentAccess = analytics.trackComponentAccess.bind(analytics);
    window.getCurrentCharacterizationComponent = analytics.getCurrentComponent.bind(analytics);
    // Deprecated global aliases retained while component callers migrate.
    window.registrarEventoAnalytics = window.trackAnalyticsEvent;
    window.registrarAccesoComponente = window.trackComponentAccess;
    window.obtenerComponenteActual = window.getCurrentCharacterizationComponent;
