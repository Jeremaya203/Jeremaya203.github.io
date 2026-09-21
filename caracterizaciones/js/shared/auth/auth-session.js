/**
 * Sesión Firebase compartida.
 */
"use strict";

class AuthSession {
    constructor(windowRef) {
        this.window = windowRef;
        this.listeners = [];
        this.currentUser = null;
        this.ready = false;
        this.initialized = false;
    }

    notify(user) {
        this.currentUser = user;
        this.ready = true;

        // En Caracterizaciones el acceso también es obligatorio. El modal compartido
        // permanece abierto hasta que Firebase confirme una sesión válida.
        if (this.window.OOTAuthModal) {
            this.window.OOTAuthModal.setRequired(true);
            if (user) {
                this.window.OOTAuthModal.setCurrentUser(user);
            } else if (this.window.firebase && this.window.firebase.auth) {
                this.window.OOTAuthModal.open(this.window.firebase.auth());
            }
        }

        // Verificación de herencia de sesión: si llegas a esta página YA logueado sin haber
        // hecho clic aquí en "Iniciar sesión", la sesión se heredó desde el portal principal.
        console.log("[CaracterizacionesAuth] Estado de sesión en", this.window.location.pathname, "→",
            user ? ("logueado como " + (user.email || user.uid)) : "sin sesión");

        this.listeners.slice().forEach((listener) => {
            try {
                listener(user);
            } catch (error) {
                console.error("[CaracterizacionesAuth] Error en listener:", error);
            }
        });
    }

    init() {
        if (this.initialized) {
            return this;
        }

        const firebase = this.window.firebase;
        if (!firebase || !firebase.auth) {
            console.error("[CaracterizacionesAuth] Firebase Auth no está disponible.");
            this.notify(null);
            this.initialized = true;
            return this;
        }

        const config = this.window.CaracterizacionesFirebaseConfig;
        if (!config || !config.apiKey || !config.authDomain) {
            console.error("[CaracterizacionesAuth] Configuración Firebase incompleta.");
            this.notify(null);
            this.initialized = true;
            return this;
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(config);
        }

        firebase.auth().onAuthStateChanged(
            (user) => this.notify(user || null),
            (error) => {
                console.error("[CaracterizacionesAuth] onAuthStateChanged:", error);
                this.notify(null);
            }
        );

        this.initialized = true;
        return this;
    }

    onAuthStateChanged(listener) {
        if (typeof listener !== "function") {
            return function unsubscribeEmpty() {};
        }

        this.listeners.push(listener);

        if (this.ready) {
            listener(this.currentUser);
        }

        return () => {
            const index = this.listeners.indexOf(listener);
            if (index >= 0) {
                this.listeners.splice(index, 1);
            }
        };
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isReady() {
        return this.ready;
    }

    signOut() {
        const firebase = this.window.firebase;
        if (!firebase || !firebase.auth) {
            return Promise.reject(new Error("Firebase Auth no está disponible."));
        }

        return firebase.auth().signOut();
    }
}

window.AuthSession = AuthSession;
window.CaracterizacionesAuth = window.__caracterizacionesAuthSession
    || new AuthSession(window);
window.__caracterizacionesAuthSession = window.CaracterizacionesAuth;
