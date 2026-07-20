export function actualizarLeyendaDepartamentosLimites() {
    const title = document.getElementById("legendTitle");
    const content = document.getElementById("legendContent");

    if (title) title.textContent = "Departamentos";
    if (!content) return;

    content.innerHTML = `
        <button class="legend-item limites-depto-legend-toggle active oot-js-limites-legendui-1" type="button" aria-pressed="true">
            <span class="oot-js-limites-legendui-2"></span>
            <span>Límite departamental</span>
        </button>
    `;
}

export function toggleLegend() {
    const content = document.getElementById("legendContent");
    const toggle = document.getElementById("legendToggle");
    if (!content || !toggle) return;

    const isCollapsed = content.classList.toggle("collapsed");
    toggle.textContent = isCollapsed ? "+" : "−";
}
