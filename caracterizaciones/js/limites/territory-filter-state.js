(function initializeTerritoryFilterState() {
    "use strict";

    const BLOCKED_MUNICIPALITY_TEXT = "Municipio no disponible";
    const DEPARTMENT_LEVEL = "DEPARTAMENTOS";
    let isApplyingLock = false;
    let cachedBogotaOption = null;

    function getActiveBoundaryLevel() {
        const activeItem = document.querySelector("#dropdownLimites .dropdown-item.active");
        return (activeItem?.dataset?.target || "Departamentos").toUpperCase();
    }

    function isDepartmentLevelActive() {
        return getActiveBoundaryLevel() === DEPARTMENT_LEVEL;
    }

    function resetMunicipalitySelect(select) {
        if (!select) return;
        const alreadyReset = select.options.length === 1
            && select.value === ""
            && select.options[0]?.textContent === BLOCKED_MUNICIPALITY_TEXT;
        if (alreadyReset) return;

        isApplyingLock = true;
        select.innerHTML = "";

        const option = document.createElement("option");
        option.value = "";
        option.textContent = BLOCKED_MUNICIPALITY_TEXT;
        select.appendChild(option);
        select.value = "";
        isApplyingLock = false;
    }

    function isBogotaDepartmentOption(option) {
        if (!option) return false;
        return option.value === "11" || /^bogot[a\u00e1]/i.test(option.textContent || "");
    }

    function removeBogotaAtDepartmentLevel(select) {
        if (!select) return;
        const bogotaOption = Array.from(select.options).find(isBogotaDepartmentOption);
        if (!bogotaOption) return;

        if (select.value === bogotaOption.value) select.value = "0";
        cachedBogotaOption = bogotaOption.cloneNode(true);
        bogotaOption.remove();
    }

    function restoreBogotaAtMunicipalityLevel(select) {
        if (!select || Array.from(select.options).some(isBogotaDepartmentOption)) return;
        if (!cachedBogotaOption) return;

        const referenceOption = Array.from(select.options).find((option) => {
            if (option.value === "0" || option.value === "COL") return false;
            return (option.textContent || "").localeCompare(cachedBogotaOption.textContent || "", "es") > 0;
        });
        select.insertBefore(cachedBogotaOption.cloneNode(true), referenceOption || null);
    }

    function updateDepartmentFilterState() {
        const departmentSelect = document.getElementById("departamentos");
        if (!departmentSelect) return;

        if (isDepartmentLevelActive()) {
            removeBogotaAtDepartmentLevel(departmentSelect);
            return;
        }

        restoreBogotaAtMunicipalityLevel(departmentSelect);
    }

    function updateMunicipalityFilterState() {
        const municipalitySelect = document.getElementById("municipios");
        if (!municipalitySelect) return;

        if (isDepartmentLevelActive()) {
            resetMunicipalitySelect(municipalitySelect);
            municipalitySelect.disabled = true;
            municipalitySelect.setAttribute("aria-disabled", "true");
            municipalitySelect.setAttribute("title", "Disponible solo en L\u00edmites Municipales");
            return;
        }

        municipalitySelect.disabled = false;
        municipalitySelect.removeAttribute("aria-disabled");
        municipalitySelect.removeAttribute("title");
    }

    function blockMunicipalityChangeAtDepartmentLevel(event) {
        if (!isDepartmentLevelActive()) return;

        const municipalitySelect = document.getElementById("municipios");
        if (!municipalitySelect || event.target !== municipalitySelect) return;

        resetMunicipalitySelect(municipalitySelect);
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    document.addEventListener("DOMContentLoaded", () => {
        const municipalitySelect = document.getElementById("municipios");
        if (municipalitySelect) {
            const municipalityObserver = new MutationObserver(() => {
                if (isApplyingLock || !isDepartmentLevelActive()) return;
                resetMunicipalitySelect(municipalitySelect);
            });
            municipalityObserver.observe(municipalitySelect, { childList: true });
        }

        const departmentSelect = document.getElementById("departamentos");
        if (departmentSelect) {
            const departmentObserver = new MutationObserver(updateDepartmentFilterState);
            departmentObserver.observe(departmentSelect, { childList: true });
        }

        document.addEventListener("change", blockMunicipalityChangeAtDepartmentLevel, true);
        document.addEventListener("change", (event) => {
            if (event.target?.id !== "departamentos") return;
            updateDepartmentFilterState();
            setTimeout(updateMunicipalityFilterState, 0);
        });
        document.addEventListener("click", (event) => {
            if (!event.target?.closest("#dropdownLimites .dropdown-item")) return;
            setTimeout(updateDepartmentFilterState, 0);
            setTimeout(updateMunicipalityFilterState, 0);
        }, true);

        updateDepartmentFilterState();
        updateMunicipalityFilterState();
        setTimeout(updateDepartmentFilterState, 0);
        setTimeout(updateMunicipalityFilterState, 0);
    });
})();

