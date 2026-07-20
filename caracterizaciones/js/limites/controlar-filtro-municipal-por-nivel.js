        (function controlarFiltroMunicipalPorNivelLimites() {
            const TEXTO_MUNICIPIO_BLOQUEADO = "Municipio no disponible";
            let aplicandoBloqueo = false;
            let opcionBogotaDepartamento = null;

            function obtenerNivelLimitesActivo() {
                const activo = document.querySelector("#dropdownLimites .dropdown-item.active");
                return (activo?.dataset?.target || "Departamentos").toUpperCase();
            }

            function estaActivoLimitesDepartamentales() {
                return obtenerNivelLimitesActivo() === "DEPARTAMENTOS";
            }

            function limpiarSelectorMunicipal(select) {
                if (!select) return;
                if (
                    select.options.length === 1 &&
                    select.value === "" &&
                    select.options[0]?.textContent === TEXTO_MUNICIPIO_BLOQUEADO
                ) return;

                aplicandoBloqueo = true;
                select.innerHTML = "";
                const opcion = document.createElement("option");
                opcion.value = "";
                opcion.textContent = TEXTO_MUNICIPIO_BLOQUEADO;
                select.appendChild(opcion);
                select.value = "";
                aplicandoBloqueo = false;
            }

            function esOpcionBogotaDepartamento(opcion) {
                if (!opcion) return false;
                return opcion.value === "11" || /^bogot[aá]/i.test(opcion.textContent || "");
            }

            function quitarBogotaEnNivelDepartamental(select) {
                if (!select) return;
                const opcionBogota = Array.from(select.options).find(esOpcionBogotaDepartamento);
                if (!opcionBogota) return;

                if (select.value === opcionBogota.value) {
                    select.value = "0";
                }

                opcionBogotaDepartamento = opcionBogota.cloneNode(true);
                opcionBogota.remove();
            }

            function restaurarBogotaEnNivelMunicipal(select) {
                if (!select || Array.from(select.options).some(esOpcionBogotaDepartamento)) return;
                if (!opcionBogotaDepartamento) return;

                const opciones = Array.from(select.options);
                const opcionReferencia = opciones.find(opcion => {
                    if (opcion.value === "0" || opcion.value === "COL") return false;
                    return (opcion.textContent || "").localeCompare(opcionBogotaDepartamento.textContent || "", "es") > 0;
                });

                select.insertBefore(opcionBogotaDepartamento.cloneNode(true), opcionReferencia || null);
            }

            function actualizarEstadoFiltroDepartamental() {
                const select = document.getElementById("departamentos");
                if (!select) return;

                if (estaActivoLimitesDepartamentales()) {
                    quitarBogotaEnNivelDepartamental(select);
                    return;
                }

                restaurarBogotaEnNivelMunicipal(select);
            }

            function actualizarEstadoFiltroMunicipal() {
                const select = document.getElementById("municipios");
                if (!select) return;

                if (estaActivoLimitesDepartamentales()) {
                    limpiarSelectorMunicipal(select);
                    select.disabled = true;
                    select.setAttribute("aria-disabled", "true");
                    select.setAttribute("title", "Disponible solo en Límites Municipales");
                    return;
                }

                select.disabled = false;
                select.removeAttribute("aria-disabled");
                select.removeAttribute("title");
            }

            function bloquearEventoMunicipalSiAplica(evento) {
                if (!estaActivoLimitesDepartamentales()) return;

                const selectMunicipios = document.getElementById("municipios");
                if (!selectMunicipios || evento.target !== selectMunicipios) return;

                limpiarSelectorMunicipal(selectMunicipios);
                evento.preventDefault();
                evento.stopImmediatePropagation();
            }

            document.addEventListener("DOMContentLoaded", function () {
                const selectMunicipios = document.getElementById("municipios");
                if (selectMunicipios) {
                    const observador = new MutationObserver(function () {
                        if (aplicandoBloqueo || !estaActivoLimitesDepartamentales()) return;
                        limpiarSelectorMunicipal(selectMunicipios);
                    });
                    observador.observe(selectMunicipios, { childList: true });
                }

                const selectDepartamentos = document.getElementById("departamentos");
                if (selectDepartamentos) {
                    const observadorDepartamentos = new MutationObserver(function () {
                        actualizarEstadoFiltroDepartamental();
                    });
                    observadorDepartamentos.observe(selectDepartamentos, { childList: true });
                }

                document.addEventListener("change", bloquearEventoMunicipalSiAplica, true);

                document.addEventListener("change", function (evento) {
                    if (evento.target?.id !== "departamentos") return;
                    actualizarEstadoFiltroDepartamental();
                    setTimeout(actualizarEstadoFiltroMunicipal, 0);
                });

                document.addEventListener("click", function (evento) {
                    if (!evento.target?.closest("#dropdownLimites .dropdown-item")) return;
                    setTimeout(actualizarEstadoFiltroDepartamental, 0);
                    setTimeout(actualizarEstadoFiltroMunicipal, 0);
                }, true);

                actualizarEstadoFiltroDepartamental();
                actualizarEstadoFiltroMunicipal();
                setTimeout(actualizarEstadoFiltroDepartamental, 0);
                setTimeout(actualizarEstadoFiltroMunicipal, 0);
            });
        })();
    
