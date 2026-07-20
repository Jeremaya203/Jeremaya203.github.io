export function initModuleDropdown(dropdownId, triggerId, menuSelector, onItemClick = null) {
    const dropdown = document.getElementById(dropdownId);
    const trigger = document.getElementById(triggerId);
    const menu = dropdown?.querySelector(menuSelector);
    const items = dropdown?.querySelectorAll(".dropdown-item, .dropdown-subitem");

    if (!dropdown || !trigger || !menu || !items?.length) return;

    function setOpen(isOpen) {
        dropdown.classList.toggle("open", isOpen);
        trigger.setAttribute("aria-expanded", String(isOpen));
    }

    function toggleDropdown(e) {
        e.stopPropagation();

        document.querySelectorAll(".modulo-dropdown.open").forEach(d => {
            if (d !== dropdown) {
                d.classList.remove("open");
                const otherTrigger = d.querySelector(".modulo-card-trigger");
                otherTrigger?.setAttribute("aria-expanded", "false");
            }
        });

        setOpen(!dropdown.classList.contains("open"));
    }

    trigger.onclick = toggleDropdown;

    trigger.onkeydown = function (e) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleDropdown(e);
        }
    };

    items.forEach(item => {
        item.onclick = function (e) {
            e.stopPropagation();

            items.forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            const target = item.dataset.target;

            if (typeof onItemClick === "function") {
                onItemClick(target, item);
            } else {
            }

            setOpen(false);
        };
    });
}

export function initDropdownDescargables() {
    const dropdown = document.getElementById("descargablesDropdown");
    const trigger = document.getElementById("btnDescargables");
    const panel = document.getElementById("descargablesMenu");
    const items = document.querySelectorAll(".descargables-menu .descargables-item");

    if (!dropdown || !trigger || !panel) {
        return;
    }

    function setDescargablesOpen(isOpen) {
        dropdown.classList.toggle("open", isOpen);
        trigger.setAttribute("aria-expanded", String(isOpen));
    }

    trigger.onclick = function (e) {
        e.stopPropagation();
        setDescargablesOpen(!dropdown.classList.contains("open"));
    };

    document.addEventListener("click", function (e) {
        if (!dropdown.contains(e.target)) {
            setDescargablesOpen(false);
        }
    });

    items.forEach(item => {
        item.onclick = function (e) {
            e.stopPropagation();

            const target = item.dataset.download;

            if (target === "memoria") {
                document.getElementById("btnDescargarPDF")?.click();
            } else if (target === "bd") {
            }

            setDescargablesOpen(false);
        };
    });
}
