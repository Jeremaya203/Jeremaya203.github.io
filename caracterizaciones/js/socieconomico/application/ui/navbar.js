export function createNavbarController() {
    function updateNavbarActive(mode) {
        document.querySelectorAll("#navbar button").forEach(button => button.classList.remove("active"));
    }

    return {
        updateNavbarActive
    };
}
