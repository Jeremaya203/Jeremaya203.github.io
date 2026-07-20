/**
 * DomUtils.js — Utilidades de Manipulación del DOM
 *
 * Helpers para crear elementos, seleccionar y manipular el DOM
 * de forma más concisa.
 *
 * Responsabilidad:
 *   - createElement(tag, attrs, children): crea elemento con atributos
 *   - qs(selector): document.querySelector shorthand
 *   - qsa(selector): document.querySelectorAll shorthand
 *   - setText(id, text): atajo para actualizar textContent
 *
 * Dependencias:
 *   - Ninguna
 */
export class DomUtils {
    static qs(selector) {
        return document.querySelector(selector);
    }

    static qsa(selector) {
        return document.querySelectorAll(selector);
    }

    static setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    static createElement(tag, attrs = {}, children = []) {
        const el = document.createElement(tag);
        Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
        children.forEach(child => {
            if (typeof child === 'string') el.appendChild(document.createTextNode(child));
            else el.appendChild(child);
        });
        return el;
    }

    static show(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'block';
    }

    static hide(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    }
}
