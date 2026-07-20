export class TerritorySelector {
    constructor({ eventBus, state }) {
        this.eventBus = eventBus;
        this.state = state;
    }

    selectDepartment(deptoCode) {
        this.state?.merge({
            deptoActual: deptoCode || "",
            municipioActual: "",
            filtroNivel: deptoCode ? "DEPTO" : "",
            whereBase: deptoCode ? `dpcodigo = '${deptoCode}'` : ""
        });

        this.eventBus?.emit("territory:changed", {
            level: deptoCode ? "DEPTO" : "",
            deptoCode
        });
    }

    selectMunicipality(municipioCode) {
        const deptoCode = municipioCode ? municipioCode.substring(0, 2) : "";

        this.state?.merge({
            municipioActual: municipioCode || "",
            deptoActual: deptoCode,
            filtroNivel: municipioCode ? "MUNI" : "",
            whereBase: municipioCode ? `mpcodigo = '${municipioCode}'` : ""
        });

        this.eventBus?.emit("territory:changed", {
            level: municipioCode ? "MUNI" : "",
            deptoCode,
            municipioCode
        });
    }
}
