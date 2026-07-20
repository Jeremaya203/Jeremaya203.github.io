/**
 * Enlaza la sesión Firebase con la navbar (#loginBtn, #userName, #logoutBtn).
 */
"use strict";

class AuthNavbar {
    constructor(windowRef, documentRef) {
        this.window = windowRef;
        this.document = documentRef;
        this.textValidating = "Validando sesión...";
        this.textLogin = "Iniciar sesión";
        this.textLogout = "Cerrar sesión";
        this.bound = false;
    }

    setText(element, value) {
        if (element) {
            element.textContent = value == null ? "" : String(value);
        }
    }

    ensureLogoutButton(loginBtn) {
        const existing = this.document.getElementById("logoutBtn");
        if (existing) {
            return existing;
        }

        const parent = loginBtn && loginBtn.parentElement;
        if (!parent) {
            return null;
        }

        parent.classList.add("auth-nav-item");

        const logoutBtn = this.document.createElement("button");
        logoutBtn.type = "button";
        logoutBtn.id = "logoutBtn";
        logoutBtn.className = "auth-logout-btn";
        logoutBtn.hidden = true;
        logoutBtn.setAttribute("aria-label", this.textLogout);
        this.setText(logoutBtn, this.textLogout);
        parent.appendChild(logoutBtn);
        return logoutBtn;
    }

    ensureEmailElement(loginBtn) {
        const existing = this.document.getElementById("userEmail");
        if (existing) {
            return existing;
        }

        if (!loginBtn) {
            return null;
        }

        const emailEl = this.document.createElement("span");
        emailEl.id = "userEmail";
        emailEl.className = "auth-user-email";
        emailEl.hidden = true;
        loginBtn.appendChild(emailEl);
        return emailEl;
    }

    renderAuthenticated(user, elements) {
        const displayName = user.displayName || user.email || "Usuario";
        const email = user.email || "";

        this.setText(elements.userName, displayName);
        this.setText(elements.userEmail, email);

        if (elements.userEmail) {
            elements.userEmail.hidden = !email || email === displayName;
        }

        if (elements.loginBtn) {
            elements.loginBtn.setAttribute("aria-label", "Sesión activa");
            elements.loginBtn.setAttribute("title", email || displayName);
            elements.loginBtn.classList.add("auth-logged-in");
            elements.loginBtn.classList.remove("auth-logged-out");
        }

        if (elements.logoutBtn) {
            elements.logoutBtn.hidden = false;
        }
    }

    renderAnonymous(elements) {
        this.setText(elements.userName, this.textLogin);
        this.setText(elements.userEmail, "");

        if (elements.userEmail) {
            elements.userEmail.hidden = true;
        }

        if (elements.loginBtn) {
            elements.loginBtn.setAttribute("aria-label", this.textLogin);
            elements.loginBtn.removeAttribute("title");
            elements.loginBtn.classList.add("auth-logged-out");
            elements.loginBtn.classList.remove("auth-logged-in");
        }

        if (elements.logoutBtn) {
            elements.logoutBtn.hidden = true;
        }
    }

    bind() {
        if (this.bound) {
            return;
        }

        const auth = this.window.CaracterizacionesAuth;
        if (!auth) {
            console.error("[authNavbar] CaracterizacionesAuth no está disponible.");
            return;
        }

        const loginBtn = this.document.getElementById("loginBtn");
        const userName = this.document.getElementById("userName");
        if (!loginBtn || !userName) {
            return;
        }

        this.bound = true;
        const elements = {
            loginBtn,
            userName,
            userEmail: this.ensureEmailElement(loginBtn),
            logoutBtn: this.ensureLogoutButton(loginBtn)
        };

        this.setText(userName, this.textValidating);
        loginBtn.setAttribute("aria-label", this.textValidating);
        loginBtn.classList.add("auth-validating");

        // Mismo proyecto Firebase (geovisor-igac) que el portal principal — popup directo
        // con Google, sin FirebaseUI/jQuery (no cargados aquí).
        loginBtn.addEventListener("click", (event) => {
            event.preventDefault();
            if (auth.getCurrentUser()) {
                return;
            }

            const firebase = this.window.firebase;
            if (!firebase || !firebase.auth) {
                console.error("[authNavbar] Firebase Auth no está disponible.");
                return;
            }

            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: "select_account" });
            firebase.auth().signInWithPopup(provider).catch((error) => {
                console.error("[authNavbar] Error en signInWithPopup:", error);
            });
        });

        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener("click", () => {
                elements.logoutBtn.disabled = true;
                auth.signOut()
                    .catch((error) => {
                        console.error("[authNavbar] Error al cerrar sesión:", error);
                    })
                    .then(() => {
                        elements.logoutBtn.disabled = false;
                    });
            });
        }

        auth.init();
        auth.onAuthStateChanged((user) => {
            loginBtn.classList.remove("auth-validating");
            if (user) {
                this.renderAuthenticated(user, elements);
            } else {
                this.renderAnonymous(elements);
                // Redireccionar si no está logeado (excepto si estamos en la landing del módulo)
                const path = this.window.location.pathname;
                if (!path.endsWith("index.html") && path !== "/" && path !== "") {
                    console.log("[authNavbar] Usuario no autenticado, redireccionando a index.html");
                    this.window.location.href = "index.html";
                }
            }
        });
    }
}

window.AuthNavbar = AuthNavbar;
window.CaracterizacionesAuthNavbar = window.__caracterizacionesAuthNavbar
    || new AuthNavbar(window, document);
window.__caracterizacionesAuthNavbar = window.CaracterizacionesAuthNavbar;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        window.CaracterizacionesAuthNavbar.bind();
    });
} else {
    window.CaracterizacionesAuthNavbar.bind();
}
