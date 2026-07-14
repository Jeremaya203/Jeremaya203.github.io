function isExpectedSourceError(error) {
    const name = String(error?.name || "").toLowerCase();
    const message = String(error?.message || error || "").toLowerCase();
    return name === "aborterror" ||
        message.includes("aborted") ||
        message.includes("service") && message.includes("not started");
}

export function actualizarFuente(layer) {
    if (!layer) return;

    layer.queryFeatures({
        where: "1=1",
        outFields: ["Fuente"],
        num: 1,
        returnGeometry: false
    }).then((result) => {

        if (result.features.length > 0) {

            const fuente = result.features[0].attributes.Fuente;
            const fuenteDiv = document.getElementById("mapSource");

            if (fuenteDiv) {
                fuenteDiv.textContent = "Fuente: " + fuente;
            }
        }
    }).catch(error => {
        if (isExpectedSourceError(error)) return;
        console.error("actualizarFuente error:", error);
    });
}
