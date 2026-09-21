/**
 * Modal de autenticación compartido.
 * Replica el flujo FirebaseUI de referencia: Google, Facebook, correo/contraseña,
 * Apple, Microsoft y Yahoo.
 */
(function () {
  'use strict';

  var root = null;
  var auth = null;
  var authUi = null;
  var lastFocused = null;
  var required = false;
  var firebaseUiPromise = null;
  var firebaseUiCssPromise = null;
  var FIREBASE_UI_SCRIPT = 'https://www.gstatic.com/firebasejs/ui/6.1.0/firebase-ui-auth__es.js';
  var FIREBASE_UI_STYLES = 'https://www.gstatic.com/firebasejs/ui/6.1.0/firebase-ui-auth.css';

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function ensureModal() {
    if (root) return root;

    root = element('div', 'oot-auth-modal');
    root.id = 'oot-auth-modal';
    root.hidden = true;
    root.setAttribute('role', 'presentation');

    var backdrop = element('button', 'oot-auth-modal__backdrop');
    backdrop.type = 'button';
    backdrop.setAttribute('aria-label', 'Cerrar ventana de inicio de sesión');

    var dialog = element('section', 'oot-auth-modal__dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'oot-auth-modal-title');

    var header = element('header', 'oot-auth-modal__header');
    var title = element('h2', 'oot-auth-modal__title', 'Iniciar sesión');
    title.id = 'oot-auth-modal-title';
    var closeButton = element('button', 'oot-auth-modal__close', '×');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Cerrar');

    var body = element('div', 'oot-auth-modal__body');
    var intro = element('p', 'oot-auth-modal__intro', 'Selecciona una opción para acceder a Colombia OT.');
    var loginContainer = element('div', 'oot-auth-modal__login');
    loginContainer.id = 'oot-auth-container';

    var session = element('div', 'oot-auth-modal__session');
    session.hidden = true;
    var avatar = element('img', 'oot-auth-modal__avatar');
    avatar.alt = 'Imagen de usuario';
    var name = element('p', 'oot-auth-modal__name');
    var email = element('p', 'oot-auth-modal__email');
    var logout = element('button', 'oot-auth-modal__logout', 'Cerrar sesión');
    logout.type = 'button';

    session.appendChild(avatar);
    session.appendChild(name);
    session.appendChild(email);
    session.appendChild(logout);
    body.appendChild(intro);
    body.appendChild(loginContainer);
    body.appendChild(session);
    header.appendChild(title);
    header.appendChild(closeButton);
    dialog.appendChild(header);
    dialog.appendChild(body);
    root.appendChild(backdrop);
    root.appendChild(dialog);
    document.body.appendChild(root);

    root._elements = {
      closeButton: closeButton,
      intro: intro,
      loginContainer: loginContainer,
      session: session,
      avatar: avatar,
      name: name,
      email: email,
      logout: logout
    };

    backdrop.addEventListener('click', close);
    closeButton.addEventListener('click', close);
    logout.addEventListener('click', function () {
      if (!auth) return;
      logout.disabled = true;
      auth.signOut().then(close).catch(function (error) {
        console.error('[OOT.authModal] Error al cerrar sesión:', error);
      }).then(function () {
        logout.disabled = false;
      });
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && root && !root.hidden) close();
    });

    return root;
  }

  function uiConfig() {
    function success() {
      close();
      return false;
    }

    return {
      callbacks: {
        signInSuccess: success,
        signInSuccessWithAuthResult: success
      },
      signInOptions: [
        {
          provider: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
          scopes: ['https://www.googleapis.com/auth/plus.login'],
          customParameters: { prompt: 'select_account' }
        },
        {
          provider: firebase.auth.FacebookAuthProvider.PROVIDER_ID,
          scopes: ['public_profile', 'email'],
          customParameters: { auth_type: 'reauthenticate' }
        },
        {
          provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
          requireDisplayName: true
        },
        'apple.com',
        'microsoft.com',
        'yahoo.com'
      ],
      credentialHelper: window.firebaseui.auth.CredentialHelper.NONE,
      signInFlow: 'popup'
    };
  }

  function showUser(user) {
    var modal = ensureModal();
    var parts = modal._elements;
    parts.loginContainer.hidden = Boolean(user);
    parts.intro.hidden = Boolean(user);
    parts.session.hidden = !user;
    if (!user) return;

    parts.avatar.src = user.photoURL || '/images/iconos/User.png';
    parts.name.textContent = user.displayName || user.email || 'Usuario';
    parts.email.textContent = user.email || '';
  }

  function startFirebaseUi() {
    if (!auth) return;
    var modal = ensureModal();
    modal._elements.loginContainer.textContent = 'Cargando opciones de inicio de sesión...';

    ensureFirebaseUi().then(function () {
      if (!root || root.hidden || auth.currentUser) return;
      modal._elements.loginContainer.textContent = '';
      authUi = window.firebaseui.auth.AuthUI.getInstance() || new window.firebaseui.auth.AuthUI(auth);
      authUi.start('#oot-auth-container', uiConfig());
    }).catch(function (error) {
      console.error('[OOT.authModal] No fue posible cargar FirebaseUI.', error);
      if (root && !root.hidden) {
        modal._elements.loginContainer.textContent = 'No fue posible cargar las opciones de inicio de sesión. Intenta nuevamente.';
      }
    });
  }

  function ensureFirebaseUi() {
    if (window.firebaseui && window.firebaseui.auth) return Promise.resolve(window.firebaseui);
    if (firebaseUiPromise) return firebaseUiPromise;

    firebaseUiPromise = Promise.all([
      ensureFirebaseUiStyles(),
      new Promise(function (resolve, reject) {
        var existing = document.getElementById('oot-firebase-ui-script');
        if (existing) {
          existing.addEventListener('load', function () { resolve(window.firebaseui); }, { once: true });
          existing.addEventListener('error', reject, { once: true });
          return;
        }

        var amdDefine = window.define;
        var amdRequire = window.require;
        var restoreAmd = function () {
          window.define = amdDefine;
          window.require = amdRequire;
        };
        var script = document.createElement('script');
        script.id = 'oot-firebase-ui-script';
        script.src = FIREBASE_UI_SCRIPT;
        script.async = true;
        script.onload = function () {
          restoreAmd();
          if (window.firebaseui && window.firebaseui.auth) resolve(window.firebaseui);
          else reject(new Error('FirebaseUI no expuso su API.'));
        };
        script.onerror = function () {
          restoreAmd();
          script.remove();
          reject(new Error('No fue posible descargar FirebaseUI.'));
        };
        window.define = undefined;
        window.require = undefined;
        document.head.appendChild(script);
      })
    ]).then(function () {
      return window.firebaseui;
    }).catch(function (error) {
      firebaseUiPromise = null;
      throw error;
    });

    return firebaseUiPromise;
  }

  function ensureFirebaseUiStyles() {
    if (document.getElementById('oot-firebase-ui-styles')) return Promise.resolve();
    if (firebaseUiCssPromise) return firebaseUiCssPromise;

    firebaseUiCssPromise = new Promise(function (resolve, reject) {
      var link = document.createElement('link');
      link.id = 'oot-firebase-ui-styles';
      link.rel = 'stylesheet';
      link.href = FIREBASE_UI_STYLES;
      link.onload = resolve;
      link.onerror = function () {
        link.remove();
        reject(new Error('No fue posible descargar los estilos de FirebaseUI.'));
      };
      document.head.appendChild(link);
    }).catch(function (error) {
      firebaseUiCssPromise = null;
      throw error;
    });

    return firebaseUiCssPromise;
  }

  function open(authInstance) {
    auth = authInstance || auth || (window.firebase && firebase.auth ? firebase.auth() : null);
    if (!auth) {
      console.error('[OOT.authModal] Firebase Auth no está disponible.');
      return;
    }

    var modal = ensureModal();
    lastFocused = document.activeElement;
    showUser(auth.currentUser);
    modal.hidden = false;
    document.body.classList.add('oot-auth-modal-open');

    if (auth.currentUser) modal._elements.closeButton.focus();
    else startFirebaseUi();
  }

  function close() {
    if (!root || root.hidden) return;
    root.hidden = true;
    document.body.classList.remove('oot-auth-modal-open');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function setCurrentUser(user) {
    if (root && !root.hidden) showUser(user || null);
    if (user && required) close();
  }

  function setRequired(value) {
    required = Boolean(value);
    if (required && auth && !auth.currentUser) open(auth);
  }

  window.OOTAuthModal = {
    open: open,
    close: close,
    setCurrentUser: setCurrentUser,
    setRequired: setRequired
  };
})();
