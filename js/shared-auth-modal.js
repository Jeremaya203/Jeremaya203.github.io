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
      credentialHelper: firebaseui.auth.CredentialHelper.NONE,
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
    if (!window.firebaseui || !firebaseui.auth || !auth) {
      console.error('[OOT.authModal] FirebaseUI no está disponible.');
      return;
    }

    authUi = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(auth);
    authUi.start('#oot-auth-container', uiConfig());
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
