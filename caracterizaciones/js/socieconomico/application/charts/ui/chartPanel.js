export function setChartTitle(title) {
    const globalTitle = document.getElementById("chartTitle");
    if (globalTitle) globalTitle.textContent = "";

    const normalize = value => String(value || "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const activeEconomicSubitemLabel = document.querySelector("#economicActivitiesSubitemTabs .chart-switch-tab.active")?.textContent;
    const text = normalize(title) && normalize(title) === normalize(activeEconomicSubitemLabel)
        ? ""
        : String(title || "").trim();
    const canvas = document.getElementById("chart");
    const wrapper = canvas?.closest(".attr-category-chart-canvas-wrap") || document.getElementById("pibChartScroll")?.parentNode || canvas?.parentNode;
    if (!wrapper) return;

    let titleElement = document.getElementById("mainChartLocalTitle");
    if (!titleElement) {
        titleElement = document.createElement("h3");
        titleElement.id = "mainChartLocalTitle";
        titleElement.className = "chart-local-title";
        wrapper.insertBefore(titleElement, wrapper.firstChild);
    } else if (titleElement.parentNode !== wrapper) {
        wrapper.insertBefore(titleElement, wrapper.firstChild);
    }

    titleElement.textContent = text;
    titleElement.hidden = !text;
}

export function ensureChartScrollContainer(canvas) {
    let container = document.getElementById("pibChartScroll");
    if (!container) {
        container = document.createElement("div");
        container.id = "pibChartScroll";
        container.className = "pib-chart-scroll";
        canvas.parentNode.insertBefore(container, canvas);
        container.appendChild(canvas);
    } else if (canvas.parentNode !== container) {
        container.appendChild(canvas);
    }
    return container;
}

export function prepareVisibleChartCanvas(canvas, chartConfig = null) {
    const chartDiv = document.getElementById("chartDiv");
    const chartCard = canvas.closest(".chart-card");
    const chartScroll = ensureChartScrollContainer(canvas);
    const chartWrap = canvas.closest(".chart-card-wrap");
    const geoformasCharts = document.getElementById("geoformasCharts");
    const canvasHeight = Number.isFinite(chartConfig?.canvasHeight) ? chartConfig.canvasHeight : 345;

    if (geoformasCharts) geoformasCharts.style.display = "none";
    if (chartDiv) chartDiv.style.display = "block";
    if (chartWrap) chartWrap.style.display = "block";
    if (chartCard) {
        chartCard.classList.add("chart-ready");
        chartCard.style.display = "block";
        chartCard.style.position = "relative";
        chartCard.style.minHeight = "455px";
        chartCard.style.overflowY = "visible";
        chartCard.style.overflowX = chartConfig?.disableHorizontalScroll ? "hidden" : "visible";
    }
    if (chartScroll) {
        chartScroll.style.display = "block";
        chartScroll.style.overflowX = chartConfig?.disableHorizontalScroll ? "hidden" : "auto";
        chartScroll.classList.toggle("is-scrollable", !chartConfig?.disableHorizontalScroll);
    }

    canvas.style.display = "block";
    canvas.style.visibility = "visible";
    canvas.style.opacity = "1";
    canvas.style.setProperty("width", "100%", "important");
    canvas.style.setProperty("max-width", "100%", "important");
    canvas.style.setProperty("min-width", chartConfig?.disableHorizontalScroll ? "0px" : "100%", "important");
    canvas.style.setProperty("height", `${canvasHeight}px`, "important");
    canvas.style.setProperty("min-height", `${canvasHeight}px`, "important");
    canvas.style.setProperty("max-height", "none", "important");

    const parentWidth = chartScroll?.clientWidth || chartCard?.clientWidth || chartDiv?.clientWidth || canvas.clientWidth || 360;
    canvas.width = Math.max(320, Math.floor(parentWidth));
    canvas.height = canvasHeight;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
        console.warn("Canvas no visible, forzando repaint");
    }

    return rect;
}

export function enableChartGrabScroll(container) {
    if (!container || container.dataset.grabScrollBound === "1") return;
    container.dataset.grabScrollBound = "1";

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    container.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        if (event.target?.dataset?.chartLegendInteractive === "1") return;
        isDragging = true;
        startX = event.clientX;
        startY = event.clientY;
        startScrollLeft = container.scrollLeft;
        startScrollTop = container.scrollTop;
        container.style.cursor = "grabbing";
        container.setPointerCapture?.(event.pointerId);
    });

    container.addEventListener("pointermove", event => {
        if (!isDragging) return;
        container.scrollLeft = startScrollLeft - (event.clientX - startX);
        container.scrollTop = startScrollTop - (event.clientY - startY);
    });

    const stopDragging = event => {
        if (!isDragging) return;
        isDragging = false;
        container.style.cursor = container.scrollHeight > container.clientHeight || container.scrollWidth > container.clientWidth
            ? "grab"
            : "default";
        container.releasePointerCapture?.(event.pointerId);
    };

    container.addEventListener("pointerup", stopDragging);
    container.addEventListener("pointercancel", stopDragging);
    container.addEventListener("pointerleave", stopDragging);
}

export function configureScrollableChartViewport(canvas, {
    contentHeight = 345,
    viewportHeight = 420,
    allowHorizontal = false
} = {}) {
    const container = ensureChartScrollContainer(canvas);
    if (!container) return null;

    enableChartGrabScroll(container);
    container.style.maxHeight = `${viewportHeight}px`;
    container.style.overflowY = contentHeight > viewportHeight ? "auto" : "hidden";
    container.style.overflowX = allowHorizontal ? "auto" : "hidden";
    container.style.cursor = contentHeight > viewportHeight || (allowHorizontal && container.scrollWidth > container.clientWidth)
        ? "grab"
        : "default";

    canvas.style.height = `${contentHeight}px`;
    canvas.style.minHeight = `${contentHeight}px`;
    canvas.height = Math.round(contentHeight);
    return container;
}
