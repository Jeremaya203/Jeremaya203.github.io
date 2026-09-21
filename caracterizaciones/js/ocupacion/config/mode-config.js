export class ModeConfig {
    static modes = {
        DISTRIBUCION_POBLACION: {
            label: "Distribución de la Población",
            buttonId: "btnDistribucionPoblacion"
        },
        COMPOSICION_POBLACION: {
            label: "Composición de la Población",
            buttonId: "btnComposicionPoblacion"
        },
        TAMANO_DISTRIBUCION_PROPIEDAD: {
            label: "Tamaño y Distribución de la Propiedad Rural",
            buttonId: "btnPropiedadRural"
        },
        CONTEXTO_HISTORICO: {
            label: "Contexto Histórico",
            buttonId: "btnContextoHistorico"
        }
    };

    static getLabel(mode) {
        return this.modes[mode]?.label || mode || "Vista";
    }

    static fromTabLabel(tabLabel) {
        const tab = String(tabLabel || "");
        if (tab.includes("Distribu")) return "DISTRIBUCION_POBLACION";
        if (tab.includes("Composici")) return "COMPOSICION_POBLACION";
        if (tab.includes("Contexto")) return "CONTEXTO_HISTORICO";
        if (tab.includes("Tama") || tab.includes("Propiedad")) return "TAMANO_DISTRIBUCION_PROPIEDAD";
        return null;
    }
}
