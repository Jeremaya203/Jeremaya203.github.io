import { AppState } from "../app/state.js";

export function resetToColombia() {
    if (!AppState.view) return;

    AppState.view.goTo(
        {
            center: [-73.5, 4.5],
            zoom: 5
        },
        {
            duration: 700,
            easing: "ease-in-out"
        }
    );
}