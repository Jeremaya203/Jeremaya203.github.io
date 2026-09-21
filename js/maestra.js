let currentUser;
let firebase_ui;
let currentScreen;
const currentSearch = "all";
const firstExpand = true;
const firstParameters = true;
let cacheUnidadesFiltro;

// A.6 — Por defecto se sale por el PROXY del backend (/api/igac/*), no directo al
// Geovisor: llamar a serviciosgeovisor.igac.gov.co:8080 desde el navegador solo funciona
// dentro de la red del IGAC (dominio ajeno → CORS, y puerto 8080 no expuesto), y fuera de
// ella el buscador POT cargaba con todos los filtros vacíos. Las rutas coinciden 1:1
// (web_service + "/documentos?cmd=..." → /api/igac/documentos?cmd=...).
// OOT_COT_API_BASE se conserva como override para volver a apuntar directo si hiciera falta.
var web_service = window.OOT_COT_API_BASE || ((window.OOT_API_BASE || '') + '/api/igac');
const web_service_proxy = web_service;

const spanishDataTable = {
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
        "sNext": "Siguiente",
        "sPrevious": "Anterior"
    },
    "oAria": {
        "sSortAscending": ": Activar para ordenar la columna de manera ascendente",
        "sSortDescending": ": Activar para ordenar la columna de manera descendente"
    }
}

let tableDocumentos;
let cacheDocumentos;
let cacheResumen;
let cacheResumenTags;
let currentDocumento;
let currentEtapa;
let currentTipo;

let tableRecursos;
let cacheRecursos;

let cacheUnidades = [];
const cacheTematicas = [];
const cacheEntidades = [];

let cacheTags = [];
let cacheTags2 = [];

const color_tags = [{
        "color": "6BDBB7"
    },
    {
        "color": "33B7B7"
    },
    {
        "color": "007D82"
    },
    {
        "color": "009075"
    },
    {
        "color": "00A586"
    },
    {
        "color": "DCDA00"
    },
    {
        "color": "93BF1F"
    },
    {
        "color": "2FAA66"
    },
    {
        "color": "008B36"
    },
    {
        "color": "006633"
    },
    {
        "color": "58CCFB"
    },
    {
        "color": "5193FC"
    },
    {
        "color": "3268DF"
    },
    {
        "color": "3595E0 "
    },
    {
        "color": "0069B3"
    },
    {
        "color": "1E4A93"
    },
    {
        "color": "57A1BF"
    },
    {
        "color": "FEE561"
    },
    {
        "color": "FACE33"
    },
    {
        "color": "F4A833"
    },
    {
        "color": "EA4B33"
    },
    {
        "color": "E94258"
    },
    {
        "color": "CF394B"
    },
    {
        "color": "EB8CEF"
    },
    {
        "color": "B64FDD"
    },
    {
        "color": "8D338A"
    },
    {
        "color": "6445E1"
    },
    {
        "color": "532D96"
    },
    {
        "color": "F1A5A7"
    },
    {
        "color": "E751BF"
    },
    {
        "color": "E9467F"
    },
    {
        "color": "874F43"
    }
];

$(document).ready(function () {
    $("[data-toggle='popover']").popover();
    // La configuracion vive en `config.js` (window.OOT_FIREBASE), que esta pagina carga.
    // El literal de respaldo es por si alguien sirve este archivo sin el: antes era la
    // unica fuente aqui y cambiar de proyecto obligaba a acordarse de este sitio.
    const config = window.OOT_FIREBASE || {
        apiKey: "AIzaSyCLSp_Qbaohj8owxrpZxvrmxUSkVw0ukig",
        authDomain: "geovisor-igac.firebaseapp.com"
    };
    // config.js (barrera de acceso) ya pudo crear la app [DEFAULT] en esta misma pagina.
    // Un initializeApp incondicional lanza app/duplicate-app y aborta TODO este
    // $(document).ready: sin signIn(), sin tooltips y sin la peticion config_buscador
    // -> el buscador POT quedaba con los filtros vacios.
    if (!firebase.apps.length) firebase.initializeApp(config);
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
                    $("#userPhoto,#userPhoto2").attr("src", ((window.OOT_BASE || "") + "/images/iconos/User.png"));
                }
            } else {
                $("#userPhoto,#userPhoto2").attr("src", ((window.OOT_BASE || "") + "/images/iconos/User.png"));
            }
            validate();
        } else {
            currentUser = null;
            currentFuncionalidades = [];
            $("#optionCargue").hide();
            $("#logoutContainer").hide();
            $("#loginContainer").show();
            $("#userName,#userName2").html("Iniciar sesion");
            $("#userPhoto,#userPhoto2").attr("src", ((window.OOT_BASE || "") + "/images/iconos/User.png"));
        }
    }, function (error) {
        console.log(error);
    });
    // Misma razon: FirebaseUI es un singleton por app. Si config.js ya instancio una,
    // `new AuthUI` lanza "AuthUI instance already exists".
    firebase_ui = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(firebase.auth());
    signIn();
    $('[data-toggle="tooltip"]').tooltip();

    $(".shareLink").tooltip({
        container: "body",
        template: '<div class="tooltipX" role="tooltip"><div class="tooltip-arrowX"></div><div class="tooltip-innerX">Click para copiar el Link</div></div>'
    });
    $(".shareLink").on("shown.bs.tooltip", function () {
        $(".tooltip-arrowX").css("border-right-color", "#3168E4");
        $(".tooltip-innerX").css("background-color", "#3168E4");
        $(".tooltip-innerX").html("Click para copiar el Link");
    });

    var params = "";
    $.ajax({
        url: web_service + "/config?cmd=config_buscador&t=" + (new Date()).getTime() + params,
        type: 'POST',
        success: function (data) {
            if (data.status) {
                initDataMaestra(data);
            }
        },
        timeout: 20000,
        error: function (err) {
            console.error(err)
        }
    });
});

function initDataMaestra(data) {
    cacheUnidades = data.UNIDAD;
    cacheUnidadesFiltro = data.UNIDAD;

    cacheTags = [];

    let colorPos = 0;
    for (let i = 0; i < data.TAGS.length; i++) {
        if (colorPos == color_tags.length) {
            colorPos = 0;
        }
        cacheTags.push({
            tag: data.TAGS[i].text,
            color: color_tags[colorPos].color
        });
        colorPos = colorPos + 1;
    }

    cacheTags2 = [];

    colorPos = 0;
    for (let i = 0; i < data.TAGS2.length; i++) {
        if (colorPos == color_tags.length) {
            colorPos = 0;
        }
        cacheTags2.push({
            tag: data.TAGS2[i].text,
            color: color_tags[colorPos].color
        });
        colorPos = colorPos + 1;
    }
}

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return null;
    return decodeURIComponent(results[2].replace(/\+/g, " "));
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

function reporteUso(funcionalidad, parametro) {
    // Antes enviaba a 'UA-177680669-1' (Universal Analytics), propiedad que Google apago
    // en julio de 2023: todos estos eventos se perdian. Ahora sale por OOT.track, que usa
    // la propiedad GA4 configurada en config.js (window.OOT_GA4_ID).
    // Tambien se retiro la llamada a amplitude: no esta cargado en ninguna pagina del
    // sitio, asi que solo lanzaba y capturaba una excepcion en cada evento.
    var params = { event_category: funcionalidad };
    if (parametro) {
        if (parametro.action != null) params.event_action = parametro.action;
        if (parametro.unidad != null) params.event_label = parametro.unidad;
    }
    try {
        if (window.OOT && window.OOT.track) window.OOT.track(funcionalidad, params);
    } catch (err) {
        console.warn('[maestra] No se pudo registrar el evento', funcionalidad, err);
    }
}

function signIn() {
    $("#logoutContainer").hide();
    $("#loginContainer").show();

    const uiConfig = {
        callbacks: {
            signInSuccess: function (_currentUser, _credential, _redirectUrl) {
                closeLogin();
                return false;
            }
        },
        signInOptions: [{
                provider: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
                // Se retiro el scope 'plus.login': la API de Google+ se apago en
                // marzo de 2019 y pedir un scope inexistente solo puede romper el
                // dialogo de consentimiento.
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
    currentUser = null;
    currentFuncionalidades = [];
    closeLogin();
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
}

function defaultUserPhoto() {
    $("#userPhoto,#userPhoto2").attr("src", ((window.OOT_BASE || "") + "/images/iconos/User.png"));
}

function validate() {
    currentUser.getIdToken().then(function (accessToken) {
        currentAccessToken = accessToken;
        $.ajax({
            url: web_service + "/validate?token=" + currentAccessToken + "&t=" + (new Date()).getTime(),
            type: 'GET',
            dataType: 'json',
            success: function (data) {
                if (data.status) {
                    if (data.permisos.indexOf("CARGUE_DOCUMENTOS") != -1 || data.permisos.indexOf("CARGUE_RECURSOS") != -1 || data.permisos.indexOf("CARGUE_POT") != -1) {
                        $("#optionCargue").show();
                    }
                } else {
                    $("#msgValidacion").html("Usuario no valido");
                }
            },
            error: function (xhr, status, error) {
                $("#msgValidacion").html("Usuario no valido");
            }
        });
    });
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

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace);
}

function getColorByTag(tag) {
	if (tag != null){
		for (var i = 0; i < cacheTags.length; i++) {
			if (cacheTags[i].tag.toLowerCase() == tag.toLowerCase()) {
				return "#" + cacheTags[i].color;
			}
		}
    }
    return "#777777";
}

function getColorByTag2(tag) {
    for (var i = 0; i < cacheTags2.length; i++) {
        if (cacheTags2[i].tag.toLowerCase() == tag.toLowerCase()) {
            return "#" + cacheTags2[i].color;
        }
    }
    return "#777777";
}

String.prototype.width = function (font) {
    const f = font || '12px arial',
        o = $('<div></div>')
        .text(this)
        .css({
            'position': 'absolute',
            'float': 'left',
            'white-space': 'nowrap',
            'visibility': 'hidden',
            'font': f
        })
        .appendTo($('body')),
        w = o.width();

    o.remove();

    return w;
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
