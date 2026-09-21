export class TerritorySelector {
    constructor({ eventBus, state }) {
        this.eventBus = eventBus;
        this.state = state;
    }

    selectDepartment(departmentCode) {
        this.state?.merge({
            currentDepartmentId: departmentCode || "",
            currentMunicipalityId: "",
            territoryLevel: departmentCode ? "DEPTO" : "",
            whereBase: departmentCode ? `dpcodigo = '${departmentCode}'` : ""
        });

        this.eventBus?.emit("territory:changed", {
            level: departmentCode ? "DEPTO" : "",
            departmentCode
        });
    }

    selectMunicipality(municipioCode) {
        const departmentCode = municipioCode ? municipioCode.substring(0, 2) : "";

        this.state?.merge({
            currentMunicipalityId: municipioCode || "",
            currentDepartmentId: departmentCode,
            territoryLevel: municipioCode ? "MUNI" : "",
            whereBase: municipioCode ? `mpcodigo = '${municipioCode}'` : ""
        });

        this.eventBus?.emit("territory:changed", {
            level: municipioCode ? "MUNI" : "",
            departmentCode,
            municipioCode
        });
    }
}
