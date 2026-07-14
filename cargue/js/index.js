var currentUser;
var firebase_ui;
var currentScreen;
var currentEstado = "init";
var currentSearch = "all";
var firstExpand = true;
var firstParameters = true;

var currentDocumento = null;
var currentRecurso = null;
var currentPot = null;

var tableDocumentos;
var tableDocumentosIGAC;
var tableRecursos;
var tablePot;

var cacheUnidades;
var cacheUnidadesFiltro;

var web_service = "https://serviciosgeovisor.igac.gov.co:8080/Geovisor";
var web_service_proxy = "https://serviciosgeovisor.igac.gov.co:8080/Geovisor";

// Solo pruebas locales: fuerza permisos de interfaz (el Geovisor revalida en servidor).
var DEBUG_FORZAR_PERMISOS = false;

var spanishDataTable = {
    "sProcessing": "Procesando...",
    "sLengthMenu": "_MENU_",
    "sZeroRecords": "No se encontraron resultados",
    "sEmptyTable": "Ningún dato disponible en esta tabla",
    "sInfo": "_START_ - _END_ de _TOTAL_ resultados",
    "sInfoEmpty": "No hay resultados",
    "sInfoFiltered": "(filtrado de un total de _MAX_ registros)",
    "sInfoPostFix": "",
    "sSearch": "Buscar:",
    "sUrl": "",
    "sInfoThousands": ",",
    "sLoadingRecords": "Cargando...",
    "oPaginate": {
        "sFirst": "Primero",
        "sLast": "Último",
        "sNext": "<i class='fas fa-chevron-right'></i>",
        "sPrevious": "<i class='fas fa-chevron-left'></i>"
    },
    "oAria": {
        "sSortAscending": ": Activar para ordenar la columna de manera ascendente",
        "sSortDescending": ": Activar para ordenar la columna de manera descendente"
    }
}

$(document).ready(function () {
    $("[data-toggle='popover']").popover();
    toggleMenu(currentEstado);
    var config = {
        apiKey: "AIzaSyCLSp_Qbaohj8owxrpZxvrmxUSkVw0ukig",
        authDomain: "geovisor-igac.firebaseapp.com"
    };
    firebase.initializeApp(config);
    firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
            currentUser = user;
            $("#loginContainer").hide();
            $("#logoutContainer").show();
            $("#userName,#userName2").html(user.displayName);
            if (user.photoURL != null) {
                if (user.photoURL != "") {
                    $("#userPhoto,#userPhoto2").attr("src", user.photoURL);
                } else {
                    $("#userPhoto,#userPhoto2").attr("src", "images/iconos/User.png");
                }
            } else {
                $("#userPhoto,#userPhoto2").attr("src", "images/iconos/User.png");
            }
            currentUser.getIdToken().then(function (accessToken) {
                currentAccessToken = accessToken;
                $.ajax({
                    url: web_service + "/validate?token=" + currentAccessToken + "&t=" + (new Date()).getTime(),
                    type: 'GET',
                    dataType: 'json',
                    success: function (data) {
                        // ⚠️ SOLO PRUEBAS (DEBUG_FORZAR_PERMISOS): simula permisos de cargue
                        // para revisar la interfaz. Revertir poniendo DEBUG_FORZAR_PERMISOS=false.
                        // No habilita cargas reales (el Geovisor revalida en el servidor).
                        if (typeof DEBUG_FORZAR_PERMISOS !== 'undefined' && DEBUG_FORZAR_PERMISOS) {
                            data = { status: true, permisos: ["CARGUE_DOCUMENTOS", "CARGUE_RECURSOS", "CARGUE_POT"] };
                        }
                        if (data.status) {
                            var first = "";
                            if (data.permisos.indexOf("CARGUE_DOCUMENTOS") != -1) {
                                if (first == "") {
                                    first = "#menuDocumentos";
                                }
                                $("#menuDocumentos").show();
                                $("#optionCargue").show();
                            }
                            if (data.permisos.indexOf("CARGUE_RECURSOS") != -1) {
                                if (first == "") {
                                    first = "#menuRecursos";
                                }
                                $("#menuRecursos").show();
                                $("#optionCargue").show();
                            }
                            if (data.permisos.indexOf("CARGUE_POT") != -1) {
                                if (first == "") {
                                    first = "#menuPot";
                                }
                                $("#menuPot").show();
                                $("#optionCargue").show();
                            }
                            $(first).addClass("active");

                            $("#panelSearch").show();
                            $("#mapViewDiv").show();

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

                        } else {
                            $.confirm({
                                title: "Cargue",
                                content: "El usuario no tiene permisos para esta funcionalidad",
                                buttons: {
                                    Ok: function () {
                                        window.location.href = "/";
                                    }
                                }
                            });
                        }
                    },
                    error: function (xhr, status, error) {
                        $.confirm({
                            title: "Cargue",
                            content: "El usuario no tiene permisos para esta funcionalidad",
                            buttons: {
                                Ok: function () {
                                    window.location.href = "/";
                                }
                            }
                        });
                    }
                });
            });
        } else {
            currentUser = null;
            currentFuncionalidades = [];
            $("#optionCargue").hide();
            $("#logoutContainer").hide();
            $("#loginContainer").show();
            $("#userName,#userName2").html("Iniciar sesion");
            $("#userPhoto,#userPhoto2").attr("src", "images/iconos/User.png");
            gotoLogin();
        }
    }, function (error) {
        console.log(error);
    });
    firebase_ui = new firebaseui.auth.AuthUI(firebase.auth());
    signIn();
    $('[data-toggle="tooltip"]').tooltip();
    $.fn.DataTable.ext.pager.numbers_length = 10;
});

function defaultUserPhoto() {
    $("#userPhoto,#userPhoto2").attr("src", "images/iconos/User.png");
}

function signIn() {
    $("#logoutContainer").hide();
    $("#loginContainer").show();

    var uiConfig = {
        callbacks: {
            signInSuccess: function (_currentUser, _credential, _redirectUrl) {
                currentUser = _currentUser;
                closeLogin();
                return false;
            }
        },
        signInOptions: [{
            provider: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
            scopes: [
                'https://www.googleapis.com/auth/plus.login'
            ],
            customParameters: {
                prompt: 'select_account'
            }
        },
        {
            provider: firebase.auth.FacebookAuthProvider.PROVIDER_ID,
            scopes: [
                'public_profile',
                'email'
            ],
            customParameters: {
                auth_type: 'reauthenticate'
            }
        },
        {
		                provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
		                requireDisplayName: true
            },
            'apple.com',
            'microsoft.com',
            'yahoo.com',
        ],
        credentialHelper: firebaseui.auth.CredentialHelper.NONE,
        signInFlow: "popup"
    };

    firebase_ui.start('#authContainer', uiConfig);
}

function signOut() {
    firebase.auth().signOut();
    $("#logoutContainer").hide();
    $("#loginContainer").show();
    $("#panelSearch").hide();
    $("#mapViewDiv").hide();
    currentUser = null;
    currentFuncionalidades = [];
    closeLogin();
}

function validate() {

}

function toggleMenu(param) {
    if (param == null) {
        if ($("#mainDiv").hasClass("main-small")) {
            param = "large";
        } else {
            param = "small";
        }
    }
    if (param == "large") {
        if ($(window).width() <= 768) {
            param = "small";
        } else {
            $("#mainDiv").removeClass("main-small");
            $("#mainDiv").addClass("main-large");
            $("#mapViewDiv").removeClass("main-small-map");
            $("#mapViewDiv").addClass("main-large-map");
            $("#headingSearch img").attr("src", "images/iconos/Back_02.png");
            $(".item-heading").removeClass("small-heading");
            $(".item-heading").addClass("large-heading");
            $("#menuItem").removeClass("small-heading");
            $("#menuItem").addClass("large-heading");
        }
    }
    if (param == "small") {
        $("#mainDiv").removeClass("main-large");
        $("#mainDiv").addClass("main-small");
        $("#mapViewDiv").removeClass("main-large-map");
        $("#mapViewDiv").addClass("main-small-map");
        $("#headingSearch img").attr("src", "images/iconos/Forward_02.png");
        $(".item-heading").removeClass("large-heading");
        $(".item-heading").addClass("small-heading");
        $("#menuItem").removeClass("large-heading");
        $("#menuItem").addClass("small-heading");
    }
    if (param == "init") {
        $("#mainDiv").removeClass("main-large");
        $("#mainDiv").addClass("main-small");
        $("#mapViewDiv").removeClass("main-large-map");
        $("#mapViewDiv").addClass("main-small-map");
        $("#headingSearch img").attr("src", "images/iconos/Forward_02.png");
        $(".item-heading").removeClass("large-heading");
        $(".item-heading").addClass("small-heading");
        $("#menuItem").removeClass("large-heading");
        $("#menuItem").addClass("small-heading");
        param = "small";
    }
    currentEstado = param;
}

function toggleFiltros(param) {
    if (param == null) {
        if ($("#searchBody").is(":visible")) {
            param = "small";
        } else {
            param = "large"
        }
    }
    if (param == "small") {
        $("#panelSearchToggle").html("<img src='images/iconos/Open_01.png' alt='Minimizar' style='width: 10px; height: 10px;' />");
        $("#searchBody").hide();
    }
    if (param == "large") {
        $("#panelSearchToggle").html("<img src='images/iconos/Close_01.png' alt='Minimizar' style='width: 10px; height: 2px;' />");
        $("#searchBody").show();
    }
}

function gotoLogin() {
    if (currentUser == null) {
        signIn();
    } else {
        $("#loginContainer").hide();
        $("#logoutContainer").show();
    }
    $("#modalLogin").modal("show");
}

function closeLogin() {
    $("#modalLogin").modal("hide");

    if (currentUser == null) {
        window.location.href = "/";
    } else {
        window.location.href = "/cargue/";
    }
}

function closeLoading() {
    $("#alertList").hide();
}

function showLoading(text, imagen, color, autohide) {
    $("#alertContent").html(text);
    if (imagen == null) {
        $("#alertContentLeft").hide();
    } else {
        if (imagen == "loading") {
            $("#alertContentLeft img").attr("src", "images/iconos/clock-face-three-oclock_1f552.png");
        }
        if (imagen == "ok") {
            $("#alertContentLeft img").attr("src", "images/iconos/thumbs-up-sign_1f44d.png");
        }
        if (imagen == "error") {
            $("#alertContentLeft img").attr("src", "images/iconos/smiling-face-with-smiling-eyes-and-hand-covering-mouth_1f92d.png");
        }
        $("#alertContentLeft").show();
    }
    $("#alertHeader").css("background-color", color);
    if (autohide) {
        setTimeout(function () { closeLoading(); }, defaultAlertTimer);
    }
    $("#alertList").show();
}

function checkURL(url, mostrarAlerta) {
    var pattern = new RegExp("((http|https)(:\/\/))?([a-zA-Z0-9]+[.]{1}){2}[a-zA-z0-9]+(\/{1}[a-zA-Z0-9]+)*\/?", "i");
    if (pattern.test(url)) {
        return true;
    } else {
        if (mostrarAlerta) {
            showLoading("La URL ingresada no es valida", null, "red", true);
        }
        return false;
    }
}

window.Clipboard = (function (window, document, navigator) {
    var textArea,
        copy;

    function isOS() {
        return navigator.userAgent.match(/ipad|iphone/i);
    }

    function createTextArea(text) {
        textArea = document.createElement('textArea');
        textArea.value = text;
        document.body.appendChild(textArea);
    }

    function selectText() {
        var range,
            selection;

        if (isOS()) {
            range = document.createRange();
            range.selectNodeContents(textArea);
            selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            textArea.setSelectionRange(0, 999999);
        } else {
            textArea.select();
        }
    }

    function copyToClipboard() {
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }

    copy = function (text) {
        createTextArea(text);
        selectText();
        copyToClipboard();
    };

    return {
        copy: copy
    };
})(window, document, navigator);

function initData(data) {
    cacheUnidades = data.UNIDAD;
    cacheUnidadesFiltro = data.UNIDAD;
    /* Documentos */
    $("#documentosETField").select2({
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
    $("#documentosETField").val(null);
    $("#documentosETField").trigger("change");
    $("#documentosETField").on("change", function (e) {
        let data = $("#documentosETField").select2("data")[0];
        if (data) {
            $("#documentosCodigoField").val(data.id);
            $("#documentosCodigoLabel").text(data.id);
            $("#documentosETLabel").text(data.text);
            $("#documentosET_Error").hide();
        }
    });
    $("#documentosEtapaField").select2({
        minimumResultsForSearch: Infinity,
        placeholder: "Seleccione una etapa del POT"
    });
    $("#documentosEtapaField").on("change", function (e) {
        if($("#documentosEtapaField")[0].value){
            optionsDocumentosNombre();
            optionsComponenteDimension();
        }
        $("#documentosDimensionDiv").hide();
        $("#documentosComponenteDiv").hide();
        $("#documentosDCLabel").hide();

        let data = $("#documentosEtapaField").select2("data")[0];
        if (data) {
            if (data.id == 'Diagnóstico') {
                $("#documentosDimensionDiv").show();
            } else if (data.id == 'Formulación') {
                $("#documentosComponenteDiv").show();
            }
            $("#documentosEtapaLabel").text(data.id)
            $("#documentosEtapa_Error").hide();
            $("#documentosComponente_Error").hide();
            $("#documentosDimension_Error").hide();
        }
    });
    $("#documentosDimensionField").select2({
        minimumResultsForSearch: Infinity,
        placeholder: "Ej: Ambiental, Funcional"
    });
    $("#documentosDimensionField").on("change", function (e) {
        if($("#documentosEtapaField")[0].value){optionsDocumentosNombre();}
        let data = $("#documentosDimensionField").select2("data")[0];
        if (data) {
            $("#documentosDC1Label").text("Dimensión");
            $("#documentosDC2Label").text(data.id);
            $("#documentosDCLabel").show();
            $("#documentosDimension_Error").hide();
        }
    });
    $("#documentosComponenteField").select2({
        minimumResultsForSearch: Infinity,
        placeholder: "Ej: Urbano, Rural, General"
    });
    $("#documentosComponenteField").on("change", function (e) {
        if($("#documentosEtapaField")[0].value){optionsDocumentosNombre();}
        let data = $("#documentosComponenteField").select2("data")[0];
        if (data) {
            $("#documentosDC1Label").text("Componente");
            $("#documentosDC2Label").text(data.id);
            $("#documentosDCLabel").show();
            $("#documentosComponente_Error").hide();
        }
    });

    $("#documentosNombreField").select2({
        minimumResultsForSearch: Infinity,
        placeholder: "Seleccione un nombre para el documento"
    });    

    $("#modalBienvenida").modal({ backdrop: 'static', keyboard: false }, "show");

    $("#documentosFormatoField").select2({
        minimumResultsForSearch: Infinity,
        placeholder: "Seleccione el formato del documento"
    });

    $("#documentosDescripcionField").summernote({
        toolbar: [
            ['style', ['bold', 'italic', 'underline', 'clear']],
            ['font', ['superscript', 'subscript']],
            ['fontsize', ['fontsize']],
            ['color', ['color']],
            ['para', ['ul', 'ol', 'paragraph']],
            ['view', ['codeview', 'undo', 'redo']],
        ],
        callbacks: {
            onChange: function(contents, $editable) {
                $("#documentosDescripcionLabel").text($($("#documentosDescripcionField").summernote("code")).text() )
            }
          }
    });

    $("#documentosFormaField").select2({
        minimumResultsForSearch: Infinity,
        placeholder: "Ej: Documento, Cartografía"
    });
    $("#documentosFormaField").on("change", function (e) {
        if ($("#documentosFormaField")[0].value) {
            optionsdocumentosEtapa();
        }
        
        let data = $("#documentosFormaField").select2("data")[0];
        if (data) {
            $("#documentosFormaLabel").text(data.id);
            $("#documentosForma_Error").hide();
        }
    })
    $('#documentosDateField').datepicker({
        language: "es",
        todayHighlight: true,
        autoclose: true,
        format: "mm/dd/yyyy"
    });
    $("#documentosCategoriaField").select2({
        minimumResultsForSearch: Infinity,
        placeholder: "Ej: Economía, Mapas e imágenes"
    });
    $("#documentosCategoriaField").on("change", function (e) {
        let data = $("#documentosCategoriaField").select2("data")[0];
        if (data) {
            $("#documentosCategoriaLabel").text(data.id);
            $("#documentosCategoria_Error").hide();
        }
    })
    $("#documentosLicenciaField").select2({
        minimumResultsForSearch: Infinity,
        placeholder: "Seleccione el tipo de licencia"
    });
    $("#documentosLicenciaField").on("change", function (e) {
        let data = $("#documentosLicenciaField").select2("data")[0];
        if (data) {
            $("#documentosLicenciaLabel").text(data.id);
        }
    });
    $("#documentosKeywordsField").select2({
        data: data.TAGS,
        minimumResultsForSearch: Infinity,
        multiple: true,
        placeholder: "Ej: ambiental, educación",
        templateSelection: function (data) {
            return $("<span class='class-tag' item-tag='" + data.text + "'>" + data.text + "</span>");
        }
    });
    $("#documentosKeywordsField").on("change", function (e) {
        let data = $("#documentosKeywordsField").select2("data");
        if (data) {
            let tags = [];
            for (let idx = 0; idx < data.length; idx++) {
                tags.push(data[idx].id);
            }
            $("#documentosKeywordsLabel").text(tags.join("; "));
            $("#documentosKeywords_Error").hide();
        }
    })
    $("#documentosTipoField").select2({
        minimumResultsForSearch: Infinity,
        placeholder: "Seleccione el tipo de documento"
    });
    $("#documentosTipoField").on("change", function (e) {
        let data = $("#documentosTipoField").select2("data")[0];
        if (data) {
            $("#documentosTipoLabel").text(data.id);
        }
    });
    $("#documentosIdiomaField").select2({
        minimumResultsForSearch: Infinity,
        placeholder: "Seleccione el idioma del documento"
    });
    $("#documentosIdiomaField").on("change", function (e) {
        let data = $("#documentosIdiomaField").select2("data")[0];
        if (data) {
            $("#documentosIdiomaLabel").text(data.id);
        }
    });

    $("#documentosNombreField").on("change", function (e) {
        if ($("#documentosNombreField")[0].value == "OTRO") {
            $("#documentosDescripcionDiv").show();
        }else{
            $("#documentosDescripcionDiv").hide();
        }
        $("#documentosNombreLabel").text($("#documentosNombreField").val());
        $("#documentosNombre_Error").hide();
    })
    $("#documentosVersionField").on("change", function (e) {
        $("#documentosVersionLabel").text($("#documentosVersionField").val())
    })
    $("#documentosFormatoField").on("change", function (e) {
        $("#documentosFormatoLabel").text($("#documentosFormatoField").val());
        $("#documentosFormato_Error").hide();
    })
    $("#documentosDateField").on("change", function (e) {
        $("#documentosDateLabel").text($("#documentosDateField").val());
        $("#documentosDate_Error").hide();
    })
    $("#documentosResponsableField").on("change", function (e) {
        $("#documentosResponsableLabel").text($("#documentosResponsableField").val());
        $("#documentosResponsable_Error").hide();
    })
    $("#documentosURLResponsableField").on("change", function (e) {
        $("#documentosUrlResponsableLabel").text($("#documentosURLResponsableField").val());
        $("#documentosURLResponsable_Error").hide();
    })

    /* Recursos */
    $("#recursosDescripcionField").summernote({
        toolbar: [
            ['style', ['bold', 'italic', 'underline', 'clear']],
            ['font', ['superscript', 'subscript']],
            ['fontsize', ['fontsize']],
            ['color', ['color']],
            ['para', ['ul', 'ol', 'paragraph']],
            ['view', ['codeview', 'undo', 'redo']],
        ]
    });
    $("#recursosTematicaField,#recursosTematica2Field").select2({
        language: "es",
        ajax: {
            url: web_service + "/cargueRecursos?cmd=query_tematicas&token=" + currentAccessToken + "&t=" + (new Date()).getTime(),
            dataType: "json",
            type: "GET",
            data: function (params) {
                var queryParameters = {
                    query: params.term
                }
                return queryParameters;
            },
            processResults: function (data) {
                return {
                    results: $.map(data.tematicas, function (item) {
                        return {
                            text: item.NOMBRE,
                            id: item.ID_TEMATICA
                        }
                    })
                };
            }
        }
    });
    $("#recursosEntidadField").select2({
        language: "es",
        ajax: {
            url: web_service + "/cargueRecursos?cmd=query_entidades&token=" + currentAccessToken + "&t=" + (new Date()).getTime(),
            dataType: "json",
            type: "GET",
            data: function (params) {
                var queryParameters = {
                    query: params.term
                }
                return queryParameters;
            },
            processResults: function (data) {
                return {
                    results: $.map(data.entidades, function (item) {
                        return {
                            text: item.NOMBRE,
                            id: item.ID_ENTIDAD
                        }
                    })
                };
            }
        }
    });
    $("#recursosCodigoField").select2({
        minimumInputLength: 2,
        language: "es",
        ajax: {
            url: web_service + "/cargueRecursos?cmd=query_codigos&token=" + currentAccessToken + "&t=" + (new Date()).getTime(),
            dataType: "json",
            type: "GET",
            data: function (params) {
                var queryParameters = {
                    query: params.term
                }
                return queryParameters;
            },
            processResults: function (data) {
                return {
                    results: $.map(data.unidades, function (item) {
                        return {
                            text: item.CODIGO + " - " + item.NOMBRE,
                            id: item.CODIGO
                        }
                    })
                };
            }
        }
    });
    $("#recursosTipoField").select2({
        minimumResultsForSearch: Infinity
    });
    $("#recursosNivelField").select2({
        minimumResultsForSearch: Infinity
    });
    $('#recursosDateField').datepicker({
        language: "es",
        todayHighlight: true,
        autoclose: true,
        format: "mm/dd/yyyy"
    });
    $("#recursosTipoField").select2({
        minimumResultsForSearch: Infinity
    });

    tableRecursos = $("#tableRecursos").DataTable({
        language: spanishDataTable,
        processing: true,
        serverSide: true,
        ajax: {
            url: web_service + "/cargueRecursos",
            data: function (d) {
                d.cmd = "list";
                d.token = currentAccessToken;
                d.t = (new Date()).getTime();
            },
            dataSrc: 'recursos'
        },
        columns: [
            { data: "ID_RECURSO" },
            { data: "NOMBRE" },
            { data: "TIPO_RECURSO" },
            { data: "NIVEL" },
            {
                data: "FECHA_PUBLICACION",
                render: function (data, type, row, meta) {
                    if (data == null) {
                        return "";
                    }
                    return moment(data).format("YYYY-MM-DD");
                }
            },
            {
                data: "ID_RECURSO",
                sortable: false,
                render: function (data, type, row, meta) {
                    var strHTML = "";
                    strHTML = strHTML + "";
                    if (row.ESTADO == "PENDIENTE") {
                        strHTML = strHTML + "<img src='images/Dot_Yellow.png' style='width: 15px; height: 15px;' />";
                    }
                    if (row.ESTADO == "APROBADO") {
                        strHTML = strHTML + "<img src='images/Dot_Green.png' style='width: 15px; height: 15px;' />";
                    }
                    if (row.ESTADO == "RECHAZADO") {
                        strHTML = strHTML + "<img src='images/Dot_Red.png' style='width: 15px; height: 15px;' />";
                    }
                    strHTML = strHTML + "&nbsp;<a href='#' onclick='detailRecursos(" + data + ")'><span class='glyphicon glyphicon-edit' aria-hidden='true'></span></a>";
                    return strHTML;
                }
            }
        ]
    });

    $("#filterUnidadIGAC").select2({
        data: cacheUnidadesFiltro,
        multiple: false,
        placeholder: "Ej: Colombia",
        query: function (query) {
            if ((query.term == null) || (query.term == "")) {
                query.callback({ results: cacheUnidadesFiltro });
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
                query.callback({ results: results });
            }
        },
        templateResult: function (data) {
            if (!data.type) {
                return data.text;
            }
            return $("<span class='" + data.type + "'>" + data.text + "</span>");
        }
    });
    $("#filterUnidadIGAC").val(null);
    $("#filterUnidadIGAC").trigger("change");
    $("#filterUnidadIGAC").on("change", function (e) {
        updateDocsIGAC();
    });

    $("#filterEtapaIGAC").select2({
        allowClear: true,
        minimumResultsForSearch: Infinity,
        placeholder: "Etapa"
    });
    $("#filterEtapaIGAC").val(null);
    $("#filterEtapaIGAC").trigger("change");
    $("#filterEtapaIGAC").on("change", function (e) {
        updateDocsIGAC();
    });

    $.ajax({
        url: web_service + "/documentos?cmd=filtro_annio&t=" + (new Date()).getTime(),
        type: 'GET',
        dataType: 'json',
        success: function (data) {
            if (data.status) {
                $("#filterYearIGAC").select2({
                    data: data.FECHA,
                    allowClear: true,
                    minimumResultsForSearch: Infinity,
                    placeholder: "Año"
                });
                $("#filterYearIGAC").val(null);
                $("#filterYearIGAC").trigger("change");
                $("#filterYearIGAC").on("change", function (e) {
                    updateDocsIGAC();
                });

            } else {
                //
            }
        },
        error: function (xhr, status, error) {
            //
        }
    });

    updateDocs();
    updateDocsIGAC();
}

function hideAll() {
    $("#documentosDiv,#recursosDiv,#potDiv").hide();
    $("#menuDocumentos,#menuXTF,#menuRecursos").removeClass("active");
}

function changeLenDocs(pages){
    tableDocumentosIGAC.page.len( pages ).draw();
}

/* Documentos IGAC */

function updateDocsIGAC(){

    if (tableDocumentosIGAC == null) {
        tableDocumentosIGAC = $("#tableDocumentosIGAC").DataTable({
            language: spanishDataTable,
            lengthMenu: [[25, 50, 100], ["Mostrar 25 registros", "Mostrar 50 registros", "Mostrar 100 registros"]],
            processing: true,
            serverSide: true,
            ajax: {
                url: web_service + "/documentos",
                deferLoading: 0,
                data: function (d) {
                    d.cmd = "query";
                    d.t = (new Date()).getTime();

                    if (($("#filterUnidadIGAC").val() != null) && (($("#filterUnidadIGAC").select2("data")[0].type == "DEPTO") || ($("#filterUnidadIGAC").select2("data")[0].type == "MUNI"))) {
                        d.codigo = $("#filterUnidadIGAC").val();
                    }
                    if ($("#filterEtapaIGAC").val() != null && $("#filterEtapaIGAC").val() != "Todas") {
                        d.etapa = $("#filterEtapaIGAC").val();
                    }
                    if ($("#filterYearIGAC").val() != null) {
                        d.year = $("#filterYearIGAC").val();
                    }
                },
                dataSrc: 'documentos'
            },
            drawCallback: function (settings) {
                updateRowsIGAC();
            },
            columns: [
                { data: "ID_DOCUMENTO" },
                { data: "NOMBRE" },
                { data: "UNIDAD" },
                { data: "ETAPA" },
                {
                    data: "FECHA_PUBLICACION",
                    render: function (data, type, row, meta) {
                        if (data == null) {
                            return "";
                        }
                        return moment(data).format("YYYY-MM-DD");
                    }
                },
                {
                    data: "ID_DOCUMENTO",
                    sortable: false,
                    render: function (data, type, row, meta) {
                        var strHTML = "";
                        strHTML = "<a href='#' onclick='detailDocumentosIGAC(" + data + ")'><span class='glyphicon glyphicon-edit' aria-hidden='true'></span></a>";
                        return strHTML;
                    }
                }
            ]
        });
    } else {
        tableDocumentosIGAC.ajax.reload();
    }
}

function changeLenDocsIGAC(pages){
    tableDocumentosIGAC.page.len( pages ).draw();
}

function updateRowsIGAC() {
    $("#docViewCountIGAC").html(tableDocumentosIGAC.page.info().recordsTotal + " resultados");
}

function detailDocumentosIGAC(id) {
    const currentDocsIGAC = tableDocumentosIGAC.rows({ page: 'current' }).data();
    for (let idx = 0; idx < currentDocsIGAC.length; idx++) {
        if (currentDocsIGAC[idx].ID_DOCUMENTO == id) {
            limpiarFormDocs();
            detailDocs(currentDocsIGAC[idx]);
        }
    }
}

/* Documentos */
function updateDocs(){
    if (tableDocumentos == null) {
        tableDocumentos = $("#tableDocumentos").DataTable({
            language: spanishDataTable,
            lengthMenu: [[25, 50, 100], ["Mostrar 25 registros", "Mostrar 50 registros", "Mostrar 100 registros"]],
            processing: true,
            serverSide: true,
            ajax: {
                url: web_service + "/cargueDocumentos",
                data: function (d) {
                    d.cmd = "list";
                    d.token = currentAccessToken;
                    d.t = (new Date()).getTime();
                },
                dataSrc: 'documentos'
            },
            drawCallback: function (settings) {
                updateRows();
            },
            columns: [
                { data: "ID_DOCUMENTO" },
                { data: "NOMBRE" },
                { data: "UNIDAD" },
                { data: "ETAPA" },
                {
                    data: "ESTADO",
                    render: function (data, type, row, meta) {
                        var strHTML = "";
                        if (row.ESTADO == "PENDIENTE") {
                            strHTML = strHTML + "<span class='documentoEstado documentoEstadoPendiente'>En revisión</span>";
                        }
                        if (row.ESTADO == "APROBADO") {
                            strHTML = strHTML + "<span class='documentoEstado documentoEstadoAprobado'>Aprobado</span>";
                        }
                        if (row.ESTADO == "RECHAZADO") {
                            strHTML = strHTML + "<span class='documentoEstado documentoEstadoRechazado'>Rechazado</span>";
                        }
                        return strHTML;
                    }
                },
                {
                    data: "FECHA_PUBLICACION",
                    render: function (data, type, row, meta) {
                        if (data == null) {
                            return "";
                        }
                        return moment(data).format("YYYY-MM-DD");
                    }
                },
                {
                    data: "ID_DOCUMENTO",
                    sortable: false,
                    render: function (data, type, row, meta) {
                        var strHTML = "";
                        strHTML = "<a href='#' onclick='detailDocumentos(" + data + ")'><span class='glyphicon glyphicon-edit' aria-hidden='true'></span></a>";
                        return strHTML;
                    }
                }
            ]
        });
    } else {
        tableDocumentos.ajax.reload();
    }
}

function changeLenDocs(pages){
    tableDocumentos.page.len( pages ).draw();
}

function updateRows() {
    $("#docViewCount").html(tableDocumentos.page.info().recordsTotal + " resultados");
}

function gotoDocumentos() {
    currentUser.getIdToken().then(function (accessToken) {
        currentAccessToken = accessToken;
    });
    hideAll();
    $("#mainDiv").removeClass("detallesDocumentos");
    $("#mainDiv").addClass("resumenDocumentos");

    $("#documentosDiv").show();
    $("#documentosDiv").removeClass("col-md-8");
    $("#documentosDiv").addClass("col-md-12");
    $("#instruccionesDiv").hide();
    $("#menuDocumentos").addClass("active");
    $("#documentosDetail").hide();
    $("#documentosList").show();
    tableDocumentos.ajax.reload();
    tableDocumentosIGAC.ajax.reload();

    $("#listOpciones").show();
    $("#listDocumentosPasos").hide();
}

function newDocumentos() {

    showDocumentosPasos();

    $("#mainDiv").removeClass("resumenDocumentos");
    $("#mainDiv").addClass("detallesDocumentos");

    $("#documentosList").hide();
    $("#documentosDiv").removeClass("col-md-12");
    $("#documentosDiv").addClass("col-md-8");
    $("#instruccionesDiv").show();
    $("#documentosDetail").show();
    $("#documentosDetailHeader").html("Nuevo documento");
    $("#btnDocumentosBorrar").hide();

    $("#documentosIdFieldDiv").hide();
    // $("#documentosURLFieldDiv").hide();

    currentDocumento = null;

    $("#documentosIdField").val("");
    // $("#documentosURLField").val("");
    $("#documentosFileField").val("");
    $("#documentosFileField").show();
    $("#documentosFileResult").hide();
    $("#documentosFileResult").html("");
    $("#documentosDocCargadoLabel").hide();
    $("#documentosDocCargadoLabel").html("");

    $("#documentosETField").val("").trigger("change");
    $("#documentosEtapaField").val("").trigger("change");
    $("#documentosDimensionField").val("").trigger("change");
    $("#documentosComponenteField").val("").trigger("change");
    $("#documentosFormaField").val("").trigger("change");
    $("#documentosCategoriaField").val("").trigger("change");
    $("#documentosKeywordsField").val("").trigger("change");
    $("#documentosLicenciaField").val("").trigger("change");
    $("#documentosTipoField").val("").trigger("change");
    $("#documentosIdiomaField").val("").trigger("change");
    $("#documentosCodigoField").val("");
    $("#documentosNombreField").val("");
    $("#documentosVersionField").val("");
    $("#documentosFormatoField").val("");
    $("#documentosResponsableField").val("");
    $("#documentosURLResponsableField").val("");

    $("#documentosDateField").val("");
    $("#documentosDateField").datepicker("update", "");
    $("#documentosDescripcionField").summernote("reset");

    $("#documentosETLabel").html("");
    $("#documentosCodigoLabel").html("");
    $("#documentosEtapaLabel").html("");
    $("#documentosDCLabel").hide();
    $("#documentosDC1Label").html("");
    $("#documentosDC2Label").html("");
    $("#documentosNombreLabel").html("");
    $("#documentosVersionLabel").html("");
    $("#documentosDescripcionLabel").html("");
    $("#documentosFormaLabel").html("");
    $("#documentosFormatoLabel").html("");
    $("#documentosDateLabel").html("");
    $("#documentosCategoriaLabel").html("");
    $("#documentosKeywordsLabel").html("");
    $("#documentosResponsableLabel").html("");
    $("#documentosUrlResponsableLabel").html("");
    $("#documentosLicenciaLabel").html("");
    $("#documentosTipoLabel").html("");
    $("#documentosIdiomaLabel").html("");
    $("#documentosObservacionesLabel").html("");
    // $("#documentosDocCargadoLabel").html("");

    $("#documentosET_Error").hide();
    $("#documentosEtapa_Error").hide();
    $("#documentosComponente_Error").hide();
    $("#documentosDimension_Error").hide();
    $("#documentosNombre_Error").hide();
    $("#documentosForma_Error").hide();
    $("#documentosFormato_Error").hide();
    $("#documentosDate_Error").hide();
    $("#documentosCategoria_Error").hide();
    $("#documentosKeywords_Error").hide();
    $("#documentosResponsable_Error").hide();
    $("#documentosUrlResponsable_Error").hide();
    $("#documentosFile_Error").html("");
}

//Cambiar las opciones de los campos Etapa, dimension o Componente y Nombre Documento

function optionsdocumentosEtapa() {
  const documentosEtapa = document.getElementById("documentosEtapaField");
  documentosEtapa.innerHTML = "";
  function formatValue(text) {
    text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    text = text.replace(/\s/g, "");
    text = text.replace(/-/g, "");
    text = text.toLowerCase();
    return text;
  }
  documentosEtapa.appendChild(document.createElement("option"));
  const options =
    window.namesDocument[formatValue($("#documentosFormaField")[0].value)];
    
  for (const option in options) {
    if (Object.hasOwnProperty.call(options, option)) {
      const element = options[option];
      const optionElement = document.createElement("option");
      optionElement.text = element.label;
      documentosEtapa.appendChild(optionElement);
    }
  }
}

function optionsComponenteDimension(){
    
    function formatValue(text) {
        text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        text = text.replace(/\s/g, "");
        text = text.replace(/-/g, "");
        text = text.toLowerCase();
        return text;
      }
let options = {};
    if (formatValue($("#documentosEtapaField")[0].value) == "diagnostico") {
const documentosDimension = document.getElementById("documentosDimensionField");
documentosDimension.innerHTML = "";
            options = window.namesDocument[formatValue($("#documentosFormaField")[0].value)][formatValue($("#documentosEtapaField")[0].value)].items;
            documentosDimension.appendChild(document.createElement("option"));
              for (const option in options) {
    if (Object.hasOwnProperty.call(options, option)) {
      const element = options[option];
      const optionElement = document.createElement("option");
      optionElement.text = element.label;
      documentosDimension.appendChild(optionElement);
    }
  }
            }else if(formatValue($("#documentosEtapaField")[0].value) == "formulacion"){
                const documentosComponente = document.getElementById("documentosComponenteField");
                documentosComponente.innerHTML = "";
                             options = window.namesDocument[formatValue($("#documentosFormaField")[0].value)][formatValue($("#documentosEtapaField")[0].value)].items;
                             documentosComponente.appendChild(document.createElement("option"));
                              for (const option in options) {
                    if (Object.hasOwnProperty.call(options, option)) {
                      const element = options[option];
                      const optionElement = document.createElement("option");
                      optionElement.text = element.label;
                      documentosComponente.appendChild(optionElement);
                    }
                  }
            }
}

function optionsDocumentosNombre(){
    const documentosNombre = document.getElementById("documentosNombreField");
    documentosNombre.innerHTML = "";
    function formatValue(text) {
      text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      text = text.replace(/\s/g, "");
      text = text.replace(/-/g, "");
      text = text.toLowerCase();
      return text;
    }
    if ($("#documentosComponenteField")[0].value && formatValue($("#documentosEtapaField")[0].value) == "formulacion") {
       
      const options =
        window.namesDocument[formatValue($("#documentosFormaField")[0].value)][
          formatValue($("#documentosEtapaField")[0].value)
        ].items[formatValue($("#documentosComponenteField")[0].value)].items;
      changeOptions(options);
    } else if ($("#documentosDimensionField")[0].value && formatValue($("#documentosEtapaField")[0].value) == "diagnostico") {


      const options =
        window.namesDocument[formatValue($("#documentosFormaField")[0].value)][
          formatValue($("#documentosEtapaField")[0].value)].items[formatValue($("#documentosDimensionField")[0].value)].items;
      changeOptions(options);
    } else if (
      formatValue($("#documentosEtapaField")[0].value) == "implementacion" ||
      formatValue($("#documentosEtapaField")[0].value) ==
        "evaluacionyseguimiento"
    ) {
      const options =
        window.namesDocument[formatValue($("#documentosFormaField")[0].value)][
          formatValue($("#documentosEtapaField")[0].value)].items;
      changeOptions(options);
    }

    function changeOptions(options) {
        documentosNombre.appendChild(document.createElement("option"));
      for (const option in options) {
        if (Object.hasOwnProperty.call(options, option)) {
          const element = options[option];
          const optionElement = document.createElement("option");
          optionElement.text = element;
          documentosNombre.appendChild(optionElement);
        }
      }
    }

    
}

function detailDocumentos(id) {
    currentDocumento = id;
    $.ajax({
        url: web_service + "/cargueDocumentos?cmd=get&ID_DOCUMENTO=" + currentDocumento + "&token=" + currentAccessToken + "&t=" + (new Date()).getTime(),
        type: 'GET',
        dataType: 'json',
        success: function (data) {
            if (data.status) {
                if (!(data.documentos.length > 0)) {
                    return;
                }

                limpiarFormDocs();
                detailDocs(data.documentos[0]);
            } else {
                $.alert("Operaci&oacute;n fallida.");
            }
        },
        error: function (xhr, status, error) {
            $.alert("Operaci&oacute;n fallida.");
        }
    });
}

function detailDocs(documento) {
    $("#documentosIdFieldDiv").show();
    // $("#documentosURLFieldDiv").hide();
    $("#documentosFileField").show();

    $("#documentosIdField").val(documento.ID_DOCUMENTO);
    // $("#documentosURLField").val(documento.URL);
    $("#documentosETField").val(documento.CODIGO_UNIDAD || documento.CODIGO);
    $("#documentosETField").trigger("change");
    $("#documentosEtapaField").val(documento.ETAPA);
    $("#documentosEtapaField").trigger("change");
    $("#documentosDimensionField").val(documento.DIMENSION);
    $("#documentosDimensionField").trigger("change");
    $("#documentosComponenteField").val(documento.COMPONENTE);
    $("#documentosComponenteField").trigger("change");
    $("#documentosFormaField").val(documento.FORMA_REPRESENTACION);
    $("#documentosFormaField").trigger("change");
    $("#documentosCategoriaField").val(documento.CATEGORIA_TEMATICA);
    $("#documentosCategoriaField").trigger("change");

    if (documento.PALABRAS_CLAVE != null) {
        let tags = JSON.parse(documento.PALABRAS_CLAVE);
        $("#documentosKeywordsField").val(tags);
        $("#documentosKeywordsField").trigger("change");
    }

    $("#documentosLicenciaField").val(documento.LICENCIA);
    $("#documentosLicenciaField").trigger("change");
    $("#documentosTipoField").val(documento.TIPO_DOCUMENTO);
    $("#documentosTipoField").trigger("change");
    $("#documentosIdiomaField").val(documento.IDIOMA);
    $("#documentosIdiomaField").trigger("change");

    $("#documentosCodigoField").val(documento.CODIGO_UNIDAD);
    $("#documentosCodigoField").trigger("change");
    $("#documentosNombreField").val(documento.NOMBRE);
    $("#documentosNombreField").trigger("change");
    $("#documentosVersionField").val(documento.VERSION);
    $("#documentosVersionField").trigger("change");
    $("#documentosFormatoField").val(documento.FORMATO);
    $("#documentosFormatoField").trigger("change");
    $("#documentosResponsableField").val(documento.RESPONSABLE);
    $("#documentosResponsableField").trigger("change");
    $("#documentosURLResponsableField").val(documento.URL_RESPONSABLE);
    $("#documentosURLResponsableField").trigger("change");

    $("#documentosDateField").datepicker("update", new Date(documento.FECHA_PUBLICACION));
    $("#documentosDateField").trigger("change");
    $("#documentosDescripcionField").summernote("reset");
    $("#documentosDescripcionField").summernote("code", documento.RESUMEN);
    $("#documentosDescripcionField").trigger("change");

    DocumentosPasosHide();
    $("#documentosPaso4").show();

    $("#listDocumentosPasos li a").hide();
    $("#listDocumentosPasos li a").last().addClass('active').show();

    $("#btnDocumentosPasoPrev").hide();
    $("#btnDocumentosPasoNext").hide();
    $("#btnDocumentosGuardar").hide();
    $("#btnDocumentosCrear").hide();

    if (documento.ESTADO == 'PENDIENTE') {
        $("#btnDocumentosBorrar").show();
    } else if (documento.ESTADO == 'RECHAZADO') {
        $("#documentosObservacionesLabel").text(documento.OBSERVACION);
        $("#documentosObservaciones").show();
        $("#btnDocumentosDuplicar").show();
        $("#btnDocumentosCrear").show();
    }
}

function downloadDocumento() {
    if (currentUser == null) {
        showLoading("Para generar descargar archivos, debes iniciar la sesi&oacute;n", null, "red", true);
        gotoLogin();
        return;
    }
    showLoading("Descargando archivo", "loading", "gold", false);
    currentUser.getIdToken().then(function (currentAccessToken) {
        $.ajax({
            url: web_service + "/descargas?cmd=request&tipo=documento_user&id=" + currentDocumento + "&token=" + currentAccessToken,
            success: function (data) {
                if (data.status) {
                    closeLoading();
                    var link = document.createElement('a');
                    link.href = web_service + "/descargas?cmd=download&token=" + data.token;
                    link.target = '_blank';
                    link.click();
                } else {
                    showLoading("El archivo no se encuentra disponible para descarga", null, "red", true);
                }
            },
            error: function (_data) {
                showLoading("El archivo no se encuentra disponible para descarga", null, "red", true);
            }
        });
    }).catch(function (_error) {
        showLoading("El archivo no se encuentra disponible para descarga", null, "red", true);
    });
}

function salvarDocumentos() {
    var params = "";
    var formData = new FormData($("#documentosFileFieldData")[0]);
    formData.append("file", $("#documentosFileField")[0].files[0]);
    params = params + "&FILENAME=" + $("#documentosFileField").val().split('/').pop().split('\\').pop();

    // if (($("#documentosURLField").val() != null) && ($("#documentosURLField").val() != "")) {
    //     params = params + "&URL=" + encodeURI($("#documentosURLField").val());
    // }

    if (($("#documentosCodigoField").val() != null) && ($("#documentosCodigoField").val() != "")) {
        params = params + "&CODIGO=" + $("#documentosCodigoField").val();
    }
    if (($("#documentosEtapaField").val() != null) && ($("#documentosEtapaField").val() != "")) {
        params = params + "&ETAPA=" + $("#documentosEtapaField").val();
    }
    if (($("#documentosDimensionField").val() != null) && ($("#documentosDimensionField").val() != "")) {
        params = params + "&DIMENSION=" + $("#documentosDimensionField").val();
    }
    if (($("#documentosComponenteField").val() != null) && ($("#documentosComponenteField").val() != "")) {
        params = params + "&COMPONENTE=" + $("#documentosComponenteField").val();
    }
    if (($("#documentosFormaField").val() != null) && ($("#documentosFormaField").val() != "")) {
        params = params + "&FORMA_REPRESENTACION=" + $("#documentosFormaField").val();
    }
    if (($("#documentosCategoriaField").val() != null) && ($("#documentosCategoriaField").val() != "")) {
        params = params + "&CATEGORIA_TEMATICA=" + $("#documentosCategoriaField").val();
    }
    if (($("#documentosKeywordsField").val() != null) && ($("#documentosKeywordsField").val() != "")) {
        let data = $("#documentosKeywordsField").select2("data");
        if (data) {
            let tags = [];
            for (let idx = 0; idx < data.length; idx++) {
                tags.push(data[idx].id);
            }
            $("#documentosKeywordsLabel").text(tags.join("; "));
            params = params + "&PALABRAS_CLAVE=" + JSON.stringify(tags);
        }
    }
    if (($("#documentosLicenciaField").val() != null) && ($("#documentosLicenciaField").val() != "")) {
        params = params + "&LICENCIA=" + $("#documentosLicenciaField").val();
    }
    if (($("#documentosTipoField").val() != null) && ($("#documentosTipoField").val() != "")) {
        params = params + "&TIPO_DOCUMENTO=" + $("#documentosTipoField").val();
    }
    if (($("#documentosIdiomaField").val() != null) && ($("#documentosIdiomaField").val() != "")) {
        params = params + "&IDIOMA=" + $("#documentosIdiomaField").val();
    }

    params = params + "&NOMBRE=" + $("#documentosNombreField").val();
    // if (($("#documentosVersionField").val() != null) && ($("#documentosVersionField").val() != "")) {
    //     params = params + "&VERSION=" + $("#documentosVersionField").val();
    // }
    if (($("#documentosFormatoField").val() != null) && ($("#documentosFormatoField").val() != "")) {
        params = params + "&FORMATO=" + $("#documentosFormatoField").val();
    }
    if (($("#documentosResponsableField").val() != null) && ($("#documentosResponsableField").val() != "")) {
        params = params + "&RESPONSABLE=" + $("#documentosResponsableField").val();
    }
    if (($("#documentosURLResponsableField").val() != null) && ($("#documentosURLResponsableField").val() != "")) {
        params = params + "&URL_RESPONSABLE=" + encodeURI($("#documentosURLResponsableField").val());
    }

    if (($("#documentosDateField").val() != null) && ($("#documentosDateField").val() != "")) {
        params = params + "&FECHA_PUBLICACION=" + moment($("#documentosDateField").val()).format("YYYY-MM-DD");
    }
    if (($("#documentosDescripcionField").summernote("code") != null) && ($("#documentosDescripcionField").summernote("code") != "")) {
        params = params + "&RESUMEN=" + b64EncodeUnicode($("#documentosDescripcionField").summernote("code").replaceAll("</p><p>", "<br/>").replaceAll("<br></p>", "").replaceAll("<p>", ""));
    }

    params = params + "&token=" + currentAccessToken;
    if (currentDocumento == null) {
        params = params + "&cmd=create";
        params = params + "&t=" + (new Date()).getTime();
        $.confirm({
            title: "Nuevo documento",
            content: function () {
                var self = this;
                return $.ajax({
                    url: web_service + "/cargueDocumentos?" + params,
                    type: "POST",
                    data: formData,
                    cache: false,
                    contentType: false,
                    processData: false
                }).done(function (response) {
                    if (response.status) {
                        self.setContent("Operaci&oacute;n exitosa.");
                    } else {
                        self.setContent("Operaci&oacute;n fallida. Intente m&aacute;s tarde.");
                    };
                }).fail(function (error) {
                    self.setContent("Operaci&oacute;n fallida. Intente m&aacute;s tarde.");
                });
            },
            buttons: {
                Ok: function () {
                    gotoDocumentos();
                }
            }
        });
    } else {
        params = params + "&cmd=update";
        params = params + "&ID_DOCUMENTO=" + currentDocumento;
        params = params + "&t=" + (new Date()).getTime();
        $.confirm({
            title: "Actualizar documento",
            content: function () {
                var self = this;
                return $.ajax({
                    url: web_service + "/cargueDocumentos?" + params,
                    type: "POST",
                    data: formData,
                    cache: false,
                    contentType: false,
                    processData: false,
                    // dataType: "json"
                }).done(function (response) {
                    if (response.status) {
                        self.setContent("Operaci&oacute;n exitosa.");
                    } else {
                        self.setContent("Operaci&oacute;n fallida. Intente m&aacute;s tarde.");
                    };
                }).fail(function () {
                    self.setContent("Operaci&oacute;n fallida. Intente m&aacute;s tarde.");
                });
            },
            buttons: {
                Ok: function () {
                    gotoDocumentos();
                }
            }
        });
    }
}

function borrarDocumentos() {
    $.confirm({
        title: "Eliminar documento",
        content: 'Esta seguro de eliminar este documento?',
        buttons: {
            Si: function () {
                $.ajax({
                    url: web_service + "/cargueDocumentos?cmd=delete&ID_DOCUMENTO=" + currentDocumento + "&token=" + currentAccessToken + "&t=" + (new Date()).getTime(),
                    type: 'GET',
                    dataType: 'json',
                    success: function (data) {
                        if (data.status) {
                            $.confirm({
                                title: "Eliminar documento",
                                content: "Operaci&oacute;n exitosa",
                                buttons: {
                                    Ok: function () {
                                        gotoDocumentos();
                                    }
                                }
                            });
                        } else {
                            $.alert("Operaci&oacute;n fallida.");
                        };
                    },
                    error: function (xhr, status, error) {
                        $.alert("Operaci&oacute;n fallida.");
                    }
                })
            },
            No: function () {

            },
        }
    });
}

function crearDocumentos(){
    currentDocumento = null;
    $("#documentosIdField").val("");
    $("#documentosIdFieldDiv").hide();
    $("#documentosFileField").val("");
    $("#documentosFileResult").html("");
    $("#documentosFileResult").hide();
    $("#documentosDocCargadoLabel").hide();
    $("#documentosObservaciones").hide();
    $("#btnDocumentosCrear").hide();
    $("#btnDocumentosGuardar").show();
    showDocumentosPasos();
}

function validarDocumento(){
    let pasoIr = null, pasoTemp = null;

    let pasoActual = 1;

    // ENTIDAD TERRITORIAL
    pasoTemp = validarDocumentoSelect("documentosETField", "documentosET_Error", pasoActual)
    pasoIr = validarDocumentoPaso(pasoIr, pasoTemp);

    // ETAPA
    pasoTemp = validarDocumentoSelect("documentosEtapaField", "documentosEtapa_Error", pasoActual)
    pasoIr = validarDocumentoPaso(pasoIr, pasoTemp);

    // FORMULACION - DIAGNOSTICO
    let dataEtapa = $("#documentosEtapaField").select2("data")[0];
    if (dataEtapa != undefined && dataEtapa.id == "Formulación") {
        pasoTemp = validarDocumentoSelect("documentosComponenteField", "documentosComponente_Error", pasoActual)
        pasoIr = validarDocumentoPaso(pasoIr, pasoTemp);
    } else if (dataEtapa != undefined && dataEtapa.id == "Diagnóstico") {
        pasoTemp = validarDocumentoSelect("documentosDimensionField", "documentosDimension_Error", pasoActual)
        pasoIr = validarDocumentoPaso(pasoIr, pasoTemp);
    }

    // NOMBRE
    pasoTemp = validarDocumentoTexto("documentosNombreField", "documentosNombre_Error", pasoActual);
    pasoIr = validarDocumentoPaso(pasoIr, pasoTemp);

    pasoActual = 2;

    // FORMA
    pasoTemp = validarDocumentoSelect("documentosFormaField", "documentosForma_Error", pasoActual)
    pasoIr = validarDocumentoPaso(pasoIr, pasoTemp);

    // FORMATO
    pasoTemp = validarDocumentoTexto("documentosFormatoField", "documentosFormato_Error", pasoActual);
    pasoIr = validarDocumentoPaso(pasoIr, pasoTemp);

    // FECHA
    pasoTemp = validarDocumentoTexto("documentosDateField", "documentosDate_Error", pasoActual);
    pasoIr = validarDocumentoPaso(pasoIr, pasoTemp);

    // CATEGORIA
/*     pasoTemp = validarDocumentoSelect("documentosCategoriaField", "documentosCategoria_Error", pasoActual)
    pasoIr = validarDocumentoPaso(pasoIr, pasoTemp); */

    // PALABRAS CLAVE
    pasoTemp = validarDocumentoSelect("documentosKeywordsField", "documentosKeywords_Error", pasoActual)
    pasoIr = validarDocumentoPaso(pasoIr, pasoTemp);

    pasoActual = 3;

    // RESPONSABLE
    pasoTemp = validarDocumentoTexto("documentosResponsableField", "documentosResponsable_Error", pasoActual);
    pasoIr = validarDocumentoPaso(pasoIr, pasoTemp);

    // URL RESPONSABLE
    let url = $("#documentosURLResponsableField").val()
    if (!/[(http(s)?):\/\/(www\.)?a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/.test(url)) {
        $("#documentosURLResponsable_Error").show();
        pasoIr = validarDocumentoPaso(pasoIr, pasoActual);
    } else {
        $("#documentosURLResponsable_Error").hide();
    };

    // DOCUMENTO
    if (!$("#documentosFileField")[0].files.length) {
        $("#documentosFile_Error").show();
        pasoIr = validarDocumentoPaso(pasoIr, pasoActual);
    } else {
        $("#documentosFile_Error").hide();
    }

    return pasoIr;
}

function validarDocumentoPaso(pasoIr, pasoTemp){
    return pasoIr == null ? pasoTemp : pasoTemp == null ? pasoIr : pasoIr <= pasoTemp ? pasoIr : pasoTemp
}

function validarDocumentoSelect(domData, domError, paso){
    console.log(domData, domError, paso);
    let data = $("#"+domData).select2("data")[0];
    if (data == undefined || data.id == null || data.id == "") {
        $("#"+domError).show();
        return paso;
    }

    $("#"+domError).hide();
    return null;
}

function validarDocumentoTexto(domData, domError, paso){
    let data = $("#"+domData).val();

    if ((data == undefined || data == null || data == "")) {
        $("#"+domError).show();
        return paso;
    }

    $("#"+domError).hide();
    return null;
}

function limpiarFormDocs() {

    $("#mainDiv").removeClass("resumenDocumentos");
    $("#mainDiv").addClass("detallesDocumentos");
    $("#documentosList").hide();
    $("#documentosDiv").removeClass("col-md-12");
    $("#documentosDiv").addClass("col-md-8");
    $("#instruccionesDiv").show();
    $("#documentosDetail").hide();
    $("#documentosDetailHeader").html("Ver documento");

    $("#documentosIdField").val("");
    // $("#documentosURLField").val("");
    $("#documentosFileField").val("");
    $("#documentosFileField").hide();

    $("#documentosFileResult").html("<a href='#' onclick='downloadDocumento();'>Enlace al archivo cargado</a>");
    $("#documentosDocCargadoLabel").html("<a href='#' onclick='downloadDocumento();'>Enlace al archivo cargado</a>");
    $("#documentosFileResult").show();
    $("#documentosDocCargadoLabel").show();

    $("#documentosETField").val("").trigger("change");
    $("#documentosEtapaField").val("").trigger("change");
    $("#documentosDimensionField").val("").trigger("change");
    $("#documentosComponenteField").val("").trigger("change");
    $("#documentosFormaField").val("").trigger("change");
    $("#documentosCategoriaField").val("").trigger("change");
    $("#documentosKeywordsField").val("").trigger("change");
    $("#documentosLicenciaField").val("").trigger("change");
    $("#documentosTipoField").val("").trigger("change");
    $("#documentosIdiomaField").val("").trigger("change");
    $("#documentosCodigoField").val("");
    $("#documentosNombreField").val("");
    $("#documentosVersionField").val("");
    $("#documentosFormatoField").val("");
    $("#documentosResponsableField").val("");
    $("#documentosURLResponsableField").val("");

    $("#documentosDateField").val("");
    $("#documentosDateField").datepicker("update", "");
    $("#documentosDescripcionField").summernote("reset");

    $("#documentosETLabel").html("");
    $("#documentosCodigoLabel").html("");
    $("#documentosEtapaLabel").html("");
    $("#documentosDCLabel").hide();
    $("#documentosDC1Label").html("");
    $("#documentosDC2Label").html("");
    $("#documentosNombreLabel").html("");
    $("#documentosVersionLabel").html("");
    $("#documentosDescripcionLabel").html("");
    $("#documentosFormaLabel").html("");
    $("#documentosFormatoLabel").html("");
    $("#documentosDateLabel").html("");
    $("#documentosCategoriaLabel").html("");
    $("#documentosKeywordsLabel").html("");
    $("#documentosResponsableLabel").html("");
    $("#documentosUrlResponsableLabel").html("");
    $("#documentosLicenciaLabel").html("");
    $("#documentosTipoLabel").html("");
    $("#documentosIdiomaLabel").html("");
    $("#documentosObservacionesLabel").html("");
    // $("#documentosDocCargadoLabel").html("");
    showDocumentosPasos();

    $("#documentosDetail").show();
    $("#documentosDetailHeader").html("Ver documento");
    $("#btnDocumentosBorrar").hide();
}

function gotoDocumentosPaso(paso) {

    if (paso == 4) {
        let pasoIr = validarDocumento();
        if (pasoIr){
            gotoDocumentosPaso(pasoIr)
            return
        }
    }

    DocumentosPasosHide();
    gotoDocumentosActivePaso(paso)
    $("#documentosPaso"+paso).show()

    $("#btnDocumentosPasoPrev").hide();
    $("#btnDocumentosPasoNext").hide();

    if (paso == 1) {
        $("#btnDocumentosPasoNext").show();
    } else if (paso == 4) {
        $("#btnDocumentosPasoPrev").show();
    } else {
        $("#btnDocumentosPasoNext").show();
        $("#btnDocumentosPasoPrev").show();
    }
}

function gotoDocumentosActivePaso(paso) {
    $("#listDocumentosPasos li a").show();
    $("#listDocumentosPasos li a").removeClass('active');
    $("#listDocumentosPasos li a:eq("+ (paso-1) + ")").addClass('active');
}

function DocumentosPasosHide(){
    $("#documentosPaso1").hide();
    $("#documentosPaso2").hide();
    $("#documentosPaso3").hide();
    $("#documentosPaso4").hide();
}

function DocumentosPasoNext(){
    if ($("#documentosPaso1").is(":visible") ){
        gotoDocumentosPaso(2);
    } else if ($("#documentosPaso2").is(":visible") ){
        gotoDocumentosPaso(3);
    } else if ($("#documentosPaso3").is(":visible") ){
        gotoDocumentosPaso(4);
    }
}

function DocumentosPasoPrev(){
    if ($("#documentosPaso4").is(":visible") ){
        gotoDocumentosPaso(3);
    } else if ($("#documentosPaso3").is(":visible") ){
        gotoDocumentosPaso(2);
    } else if ($("#documentosPaso2").is(":visible") ){
        gotoDocumentosPaso(1);
    }
}

function showDocumentosPasos() {
    $("#listOpciones").hide();
    gotoDocumentosPaso(1);
    $("#listDocumentosPasos").show();
}

/* Recursos */

function gotoRecursos() {
    currentUser.getIdToken().then(function (accessToken) {
        currentAccessToken = accessToken;
    });
    hideAll();
    $("#recursosDiv").show();
    $("#recursosDiv").removeClass("col-md-8");
    $("#recursosDiv").addClass("col-md-12");
    $("#instruccionesDiv").hide();
    $("#menuRecursos").addClass("active");
    $("#recursosDetail").hide();
    $("#recursosList").show();
    tableRecursos.ajax.reload();
}

function newRecursos() {
    $("#recursosList").hide();
    $("#recursosDiv").removeClass("col-md-12");
    $("#recursosDiv").addClass("col-md-8");
    $("#instruccionesDiv").show();
    $("#recursosDetail").show();
    $("#recursosDetailHeader").html("Nuevo recurso");
    $("#btnRecursosBorrar").hide();
    currentRecurso = null;
    $("#recursosIdField").val("");
    $("#recursosNombreField").val("");
    $("#recursosDescripcionField").summernote("reset");
    $("#recursosTipoField").val("");
    $("#recursosTipoField").trigger("change");
    $("#recursosDateField").val("");
    $("#recursosDateField").datepicker("update", "");
    $("#recursosTematicaField").val("");
    $("#recursosTematicaField").trigger("change");
    $("#recursosTematica2Field").val("");
    $("#recursosTematica2Field").trigger("change");
    $("#recursosEntidadField").val("");
    $("#recursosEntidadField").trigger("change");
    $("#recursosLicenciaField").val("");
    $("#recursosKeywordsField").val("");
    $("#recursosURLField").val("");
    $("#recursosURL2Field").val("");
    $("#recursosMetadataURLField").val("");
    $("#recursosNivelField").val("");
    $("#recursosNivelField").trigger("change");
    $("#recursosCodigoField").val("");
    $("#recursosCodigoField").trigger("change");
}

function detailRecursos(id) {
    $("#recursosList").hide();
    $("#recursosDiv").removeClass("col-md-12");
    $("#recursosDiv").addClass("col-md-8");
    $("#instruccionesDiv").show();
    $("#recursosDetail").hide();
    $("#recursosDetailHeader").html("Editar recurso");
    currentRecurso = id;
    $.ajax({
        url: web_service + "/cargueRecursos?cmd=get&ID_RECURSO=" + currentRecurso + "&token=" + currentAccessToken + "&t=" + (new Date()).getTime(),
        type: 'GET',
        dataType: 'json',
        success: function (data) {
            if (data.status) {
                $("#recursosIdField").val("");
                $("#recursosNombreField").val("");
                $("#recursosDescripcionField").summernote("reset");
                $("#recursosTipoField").val("");
                $("#recursosTipoField").trigger("change");
                $("#recursosDateField").val("");
                $("#recursosDateField").datepicker("update", "");
                $("#recursosTematicaField").val("");
                $("#recursosTematicaField").trigger("change");
                $("#recursosTematica2Field").val("");
                $("#recursosTematica2Field").trigger("change");
                $("#recursosEntidadField").val("");
                $("#recursosEntidadField").trigger("change");
                $("#recursosLicenciaField").val("");
                $("#recursosKeywordsField").val("");
                $("#recursosURLField").val("");
                $("#recursosURL2Field").val("");
                $("#recursosMetadataURLField").val("");
                $("#recursosNivelField").val("");
                $("#recursosNivelField").trigger("change");
                $("#recursosCodigoField").val("");
                $("#recursosCodigoField").trigger("change");

                $("#recursosDetail").show();
                $("#recursosDetailHeader").html("Editar recurso");
                $("#btnRecursosBorrar").hide();

                if (data.recursos.length > 0) {
                    $("#recursosIdField").val(data.recursos[0].ID_RECURSO);
                    $("#recursosNombreField").val(data.recursos[0].NOMBRE);
                    $("#recursosDescripcionField").summernote("reset");
                    $("#recursosDescripcionField").summernote("code", data.recursos[0].DESCRIPCION);
                    $("#recursosTipoField").val(data.recursos[0].TIPO_RECURSO);
                    $("#recursosTipoField").trigger("change");
                    $("#recursosDateField").datepicker("update", new Date(data.recursos[0].FECHA_PUBLICACION));
                    if (data.recursos[0].ID_TEMATICA != null) {
                        $("#recursosTematicaField").append("<option value='" + data.recursos[0].ID_TEMATICA + "'>" + data.recursos[0].TEMATICA + "</option>");
                        $("#recursosTematicaField").val(data.recursos[0].ID_TEMATICA).trigger("change");
                    }
                    if (data.recursos[0].ID_TEMATICA2 != null) {
                        $("#recursosTematica2Field").append("<option value='" + data.recursos[0].ID_TEMATICA2 + "'>" + data.recursos[0].TEMATICA2 + "</option>");
                        $("#recursosTematica2Field").val(data.recursos[0].ID_TEMATICA2).trigger("change");
                    }
                    if (data.recursos[0].ENTIDAD != null) {
                        $("#recursosEntidadField").append("<option value='" + data.recursos[0].ID_ENTIDAD + "'>" + data.recursos[0].ENTIDAD + "</option>");
                        $("#recursosEntidadField").val(data.recursos[0].ID_ENTIDAD).trigger("change");
                    }
                    $("#recursosLicenciaField").val(data.recursos[0].LICENCIA);
                    if (data.recursos[0].PALABRAS_CLAVE != null) {
                        $("#recursosKeywordsField").val(JSON.parse(data.recursos[0].PALABRAS_CLAVE).join("; "));
                    }
                    $("#recursosURLField").val(data.recursos[0].URL1);
                    $("#recursosURL2Field").val(data.recursos[0].URL2);
                    $("#recursosMetadataURLField").val(data.recursos[0].URL_METADATO);
                    $("#recursosNivelField").val(data.recursos[0].NIVEL);
                    $("#recursosNivelField").trigger("change");
                    if (data.recursos[0].CODIGO_UNIDAD != null) {
                        $("#recursosCodigoField").append("<option value='" + data.recursos[0].CODIGO_UNIDAD + "'>" + data.recursos[0].CODIGO_UNIDAD + " - " + data.recursos[0].UNIDAD + "</option>");
                        $("#recursosCodigoField").val(data.recursos[0].CODIGO_UNIDAD).trigger("change");
                    }
                }
            } else {
                $.alert("Operaci&oacute;n fallida.");
            }
        },
        error: function (xhr, status, error) {
            $.alert("Operaci&oacute;n fallida.");
        }
    });
}

function salvarRecursos() {
    var params = {};

    params.NOMBRE = $("#recursosNombreField").val();
    if (($("#recursosDescripcionField").summernote("code") != null) && ($("#recursosDescripcionField").summernote("code") != "")) {
        params.RESUMEN = b64EncodeUnicode($("#recursosDescripcionField").summernote("code").replaceAll("</p><p>", "<br/>").replaceAll("<br></p>", "").replaceAll("<p>", ""));
    }
    if (($("#recursosTipoField").val() != null) && ($("#recursosTipoField").val() != "")) {
        params.TIPO_RECURSO = $("#recursosTipoField").val();
    }
    if (($("#recursosDateField").val() != null) && ($("#recursosDateField").val() != "")) {
        params.FECHA_PUBLICACION = moment($("#recursosDateField").val()).format("YYYY-MM-DD");
    }
    if (($("#recursosTematicaField").val() != null) && ($("#recursosTematicaField").val() != "")) {
        params.ID_TEMATICA = $("#recursosTematicaField").val();
    }
    if (($("#recursosTematica2Field").val() != null) && ($("#recursosTematica2Field").val() != "")) {
        params.ID_TEMATICA2 = $("#recursosTematica2Field").val();
    }
    if (($("#recursosEntidadField").val() != null) && ($("#recursosEntidadField").val() != "")) {
        params.ID_ENTIDAD = $("#recursosEntidadField").val();
    }
    if (($("#recursosLicenciaField").val() != null) && ($("#recursosLicenciaField").val() != "")) {
        params.LICENCIA = $("#recursosLicenciaField").val();
    }
    if (($("#recursosKeywordsField").val() != null) && ($("#recursosKeywordsField").val() != "")) {
        var items = $("#recursosKeywordsField").val().split(";");
        for (var i = 0; i < items.length; i++) {
            items[i] = items[i].trim();
        }
        params.PALABRAS_CLAVE = JSON.stringify(items);
    }
    if (($("#recursosURLField").val() != null) && ($("#recursosURLField").val() != "")) {
        params.URL1 = encodeURI($("#recursosURLField").val());
    }
    if (($("#recursosURL2Field").val() != null) && ($("#recursosURL2Field").val() != "")) {
        params.URL2 = encodeURI($("#recursosURL2Field").val());
    }
    if (($("#recursosMetadataURLField").val() != null) && ($("#recursosMetadataURLField").val() != "")) {
        params.URL_METADATO = encodeURI($("#recursosMetadataURLField").val());
    }
    if (($("#recursosNivelField").val() != null) && ($("#recursosNivelField").val() != "")) {
        params.NIVEL = $("#recursosNivelField").val();
    }
    if (($("#recursosCodigoField").val() != null) && ($("#recursosCodigoField").val() != "")) {
        params.CODIGO = JSON.stringify([$("#recursosCodigoField").val(), $("#recursosCodigoField").val().substring(0, 2)]);
    }

    params.token = currentAccessToken;
    if (currentRecurso == null) {
        params.cmd = "create";
        params.t = (new Date()).getTime();
        $.confirm({
            title: "Nuevo recurso",
            content: function () {
                var self = this;
                return $.ajax({
                    url: web_service + "/cargueRecursos",
                    type: "POST",
                    data: params,
                    dataType: "json"
                }).done(function (response) {
                    if (response.status) {
                        self.setContent("Operaci&oacute;n exitosa.");
                    } else {
                        self.setContent("Operaci&oacute;n fallida. Intente m&aacute;s tarde.");
                    };
                }).fail(function () {
                    self.setContent("Operaci&oacute;n fallida. Intente m&aacute;s tarde.");
                });
            },
            buttons: {
                Ok: function () {
                    gotoRecursos();
                }
            }
        });
    } else {
        params.cmd = "update";
        params.ID_RECURSO = currentRecurso;
        params.t = (new Date()).getTime();
        $.confirm({
            title: "Actualizar recurso",
            content: function () {
                var self = this;
                return $.ajax({
                    url: web_service + "/cargueRecursos",
                    type: "POST",
                    data: params,
                    dataType: "json"
                }).done(function (response) {
                    if (response.status) {
                        self.setContent("Operaci&oacute;n exitosa.");
                    } else {
                        self.setContent("Operaci&oacute;n fallida. Intente m&aacute;s tarde.");
                    };
                }).fail(function () {
                    self.setContent("Operaci&oacute;n fallida. Intente m&aacute;s tarde.");
                });
            },
            buttons: {
                Ok: function () {
                    gotoRecursos();
                }
            }
        });
    }
}

function borrarRecursos() {
    $.confirm({
        title: "Eliminar recurso",
        content: 'Esta seguro de eliminar este recurso?',
        buttons: {
            Si: function () {
                $.ajax({
                    url: web_service + "/cargueRecursos?cmd=delete&ID_RECURSO=" + currentRecurso + "&token=" + currentAccessToken + "&t=" + (new Date()).getTime(),
                    type: 'GET',
                    dataType: 'json',
                    success: function (data) {
                        if (data.status) {
                            $.confirm({
                                title: "Eliminar recurso",
                                content: "Operaci&oacute;n exitosa",
                                buttons: {
                                    Ok: function () {
                                        gotoRecursos();
                                    }
                                }
                            });
                        } else {
                            $.alert("Operaci&oacute;n fallida.");
                        };
                    },
                    error: function (xhr, status, error) {
                        $.alert("Operaci&oacute;n fallida.");
                    }
                })
            },
            No: function () {

            },
        }
    });
}


/* Pot */

function gotoPot() {
    currentUser.getIdToken().then(function (accessToken) {
        currentAccessToken = accessToken;
    });
    hideAll();
    $("#potDiv").show();
    $("#potDiv").removeClass("col-md-8");
    $("#potDiv").addClass("col-md-12");
    $("#instruccionesDiv").hide();
    $("#menuPot").addClass("active");
    $("#potDetail").hide();
    $("#potList").show();
    tablePot.ajax.reload();
}

function newPot() {
    $("#potList").hide();
    $("#potDiv").removeClass("col-md-12");
    $("#potDiv").addClass("col-md-8");
    $("#instruccionesDiv").show();
    $("#potDetail").show();
    $("#potDetailHeader").html("Nuevo POT");
    $("#btnPotBorrar").hide();
    currentDocumento = null;
    $("#potIdField").val("");
    $("#potNombreField").val("");
    $("#potFileField").val("");
    $("#potFileValidateResult").html("");
}

function detailPot(id) {
    $("#potList").hide();
    $("#potDiv").removeClass("col-md-12");
    $("#potDiv").addClass("col-md-8");
    $("#instruccionesDiv").show();
    $("#potDetail").hide();
    $("#potDetailHeader").html("Editar POT");
    currentPot = id;
    $.ajax({
        url: web_service + "/carguePot?cmd=get&ID_POT=" + currentPot + "&token=" + currentAccessToken + "&t=" + (new Date()).getTime(),
        type: 'GET',
        dataType: 'json',
        success: function (data) {
            if (data.status) {
                $("#potIdField").val("");
                $("#potNombreField").val("");

                $("#potDetail").show();
                $("#potDetailHeader").html("Editar POT");
                $("#btnpotBorrar").hide();


            } else {
                $.alert("Operaci&oacute;n fallida.");
            }
        },
        error: function (xhr, status, error) {
            $.alert("Operaci&oacute;n fallida.");
        }
    });
}

function salvarPot() {
    var params = {};


    params.token = currentAccessToken;
    if (currentDocumento == null) {
        params.cmd = "create";
        params.t = (new Date()).getTime();
        $.confirm({
            title: "Nuevo POT",
            content: function () {
                var self = this;
                return $.ajax({
                    url: web_service + "/carguePot",
                    type: "POST",
                    data: params,
                    dataType: "json"
                }).done(function (response) {
                    if (response.status) {
                        self.setContent("Operaci&oacute;n exitosa.");
                    } else {
                        self.setContent("Operaci&oacute;n fallida. Intente m&aacute;s tarde.");
                    };
                }).fail(function () {
                    self.setContent("Operaci&oacute;n fallida. Intente m&aacute;s tarde.");
                });
            },
            buttons: {
                Ok: function () {
                    gotopot();
                }
            }
        });
    } else {
        params.cmd = "update";
        params.ID_POT = currentPot;
        params.t = (new Date()).getTime();
        $.confirm({
            title: "Actualizar POT",
            content: function () {
                var self = this;
                return $.ajax({
                    url: web_service + "/carguePot",
                    type: "POST",
                    data: params,
                    dataType: "json"
                }).done(function (response) {
                    if (response.status) {
                        self.setContent("Operaci&oacute;n exitosa.");
                    } else {
                        self.setContent("Operaci&oacute;n fallida. Intente m&aacute;s tarde.");
                    };
                }).fail(function () {
                    self.setContent("Operaci&oacute;n fallida. Intente m&aacute;s tarde.");
                });
            },
            buttons: {
                Ok: function () {
                    gotopot();
                }
            }
        });
    }
}

function borrarPot() {
    $.confirm({
        title: "Eliminar POT",
        content: 'Esta seguro de eliminar este POT?',
        buttons: {
            Si: function () {
                $.ajax({
                    url: web_service + "/pot?cmd=delete&ID_POT=" + currentPot + "&token=" + currentAccessToken + "&t=" + (new Date()).getTime(),
                    type: 'GET',
                    dataType: 'json',
                    success: function (data) {
                        if (data.status) {
                            $.confirm({
                                title: "Eliminar POT",
                                content: "Operaci&oacute;n exitosa",
                                buttons: {
                                    Ok: function () {
                                        gotopot();
                                    }
                                }
                            });
                        } else {
                            $.alert("Operaci&oacute;n fallida.");
                        };
                    },
                    error: function (xhr, status, error) {
                        $.alert("Operaci&oacute;n fallida.");
                    }
                })
            },
            No: function () {

            },
        }
    });
}

function validarPot() {
    var formData = new FormData($("#potFileFieldData")[0]);
    formData.append("file", $("#potFileField")[0].files[0]);
    $("#potFileValidateResult").html("");

    $.ajax({
        url: web_service + "/pot?cmd=validar_xtf" + "&token=" + currentAccessToken + "&t=" + (new Date()).getTime(),
        type: 'POST',
        data: formData,
        success: function (data) {
            var strHTML = "";
            if (data.valido) {
                strHTML = strHTML + "<div class='alert alert-success' role='alert' style='margin: 5px;'>Validaci&oacute;n exitosa</div>";
            } else {
                strHTML = strHTML + "<div class='alert alert-info' role='alert' style='margin: 5px;'>Archivo con errores</div>";
            }
            for (var i = 0; i < data.errores.length; i++) {
                strHTML = strHTML + "<div class='alert alert-danger' role='alert' style='margin: 5px;'>Error: " + data.errores[i].mensaje + ((data.errores[i].linea == "") || (data.errores[i].linea == null) ? "" : " en linea " + data.errores[i].linea) + "</div>";
            }
            for (var i = 0; i < data.advertencias.length; i++) {
                strHTML = strHTML + "<div class='alert alert-warning' role='alert' style='margin: 5px;'>Advertencia: " + data.advertencias[i].mensaje + ((data.advertencias[i].linea == "") || (data.errores[i].linea == null) ? "" : " en linea " + data.advertencias[i].linea) + "</div>";
            }
            $("#potFileValidateResult").html(strHTML);
        },
        error: function (xhr, status, error) {
            $.alert("Operaci&oacute;n fallida.");
        },
        cache: false,
        contentType: false,
        processData: false
    });
}

function updateInicio() {
    if (firstExpand) {
        $("#panelSearchResultados").show();
        $("#headingSearch").show();
        toggleMenu("large");
    }
}

function getSorted(selector, attrName) {
    return $($(selector).toArray().sort(function (a, b) {
        var aVal = a.getAttribute(attrName),
            bVal = b.getAttribute(attrName);
        return (aVal > bVal) ? 1 : -1;
    }));
}

function b64EncodeUnicode(str) {
    // first we use encodeURIComponent to get percent-encoded UTF-8,
    // then we convert the percent encodings into raw bytes which
    // can be fed into btoa.
    return window.btoa(str);
    /*
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
        }));
     */
}

function b64DecodeUnicode(str) {
    return window.atob(str);
    /*
    // Going backwards: from bytestream, to percent-encoding, to original string.
    return decodeURIComponent(atob(str).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    */
}

function limpiarTexto(str) {
    return accentFold(str.toLowerCase());
}

function accentFold(inStr) {
    return inStr.replace(
        /([àáâãäå])|([çčć])|([èéêë])|([ìíîï])|([ñ])|([òóôõöø])|([ß])|([ùúûü])|([ÿ])|([æ])/g,
        function (str, a, c, e, i, n, o, s, u, y, ae) {
            if (a) return 'a';
            if (c) return 'c';
            if (e) return 'e';
            if (i) return 'i';
            if (n) return 'n';
            if (o) return 'o';
            if (s) return 's';
            if (u) return 'u';
            if (y) return 'y';
            if (ae) return 'ae';
        }
    );
}

function getDeptoByMuni(id) {
    if (id == null) {
        return null;
    }
    for (var i = 0; i < cacheUnidades.length; i++) {
        if (cacheUnidades[i].type == "DEPTO") {
            if (id.startsWith(cacheUnidades[i].id)) {
                return cacheUnidades[i];
            }
        }
    }
    return null;
}