var currentUser;
var firebase_ui;
var currentScreen;
var currentSearch = "all";
var firstExpand = true;
var firstParameters = true;
var cacheUnidadesFiltro;

// A.6 — Por defecto se sale por el PROXY del backend (/api/igac/*), no directo al
// Geovisor: llamar a serviciosgeovisor.igac.gov.co:8080 desde el navegador solo funciona
// dentro de la red del IGAC (dominio ajeno → CORS, y puerto 8080 no expuesto), y fuera de
// ella el buscador POT cargaba con todos los filtros vacíos. Las rutas coinciden 1:1
// (web_service + "/documentos?cmd=..." → /api/igac/documentos?cmd=...).
// OOT_COT_API_BASE se conserva como override para volver a apuntar directo si hiciera falta.
var web_service = window.OOT_COT_API_BASE || ((window.OOT_API_BASE || '') + '/api/igac');
var web_service_proxy = web_service;

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
        "sNext": "Siguiente",
        "sPrevious": "Anterior"
    },
    "oAria": {
        "sSortAscending": ": Activar para ordenar la columna de manera ascendente",
        "sSortDescending": ": Activar para ordenar la columna de manera descendente"
    }
}

var tableDocumentos;
var cacheDocumentos;
var cacheResumen;
var cacheResumenTags;
var currentDocumento;
var currentEtapa;
var currentTipo;

var tableRecursos;
var cacheRecursos;

var cacheUnidades = [];
var cacheTematicas = [];
var cacheEntidades = [];

var cacheTags = [];
var cacheTags2 = [];

var color_tags = [{
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
                    $("#userPhoto,#userPhoto2").attr("src", "/images/iconos/User.png");
                }
            } else {
                $("#userPhoto,#userPhoto2").attr("src", "/images/iconos/User.png");
            }
            validate();
        } else {
            currentUser = null;
            currentFuncionalidades = [];
            $("#optionCargue").hide();
            $("#logoutContainer").hide();
            $("#loginContainer").show();
            $("#userName,#userName2").html("Iniciar sesion");
            $("#userPhoto,#userPhoto2").attr("src", "/images/iconos/User.png");
        }
    }, function (error) {
        console.log(error);
    });
    firebase_ui = new firebaseui.auth.AuthUI(firebase.auth());
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
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
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
    if (parametro == null) {
        try {
            amplitude.getInstance().logEvent(funcionalidad, null);
        } catch (err) {
            console.log(err);
        }
        try {
            gtag('event', funcionalidad, {
                'send_to': 'UA-177680669-1',
                'event_category': funcionalidad
            });
        } catch (err) {
            console.log(err);
        }
        return;
    }
    try {
        amplitude.getInstance().logEvent(funcionalidad, parametro);
    } catch (err) {

    }
    var value = null;
    if (parametro.unidad != null) {
        value = parametro.unidad;
    }
    try {
        gtag('event', funcionalidad, {
            'send_to': 'UA-177680669-1',
            'event_category': funcionalidad,
            'event_action': parametro.action,
            'event_label': value,
        });
    } catch (err) {

    }
}

function signIn() {
    $("#logoutContainer").hide();
    $("#loginContainer").show();

    var uiConfig = {
        callbacks: {
            signInSuccess: function (_currentUser, _credential, _redirectUrl) {
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
    $("#userPhoto,#userPhoto2").attr("src", "/images/iconos/User.png");
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
    var f = font || '12px arial',
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
