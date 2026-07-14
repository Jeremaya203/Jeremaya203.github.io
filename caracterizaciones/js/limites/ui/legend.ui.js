export function actualizarLeyendaDepartamentosLimites() {
    const title = document.getElementById("legendTitle");
    const content = document.getElementById("legendContent");

    if (title) title.textContent = "Departamentos";
    if (!content) return;

    content.innerHTML = `
        <button class="legend-item limites-depto-legend-toggle active" type="button" aria-pressed="true" style="display:flex;align-items:center;gap:8px;color:black;background:transparent;border:1px solid transparent;border-radius:6px;padding:4px 5px;cursor:pointer;width:100%;text-align:left;">
            <span style="width:14px;height:14px;display:inline-block;background:rgba(245,245,245,0.4);border:2px solid rgba(76,0,115,1);"></span>
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
