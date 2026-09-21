(function initializeVisibleValueFormatting() {
    "use strict";

    const POPUP_SELECTOR = ".esri-popup, .esri-popup__main-container, .esri-popup__content";
    const NUMBER_PATTERN = /-?\d+(?:[.,]\d{3})+[.,]\d{3,}|-?\d+[.,]\d{4,}/g;

    function repairMojibake(text) {
        if (typeof text !== "string" || !/[\u00c2\u00c3\u00e2]/.test(text)) return text;

        try {
            const bytes = Uint8Array.from(
                Array.from(text),
                (character) => character.charCodeAt(0) & 255
            );
            const repairedText = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
            return repairedText.includes("\uFFFD") ? text : repairedText;
        } catch {
            return text;
        }
    }

    function normalizeNumericText(text) {
        const hasPeriod = text.includes(".");
        const hasComma = text.includes(",");

        if (hasPeriod && hasComma) {
            const lastPeriodIndex = text.lastIndexOf(".");
            const lastCommaIndex = text.lastIndexOf(",");
            return lastCommaIndex > lastPeriodIndex
                ? text.replace(/\./g, "").replace(",", ".")
                : text.replace(/,/g, "");
        }

        return text.replace(",", ".");
    }

    function formatLocalizedNumber(text) {
        const number = Number(normalizeNumericText(text));
        if (!Number.isFinite(number)) return text;

        return new Intl.NumberFormat("es-CO", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(number);
    }

    function cleanVisibleText(text) {
        return repairMojibake(text)
            .replace(/km\s*(?:\u00c2\u00b2|\uFFFD|2)/gi, "km\u00b2")
            .replace(NUMBER_PATTERN, formatLocalizedNumber);
    }

    function formatArcGisPopup(popup) {
        const walker = document.createTreeWalker(popup, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let currentNode = walker.nextNode();

        while (currentNode) {
            textNodes.push(currentNode);
            currentNode = walker.nextNode();
        }

        textNodes.forEach((textNode) => {
            const cleanedText = cleanVisibleText(textNode.nodeValue || "");
            if (cleanedText !== textNode.nodeValue) textNode.nodeValue = cleanedText;
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        const popupObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === "characterData") {
                    const popup = mutation.target?.parentElement?.closest?.(POPUP_SELECTOR);
                    if (popup) formatArcGisPopup(popup);
                    return;
                }

                mutation.addedNodes.forEach((node) => {
                    if (!(node instanceof HTMLElement)) return;

                    if (node.matches(POPUP_SELECTOR)) {
                        formatArcGisPopup(node);
                        return;
                    }

                    node.querySelectorAll?.(POPUP_SELECTOR).forEach(formatArcGisPopup);
                });
            });
        });

        popupObserver.observe(document.body, {
            childList: true,
            characterData: true,
            subtree: true
        });
    });
})();

