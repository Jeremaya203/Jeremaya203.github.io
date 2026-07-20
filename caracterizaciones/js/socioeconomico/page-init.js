    
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


function inicializarBotonRefrescarBusqueda() {

    const btnRefresh = document.getElementById("btnRefreshBusqueda");

    if (!btnRefresh) return;

    btnRefresh.addEventListener("click", () => {

        if (typeof window.__resetSocioSearch === "function") {
            window.__resetSocioSearch();
            return;
        }

        const selectDepartamentos = document.getElementById("departamentos");
        const selectMunicipios = document.getElementById("municipios");

        // Reiniciar departamentos
        if (selectDepartamentos) {

            selectDepartamentos.innerHTML = `
                <option value="">Seleccionar departamento</option>
            `;

            selectDepartamentos.value = "";
        }

        // Reiniciar municipios
        if (selectMunicipios) {

            selectMunicipios.innerHTML = `
                <option value="">Seleccionar municipio</option>
            `;

            selectMunicipios.value = "";
        }

        // Recargar nuevamente los departamentos
        if (typeof cargarDepartamentos === "function") {
            cargarDepartamentos();
        }

        console.log("Filtros reiniciados");
    });
}
