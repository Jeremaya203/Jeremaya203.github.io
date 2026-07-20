export class DropdownManager {
    constructor({ root = document, eventBus }) {
        this.root = root;
        this.eventBus = eventBus;
    }

    closeAll() {
        this.root.querySelectorAll(".modulo-dropdown.open").forEach(dropdown => {
            dropdown.classList.remove("open");
        });
    }

    bind(dropdownId, onSelect) {
        const dropdown = this.root.getElementById(dropdownId);
        if (!dropdown) return;

        dropdown.querySelectorAll(".dropdown-item").forEach(item => {
            item.addEventListener("click", event => {
                event.stopPropagation();
                const target = item.dataset.target;
                onSelect?.(target, item);
                this.eventBus?.emit("ui:dropdown-selected", { dropdownId, target });
                this.closeAll();
            });
        });
    }
}
