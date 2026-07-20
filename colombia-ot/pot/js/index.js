
const listEtapas = [{
    id: 0,
    text: "Todas las etapas"
}, {
    id: 1,
    text: "Diagnóstico"
}, {
    id: 2,
    text: "Formulación"
}, {
    id: 3,
    text: "Implementación"
}, {
    id: 4,
    text: "Evaluación y seguimiento"
}]

$(document).ready(function () {
    if (window.OOT && window.OOT.loadShell) {
        window.OOT.loadShell();
    }
    
    // Bindings para remover onclick inline (CSP)
    $(".btnBusqueda").on("click", function (e) {
        e.preventDefault();
        searchPOT();
    });
    $(".btnVerTodos").on("click", function (e) {
        e.preventDefault();
        searchPOT('0');
    });
    $(".close-login-btn").on("click", function (e) {
        e.preventDefault();
        closeLogin();
    });
    $("#logoutBtn").on("click", function (e) {
        signOut();
    });

    $("[data-toggle='popover']").popover();
    $('[data-toggle="tooltip"]').tooltip();

    var params = "";
    $.ajax({
        url: web_service + "/config?cmd=config_buscador&t=" + (new Date()).getTime() + params,
        type: 'POST',
        success: function (data) {
            if (data.status) {
                initData(data);
            }
        },
        timeout: 20000,
        error: function (err) {
            console.error(err);
        }
    });
    $.ajax({
        url: web_service + "/documentos?cmd=pot_consultados&t=" + (new Date()).getTime(),
        type: 'POST',
        success: function (data) {
            if (data.status) {
                potsConsultados(data)
            }
        },
        timeout: 20000,
        error: function (err) {

        }
    });
});

function initData(data) {
    $("#searchEntidadTerritorial").select2({
        data: cacheUnidadesFiltro,
        multiple: false,
        placeholder: "Selecciona una entidad territorial",
        query: function (query) {
            if ((query.term == null) || (query.term == "")) {
                query.callback({
                    results: cacheUnidadesFiltro
                });
            } else {
                var results = [];
                for (var i = 0; i < cacheUnidadesFiltro.length; i++) {
                    if (limpiarTexto(cacheUnidadesFiltro[i].text).indexOf(limpiarTexto(query.term)) != -1) {
                        if (cacheUnidadesFiltro[i].type == "MUNI") {
                            results.push({
                                type: cacheUnidadesFiltro[i].type,
                                id: cacheUnidadesFiltro[i].id,
                                text: cacheUnidadesFiltro[i].text + ", " + getDeptoByMuni(cacheUnidadesFiltro[i].id).text
                            });
                        } else {
                            results.push({
                                type: cacheUnidadesFiltro[i].type,
                                id: cacheUnidadesFiltro[i].id,
                                text: cacheUnidadesFiltro[i].text
                            });
                        }
                    }
                }
                query.callback({
                    results: results
                });
            }
        },
        templateResult: function (data) {
            if (!data.type) {
                return data.text;
            }
            return $("<span class='" + data.type + "'>" + data.text + "</span>");
        }
    });
    $("#searchEntidadTerritorial").val(null);
    $("#searchEntidadTerritorial").trigger("change");
    $("#searchEntidadTerritorial").on("change", function (e) {
        reporteUso("Selección unidad", {
            unidad: $("#searchEntidadTerritorial").val() + " - " + $("#searchEntidadTerritorial").select2("data")[0].text
        });

        var data = $("#searchEntidadTerritorial").select2("data")[0];
        if (data.type == "MUNI") {
            var params = {};
            params.tipo = data.type;
            params.codigo = data.id;
            $.ajax({
                url: web_service + "/unidad?cmd=query_codigo",
                data: params,
                type: 'POST',
                success: function (data) {
                    if (data.status) {
                        // updateInicio();
                    } else {
                        showLoading("Ha ocurrido un error, consultando la unidad selecccionada.", null, "red", true);
                    }
                },
                error: function (_data) {
                    showLoading("Ha ocurrido un error, consultando la unidad selecccionada.", null, "red", true);
                }
            });
        }
        if (data.type == "DEPTO") {
            var params = {};
            params.tipo = data.type;
            params.codigo = data.id;
            $.ajax({
                url: web_service + "/unidad?cmd=query_codigo",
                data: params,
                type: 'POST',
                success: function (data) {
                    if (data.status) {
                        // updateInicio();
                    } else {
                        showLoading("Ha ocurrido un error, consultando la unidad selecccionada.", null, "red", true);
                    }
                },
                error: function (_data) {
                    showLoading("Ha ocurrido un error, consultando la unidad selecccionada.", null, "red", true);
                }
            });
        }
        if (data.type == "PAIS") {
            // updateInicio();
        }

        activeBusqueda();
    });

    $("#searchEtapa-idx").on("change", function (e) {
        activeBusqueda();
    })

    $("#searchEtapa-idx").select2({
        data: listEtapas,
        allowClear: true,
        minimumResultsForSearch: Infinity,
        placeholder: "Selecciona una etapa del POT"
    });
    $("#searchEtapa-idx").val(null);
    $("#searchEtapa-idx").trigger("change");
}

function potsConsultados(data) {
    if (!data.POTS) {
        $(".recursos-destacados").hide();
        $("#containerDestacados").hide();
        return
    }

    var strHTMLIndicadores = "";
    var strHTMLItems = "";
    var paginas = Math.round(data.POTS.length / 5);
    var pos = 0;
    for (var i = 0; i < paginas; i++) {
        if (i == 0) {
            strHTMLIndicadores = strHTMLIndicadores + "<li data-target='#carouselRecursos' data-slide-to='" + i + "' class='active'></li>";
            strHTMLItems += "<div class='item active'>";
        } else {
            strHTMLIndicadores = strHTMLIndicadores + "<li data-target='#carouselRecursos' data-slide-to='" + i + "'></li>";
            strHTMLItems += "<div class='item'>";
        }
        strHTMLItems += "<table class='oot-js-potindex-1' cellpadding='10'>";
        strHTMLItems += "<tr>";
        for (var j = 0; j < 5; j++) {
            if (pos < data.POTS.length) {
                let nameDPTO = replaceAll(limpiarTexto(data.POTS[pos].DEPTO), " ", "");
                strHTMLItems += "<td class=" + nameDPTO + ">";

                strHTMLItems += "<div class='carousel-container' data-carousel-color='#" + ((1 << 24) * Math.random() | 0).toString(16) + "' onclick=\"searchPOT('" + data.POTS[pos].CODIGO + "')\">";

                strHTMLItems += "<img class='image' src='/images/recursos/dptos/" + nameDPTO + ".svg' />";
                strHTMLItems += "<p class='title b'>" + data.POTS[pos].UNIDAD + "</p>"
                strHTMLItems += "<p>" + data.POTS[pos].DEPTO + "</p>"

                strHTMLItems += "</div>";

                strHTMLItems += "</td>";
            } else {
                strHTMLItems += "<td class='box-card'></td>";
            }
            pos++;
        }
        strHTMLItems += "</tr>";
        strHTMLItems += "</table>";
        strHTMLItems += "</div>";
    }

    $("#carouselRecursosIndicators").html(strHTMLIndicadores);
    $("#carouselRecursosItems").html(strHTMLItems);
    $("#carouselRecursosItems .carousel-container[data-carousel-color]").each(function () {
        $(this).css("background", $(this).attr("data-carousel-color"));
    });
    $("#containerDestacados").show();
    $(".recursos-destacados").show();
}

function activeBusqueda() {
    if ($("#searchEtapa-idx").val() != null && $("#searchEntidadTerritorial").val() != null) {
        $("#btnBusqueda").css('cursor', 'pointer');
        $("#btnBusqueda").attr("src", "/images/iconos/btnBusquedaActive.png");
    } else {
        $("#btnBusqueda").css('cursor', 'not-allowed');
        $("#btnBusqueda").attr("src", "/images/iconos/btnBusqueda.png");
    }
}

function searchPOT(codMunicipio) {
    if (codMunicipio == '0') {
        window.location.href = "buscador.html";
        return;
    } else if (codMunicipio) {
        window.location.href = "buscador.html?u=" + codMunicipio;
        return;
    }

    let entidadTerritorial = $("#searchEntidadTerritorial").val() || "0";
    let etapaVal = $("#searchEtapa-idx").val();
    let etapaText = etapaVal == 0 ? "" : $("#searchEtapa-idx").find(':selected').text();

    if (etapaVal != null) {
        window.location.href = "buscador.html?u=" + entidadTerritorial + "&etapa=" + etapaText;
        return;
    }
}