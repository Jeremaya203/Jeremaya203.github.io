/**
 * Modal de autenticación compartido.
 * Replica el flujo FirebaseUI de referencia: Google, Facebook, correo/contraseña,
 * Apple, Microsoft y Yahoo.
 */
(function () {
  'use strict';

  let root = null;
  let auth = null;
  let authUi = null;
  let lastFocused = null;
  let required = false;

  function element(tag, className, text) {
    const node = document.createElement(tag);
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

    const backdrop = element('button', 'oot-auth-modal__backdrop');
    backdrop.type = 'button';
    backdrop.setAttribute('aria-label', 'Cerrar ventana de inicio de sesión');

    const dialog = element('section', 'oot-auth-modal__dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'oot-auth-modal-title');

    const header = element('header', 'oot-auth-modal__header');
    var title = element('h2', 'oot-auth-modal__title', 'Iniciar sesión');
    title.id = 'oot-auth-modal-title';
    const closeButton = element('button', 'oot-auth-modal__close', '×');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Cerrar');

    const body = element('div', 'oot-auth-modal__body');
    const intro = element('p', 'oot-auth-modal__intro', 'Selecciona una opción para acceder a Colombia OT.');
    const loginContainer = element('div', 'oot-auth-modal__login');
    loginContainer.id = 'oot-auth-container';

    const session = element('div', 'oot-auth-modal__session');
    session.hidden = true;
    const avatar = element('img', 'oot-auth-modal__avatar');
    avatar.alt = 'Imagen de usuario';
    const name = element('p', 'oot-auth-modal__name');
    const email = element('p', 'oot-auth-modal__email');
    const logout = element('button', 'oot-auth-modal__logout', 'Cerrar sesión');
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
          // Sin scopes extra: 'plus.login' apuntaba a la API de Google+, apagada en
          // marzo de 2019. Pedir un scope inexistente solo puede romper el consentimiento.
          provider: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
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
    const parts = modal._elements;
    parts.loginContainer.hidden = Boolean(user);
    parts.intro.hidden = Boolean(user);
    parts.session.hidden = !user;
    if (!user) return;

    // Contra OOT_BASE, no contra la raiz del host: publicado bajo un subpath
    // (usuario.github.io/repo/) una ruta absoluta apunta fuera del sitio.
    parts.avatar.src = user.photoURL || ((window.OOT_BASE || '') + '/images/iconos/User.png');
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
