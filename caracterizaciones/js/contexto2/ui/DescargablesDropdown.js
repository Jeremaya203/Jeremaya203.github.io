export class DescargablesDropdown {
    constructor() {
        this.dropdown = document.getElementById('descargablesDropdown');
        this.trigger = document.getElementById('btnDescargables');
        this.menu = document.getElementById('descargablesMenu');
    }

    init() {
        if (!this.dropdown || !this.trigger || !this.menu) return;

        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dropdown.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (!this.dropdown.contains(e.target)) {
                this.dropdown.classList.remove('open');
            }
        });

        const items = this.menu.querySelectorAll('.descargables-item');
        items.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dropdown.classList.remove('open');
            });
        });
    }
}
