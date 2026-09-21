function isExpectedSourceError(error) {
    const name = String(error?.name || "").toLowerCase();
    const message = String(error?.message || error || "").toLowerCase();
    return name === "aborterror" ||
        message.includes("aborted") ||
        message.includes("service") && message.includes("not started");
}

export function updateSource(layer) {
    if (!layer) return;

    layer.queryFeatures({
        where: "1=1",
        outFields: ["Fuente"],
        num: 1,
        returnGeometry: false
    }).then((result) => {

        if (result.features.length > 0) {

            const sourceName = result.features[0].attributes.Fuente;
            const sourceElement = document.getElementById("mapSource");

            if (sourceElement) {
                sourceElement.textContent = "Fuente: " + sourceName;
            }
        }
    }).catch(error => {
        if (isExpectedSourceError(error)) return;
        console.error("updateSource error:", error);
    });
}
