export class LegendRenderer {
    constructor({
        contentId = "legendContent",
        titleId = "legendTitle",
        getLegendState = () => ({ allCodes: [], activeCodes: new Set() }),
        setLegendState = () => {}
    } = {}) {
        this.content = document.getElementById(contentId);
        this.title = document.getElementById(titleId);
        this.getLegendState = getLegendState;
        this.setLegendState = setLegendState;
    }

    setTitle(titleText = "Leyenda") {
        if (this.title) this.title.textContent = titleText;
    }

    syncToLabelSelection(clickedLabel) {
        if (!this.content) return;

        const items = Array.from(this.content.querySelectorAll(".legend-item"));
        if (!items.length) return;

        const target = this._normalize(clickedLabel);
        const hit = items.find(item => {
            const label = item.querySelector(".legend-label")?.textContent;
            return this._normalize(label) === target;
        });

        if (!hit) return;

        const legendState = this.getLegendState() || { allCodes: [], activeCodes: new Set() };

        const isAlreadySingle =
            legendState.activeCodes?.size === 1 &&
            legendState.activeCodes.has(String(hit.dataset.code));

        if (isAlreadySingle) {
            items.forEach(item => item.classList.remove("off"));
            legendState.activeCodes = new Set(items.map(item => String(item.dataset.code)));
            this.setLegendState(legendState);
            if (typeof applyWhereToActiveLayers === "function") applyWhereToActiveLayers(whereBase);
            return;
        }

        items.forEach(item => item.classList.toggle("off", item !== hit));
        legendState.activeCodes = new Set([String(hit.dataset.code)]);
        this.setLegendState(legendState);
    }

    renderLimitesMunicipales() {
        this.setTitle("Líneas limítrofes");
        if (!this.content) return;

        this.content.innerHTML = `
            <div class="oot-js-ocupacion-legend-1">
                <span class="oot-js-ocupacion-legend-2"></span>
                <span class="oot-js-ocupacion-legend-3">Líneas del municipio filtrado</span>
            </div>
        `;
    }

    _normalize(value) {
        if (value === null || value === undefined) return "";
        return String(value)
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }
}
