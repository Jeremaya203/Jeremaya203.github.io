    
    document.addEventListener("DOMContentLoaded", () => {

        document.querySelectorAll(".modulo-dropdown").forEach((dropdown) => {
            dropdown.addEventListener("mouseenter", () => {
                document.querySelectorAll(".modulo-dropdown.open").forEach((current) => {
                    if (current !== dropdown) current.classList.remove("open");
                });
                dropdown.classList.add("open");
            });

            dropdown.addEventListener("mouseleave", () => {
                dropdown.classList.remove("open");
            });
        });

        ModuleNavigation.bindTrigger("biofisicoTrigger", "biofisico.html");
        ModuleNavigation.bindTrigger("ordenamientoTrigger", "ordenamiento.html");
        ModuleNavigation.bindTrigger("legalTrigger", "contexto.html");
        ModuleNavigation.bindTrigger("limitesTrigger", "limites.html");
        ModuleNavigation.bindTrigger("ocupacionTrigger", "ocupacion.html");

    });


function initializeSearchRefreshButton() {

    const btnRefresh = document.getElementById("refreshSearchButton");

    if (!btnRefresh) return;

    btnRefresh.addEventListener("click", () => {

        if (typeof window.__resetSocioSearch === "function") {
            window.__resetSocioSearch();
            return;
        }

        const departmentSelect = document.getElementById("departamentos");
        const municipalitySelect = document.getElementById("municipios");

        // Reiniciar departamentos
        if (departmentSelect) {

            departmentSelect.innerHTML = `
                <option value="">Seleccionar departamento</option>
            `;

            departmentSelect.value = "";
        }

        // Reiniciar municipios
        if (municipalitySelect) {

            municipalitySelect.innerHTML = `
                <option value="">Seleccionar municipio</option>
            `;

            municipalitySelect.value = "";
        }

        // Recargar nuevamente los departamentos
        if (typeof loadDepartments === "function") {
            loadDepartments();
        }

        console.log("Filtros reiniciados");
    });
}
