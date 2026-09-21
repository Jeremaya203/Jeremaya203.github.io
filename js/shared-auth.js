/**
 * Autenticación compartida del portal principal — Colombia OT 2.0.
 *
 * Reutiliza el MISMO proyecto Firebase que caracterizaciones/ (geovisor-igac), verificado
 * en producción real (https://www.colombiaot.gov.co/): el mismo apiKey/authDomain está en
 * caracterizaciones/js/shared/auth/firebaseConfig.js y en el js/maestra.js legacy. Al ser el
 * mismo proyecto Firebase y el mismo origen, la sesión iniciada aquí es reconocida
 * automáticamente por caracterizaciones/ (su propio onAuthStateChanged la detecta sin
 * cambios adicionales).
 *
 * El acceso reutiliza el modal FirebaseUI y todos los proveedores del proyecto de
 * referencia, sin duplicar la gestión de sesión ni de permisos.
 */
(function () {
    'use strict';

    // La configuracion vive en `config.js` (window.OOT_FIREBASE); el literal es respaldo.
    // Era la quinta copia de los mismos tres valores y ninguna sabia de las otras.
    const FIREBASE_CONFIG = window.OOT_FIREBASE || {
        apiKey: 'AIzaSyCLSp_Qbaohj8owxrpZxvrmxUSkVw0ukig',
        authDomain: 'geovisor-igac.firebaseapp.com',
        projectId: 'geovisor-igac'
    };
    // A.6 — Por el PROXY del backend, igual que js/maestra.js. Llamar directamente a
    // serviciosgeovisor.igac.gov.co:8080 desde el navegador solo funciona dentro de la
    // red del IGAC (dominio ajeno -> CORS, puerto 8080 no expuesto); fuera de ella
    // OOT_authPermisos quedaba SIEMPRE vacio sin que nadie se enterara.
    const VALIDATE_URL = (window.OOT_API_BASE || '') + '/api/igac/validate';

    let initialized = false;
    let currentUser = null;

    function ensureInit() {
        if (initialized) return true;
        if (!window.firebase || !window.firebase.auth) {
            console.error('[OOT.auth] Firebase no está cargado en esta página.');
            return false;
        }
        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
        }
        firebase.auth().onAuthStateChanged(onAuthChange, function (error) {
            console.error('[OOT.auth] onAuthStateChanged:', error);
        });
        initialized = true;
        return true;
    }

    function signIn() {
        if (!ensureInit()) return;
        if (!window.OOTAuthModal) {
            console.error('[OOT.auth] El modal de autenticacion no esta disponible.');
            return;
        }
        window.OOTAuthModal.open(firebase.auth());
    }

    function signOut() {
        if (!window.firebase || !window.firebase.auth) return;
        firebase.auth().signOut().catch(function (error) {
            console.error('[OOT.auth] Error en signOut:', error);
        });
    }

    // Consulta permisos contra el backend legacy Geovisor (mismo endpoint que el sitio en
    // producción). Si no responde, la sesión sigue autenticada pero sin permisos elevados
    // conocidos — no bloquea el login, solo deja window.OOT_authPermisos vacío.
    function validatePermisos(user) {
        user.getIdToken().then(function (token) {
            const url = VALIDATE_URL + '?token=' + encodeURIComponent(token) + '&t=' + Date.now();
            fetch(url).then(function (r) {
                return r.ok ? r.json() : null;
            }).then(function (data) {
                window.OOT_authPermisos = (data && data.permisos) || [];
            }).catch(function (error) {
                console.warn('[OOT.auth] No se pudo validar permisos (backend Geovisor):', error);
                window.OOT_authPermisos = [];
            });
        });
    }

    function setText(el, value) {
        if (el) el.textContent = value == null ? '' : String(value);
    }

    function onAuthChange(user) {
        currentUser = user || null;
        if (window.OOTAuthModal) window.OOTAuthModal.setCurrentUser(currentUser);

        // Log deliberado para verificar herencia de sesión entre páginas: si al entrar a
        // esta página YA aparece un usuario aquí sin haber hecho clic en "Iniciar sesión",
        // la sesión se heredó correctamente desde otra página del mismo origen/Firebase.
        // console.info/log estan anulados en produccion (config.js); esta traza es
        // diagnostica y solo interesa con OOT_DEBUG activo.
        if (window.OOT_DEBUG) console.error('[OOT.auth] Estado de sesión en', location.pathname, '→', currentUser ? ('logueado como ' + (currentUser.email || currentUser.uid)) : 'sin sesión');

        var loginBtn = document.getElementById('oot-login-btn');
        var logoutBtn = document.getElementById('oot-logout-btn');
        const userLabel = document.getElementById('oot-user-label');

        if (currentUser) {
            setText(userLabel, currentUser.displayName || currentUser.email || 'Usuario');
            if (loginBtn) loginBtn.hidden = true;
            if (logoutBtn) logoutBtn.hidden = false;
            if (userLabel) userLabel.hidden = false;
            validatePermisos(currentUser);
        } else {
            setText(userLabel, '');
            if (loginBtn) loginBtn.hidden = false;
            if (logoutBtn) logoutBtn.hidden = true;
            if (userLabel) userLabel.hidden = true;
            window.OOT_authPermisos = [];
        }
    }

    // Llamado desde config.js → OOT.loadShell() DESPUÉS de inyectar navbar.html (los botones
    // #oot-login-btn/#oot-logout-btn viven ahí y no existen hasta ese momento).
    function bindNavbar() {
        if (!ensureInit()) return;

        var loginBtn = document.getElementById('oot-login-btn');
        var logoutBtn = document.getElementById('oot-logout-btn');

        if (loginBtn && !loginBtn.dataset.ootBound) {
            loginBtn.dataset.ootBound = '1';
            loginBtn.addEventListener('click', function (e) {
                e.preventDefault();
                signIn();
            });
        }
        if (logoutBtn && !logoutBtn.dataset.ootBound) {
            logoutBtn.dataset.ootBound = '1';
            logoutBtn.addEventListener('click', function (e) {
                e.preventDefault();
                signOut();
            });
        }

        // Si Firebase ya tenía sesión activa (misma pestaña/origen), refleja el estado ya
        // conocido sin esperar un nuevo evento.
        if (initialized) {
            onAuthChange(currentUser);
        }
    }

    window.OOT = window.OOT || {};
    window.OOT.auth = {
        init: ensureInit,
        signIn: signIn,
        signOut: signOut,
        bindNavbar: bindNavbar,
        getCurrentUser: function () { return currentUser; }
    };
})();
