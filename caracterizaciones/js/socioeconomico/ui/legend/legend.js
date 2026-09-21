export function toggleLegend() {
    const content = document.getElementById("legendContent");
    const toggle = document.getElementById("legendToggle");

    if (!content || !toggle) return;

    if (content.classList.contains("collapsed")) {
        content.classList.remove("collapsed");
        toggle.textContent = "−";
    } else {
        content.classList.add("collapsed");
        toggle.textContent = "+";
    }
}