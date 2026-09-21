export function initScaleBar({ view, ScaleBar }) {
    const scaleBar = new ScaleBar({
        view,
        unit: "metric",
        style: "ruler"
    });

    view.ui.add(scaleBar, {
        position: "bottom-left"
    });

    return scaleBar;
}