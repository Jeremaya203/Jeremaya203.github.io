"use strict";

const DESCARGABLES_PAGE_CONFIG = Object.freeze({
    "biofisico.html": { theme: "Biofísico", message: "Preparando...", accent: "#0c755a" },
    "limites.html": { theme: "Límites", message: "Preparando...", accent: "#9a5a23" },
    "ordenamiento.html": { theme: "Ordenamiento territorial", message: "Preparando...", accent: "#6b4693" },
    "contexto.html": { theme: "Contexto legal", message: "Preparando...", accent: "#d1322a" },
    "ocupacion.html": { theme: "Ocupación", message: "Preparando...", accent: "#1e78c8" },
    "socioeconomico.html": { theme: "Socioeconómico", message: "Preparando...", accent: "#a66a11" }
});

const DESCARGABLES_DEFAULT_CONFIG = Object.freeze({
    theme: "Caracterizaciones territoriales",
    message: "Preparando...",
    accent: "#005b75"
});

const CUBARA_TECHNICAL_REPORT = Object.freeze({
    municipalityCode: "15223",
    url: "data/15223.pdf",
    filename: "15223.pdf",
    delay: 2500
});

class DescargablesModal {
    constructor(windowRef, documentRef) {
        this.window = windowRef;
        this.document = documentRef;
        this.activeDialog = null;
        this.previousFocus = null;
        this.downloadTimer = null;
        this.initialized = false;
        this.handleDownloadOptionClick = this.handleDownloadOptionClick.bind(this);
        this.handleDialogKeydown = this.handleDialogKeydown.bind(this);
        this.close = this.close.bind(this);
    }

    initialize() {
        if (this.initialized) {
            return this;
        }

        const currentPageConfig = this.getCurrentConfig();
        this.document.documentElement.style.setProperty(
            "--descargables-theme-color",
            currentPageConfig.accent
        );
        this.document.addEventListener("click", this.handleDownloadOptionClick, true);
        this.initialized = true;
        return this;
    }

    getCurrentConfig() {
        const pageName = this.window.location.pathname.split("/").pop().toLowerCase();
        return DESCARGABLES_PAGE_CONFIG[pageName] || DESCARGABLES_DEFAULT_CONFIG;
    }

    closeDropdown(trigger) {
        const dropdown = trigger.closest(".descargables-dropdown");
        dropdown?.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
    }

    validateTerritorialSelection() {
        const departamento = this.document.getElementById("departamentos");
        const municipio = this.document.getElementById("municipios");
        const hasDepartamento = Boolean(departamento?.value?.trim());
        const hasMunicipio = Boolean(municipio?.value?.trim());

        if (!hasDepartamento) {
            return {
                valid: false,
                message: "Seleccione un departamento y un municipio para poder descargar."
            };
        }

        if (!hasMunicipio) {
            return {
                valid: false,
                message: "Seleccione un municipio para poder descargar."
            };
        }

        return { valid: true, message: "" };
    }

    handleDialogKeydown(event) {
        if (event.key === "Escape") {
            event.preventDefault();
            this.close();
        }
    }

    close(options = {}) {
        if (!this.activeDialog) {
            return;
        }

        if (this.downloadTimer) {
            this.window.clearTimeout(this.downloadTimer);
            this.downloadTimer = null;
        }

        const { overlay, closeButton, handleOverlayClick } = this.activeDialog;
        closeButton.removeEventListener("click", this.close);
        overlay.removeEventListener("click", handleOverlayClick);
        this.document.removeEventListener("keydown", this.handleDialogKeydown);
        overlay.remove();
        this.activeDialog = null;

        if (options.restoreFocus !== false
            && this.previousFocus instanceof this.window.HTMLElement) {
            this.previousFocus.focus({ preventScroll: true });
        }
        this.previousFocus = null;
    }

    getDownloadRequest(option) {
        const municipalityCode = String(
            this.document.getElementById("municipios")?.value || ""
        ).trim();

        if (option?.id !== "btnMemoriaTecnica"
            || municipalityCode !== CUBARA_TECHNICAL_REPORT.municipalityCode) {
            return null;
        }

        return CUBARA_TECHNICAL_REPORT;
    }

    startDownload(dialogState, request) {
        if (!request || this.activeDialog !== dialogState) {
            return;
        }

        const anchor = this.document.createElement("a");
        anchor.href = request.url;
        anchor.download = request.filename;
        anchor.hidden = true;
        this.document.body.append(anchor);
        anchor.click();
        anchor.remove();

        dialogState.spinner.className = "descargables-modal-success";
        dialogState.spinner.textContent = "✓";
        dialogState.title.textContent = "Descarga iniciada";
        dialogState.message.textContent = "La memoria técnica de Cubará, Boyacá se está descargando.";
        this.downloadTimer = null;
    }

    scheduleDownload(dialogState, request) {
        if (!request) {
            return;
        }

        this.downloadTimer = this.window.setTimeout(() => {
            this.startDownload(dialogState, request);
        }, request.delay);
    }

    open(trigger, optionLabel = "Descargables", validation, downloadRequest = null) {
        if (this.activeDialog) {
            this.activeDialog.closeButton.focus({ preventScroll: true });
            return;
        }

        const currentValidation = validation || this.validateTerritorialSelection();
        this.closeDropdown(trigger);
        this.previousFocus = this.document.activeElement;

        const config = this.getCurrentConfig();
        const overlay = this.document.createElement("div");
        const dialog = this.document.createElement("section");
        const closeButton = this.document.createElement("button");
        const spinner = this.document.createElement("div");
        const content = this.document.createElement("div");
        const title = this.document.createElement("h2");
        const message = this.document.createElement("p");
        const titleId = "descargables-modal-title";
        const messageId = "descargables-modal-message";

        overlay.className = "descargables-modal-overlay";
        dialog.className = "descargables-modal";
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("aria-labelledby", titleId);
        dialog.setAttribute("aria-describedby", messageId);
        dialog.dataset.theme = config.theme;
        dialog.style.setProperty("--descargables-accent", config.accent);

        closeButton.className = "descargables-modal-close";
        closeButton.type = "button";
        closeButton.setAttribute("aria-label", "Cerrar mensaje de descargables");
        closeButton.title = "Cerrar";
        closeButton.textContent = "×";

        spinner.className = currentValidation.valid
            ? "descargables-modal-spinner"
            : "descargables-modal-notice";
        spinner.setAttribute("aria-hidden", "true");
        if (!currentValidation.valid) {
            spinner.textContent = "!";
        }

        content.className = "descargables-modal-content";
        title.className = "descargables-modal-title";
        title.id = titleId;
        title.textContent = currentValidation.valid
            ? `${optionLabel} - ${config.theme}`
            : "Selección requerida";
        message.className = "descargables-modal-message";
        message.id = messageId;
        message.setAttribute("aria-live", "polite");
        message.textContent = currentValidation.valid ? config.message : currentValidation.message;

        content.append(title, message);
        dialog.append(closeButton, spinner, content);
        overlay.append(dialog);

        const handleOverlayClick = (event) => {
            if (event.target === overlay) {
                this.close();
            }
        };

        const dialogState = {
            overlay,
            closeButton,
            handleOverlayClick,
            spinner,
            title,
            message
        };
        this.activeDialog = dialogState;
        closeButton.addEventListener("click", this.close);
        overlay.addEventListener("click", handleOverlayClick);
        this.document.addEventListener("keydown", this.handleDialogKeydown);
        this.document.body.append(overlay);
        closeButton.focus({ preventScroll: true });
        if (currentValidation.valid) {
            this.scheduleDownload(dialogState, downloadRequest);
        }
    }

    findDownloadOption(event) {
        return event.target instanceof this.window.Element
            ? event.target.closest(".descargables-menu .descargables-item")
            : null;
    }

    handleDownloadOptionClick(event) {
        const option = this.findDownloadOption(event);
        if (!option) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        const dropdown = option.closest(".descargables-dropdown");
        const trigger = dropdown?.querySelector("#btnDescargables") || option;
        const optionLabel = option.textContent.trim() || "Descargables";
        const validation = this.validateTerritorialSelection();
        const downloadRequest = validation.valid
            ? this.getDownloadRequest(option)
            : null;
        this.closeDropdown(trigger);
        this.open(trigger, optionLabel, validation, downloadRequest);
    }

    destroy() {
        this.document.removeEventListener("click", this.handleDownloadOptionClick, true);
        this.close({ restoreFocus: false });
        this.initialized = false;

        if (this.window.DescargablesModal === this) {
            delete this.window.DescargablesModal;
        }
    }
}

window.DescargablesModalClass = DescargablesModal;
if (!window.DescargablesModal
    || typeof window.DescargablesModal.initialize !== "function") {
    window.DescargablesModal = new DescargablesModal(window, document);
}
window.DescargablesModal.initialize();
