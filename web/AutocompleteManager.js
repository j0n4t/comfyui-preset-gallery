export default class AutocompleteManager {
    constructor({
        input,
        container,
        popupClass = "j0n4t-pg-autocomplete-popup",
        itemClass = "j0n4t-pg-autocomplete-item",
        getMatches,
        renderItem,
        onSelect,
        onKeyDown,
        onBlur,
    }) {
        this.input = input;
        this.container = container || document.body;
        this.popupClass = popupClass;
        this.itemClass = itemClass;
        this.getMatches = getMatches;
        this.renderItem = renderItem;
        this.onSelect = onSelect;
        this.onKeyDown = onKeyDown;
        this.onBlur = onBlur;

        this.popupEl = null;
        this.matches = [];
        this.activeIndex = 0;

        this.initEvents();
    }

    get isOpen() {
        return !!this.popupEl;
    }

    initEvents() {
        this.input.addEventListener("input", () => this.evaluate());
        this.input.addEventListener("click", () => this.close());
        this.input.addEventListener("blur", () => {
            if (this.onBlur) this.onBlur();
            setTimeout(() => this.close(), 200);
        });
        this.input.addEventListener("keydown", (e) => this.handleKeydown(e));
    }

    evaluate() {
        const query = this.input.value;
        const cursor = this.input.selectionStart;

        this.matches = this.getMatches(query, cursor) || [];

        if (!this.matches.length) {
            this.close();
            return;
        }

        this.activeIndex = 0;
        this.renderPopup();
    }

    renderPopup() {
        if (!this.popupEl) {
            this.popupEl = Object.assign(document.createElement("div"), {
                className: this.popupClass,
            });
            this.popupEl.addEventListener("mousedown", (e) => e.stopPropagation());
            this.container.appendChild(this.popupEl);
        }

        const rect = this.input.getBoundingClientRect();
        const cRect = this.container.getBoundingClientRect();
        const zoom = cRect.width / this.container.offsetWidth || 1;

        const isBody = this.container === document.body;
        const top = isBody
            ? window.scrollY + rect.bottom
            : (rect.bottom - cRect.top) / zoom;
        const left = isBody
            ? window.scrollX + rect.left
            : (rect.left - cRect.left) / zoom;

        this.popupEl.style.top = `${top + 2}px`;
        this.popupEl.style.left = `${left}px`;
        this.popupEl.style.minWidth = `${Math.max(200, rect.width / zoom)}px`;
        this.popupEl.innerHTML = "";

        this.matches.forEach((match, idx) => {
            const row = document.createElement("div");
            row.className = `${this.itemClass}${idx === this.activeIndex ? " active" : ""}`;
            row.innerHTML = this.renderItem(match);

            row.addEventListener("mousedown", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.onSelect(match, e);
                this.close();
            });
            this.popupEl.appendChild(row);
        });
    }

    highlight() {
        if (!this.popupEl) return;
        this.popupEl
            .querySelectorAll(`.${this.itemClass.split(" ")[0]}`)
            .forEach((item, i) => {
                item.classList.toggle("active", i === this.activeIndex);
            });
    }

    handleKeydown(e) {
        const activeMatch = this.matches[this.activeIndex];

        if (this.onKeyDown && this.onKeyDown(e, activeMatch)) {
            if (this.isOpen) this.close();
            return;
        }

        if (!this.isOpen || !this.matches.length) return;

        if (["Tab", "Enter"].includes(e.key) && !e.ctrlKey) {
            e.preventDefault();
            this.onSelect(activeMatch, e);
            this.close();
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            this.activeIndex = (this.activeIndex + 1) % this.matches.length;
            this.highlight();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            this.activeIndex =
                (this.activeIndex - 1 + this.matches.length) % this.matches.length;
            this.highlight();
        } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            this.close();
        }
    }

    close() {
        this.popupEl?.remove();
        this.popupEl = null;
        this.matches = [];
    }
}