class TextManager {
    constructor(overlayContainer) {
        this.overlayContainer = overlayContainer;
        this.textElements = [];
        this.nextId = 1;
        // Shared drag handlers to avoid listener accumulation
        this._onMouseMove = this._handleDrag.bind(this, 'mouse');
        this._onMouseUp = this._handleDragEnd.bind(this);
        this._onTouchMove = this._handleDrag.bind(this, 'touch');
        this._onTouchEnd = this._handleDragEnd.bind(this);
        this._dragging = null;
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('mouseup', this._onMouseUp);
        document.addEventListener('touchmove', this._onTouchMove);
        document.addEventListener('touchend', this._onTouchEnd);
    }

    static get FONTS() {
        return [
            { value: 'Playfair Display', label: 'Playfair Display' },
            { value: 'Bebas Neue', label: 'Bebas Neue' },
            { value: 'Montserrat', label: 'Montserrat' },
            { value: 'Raleway', label: 'Raleway' },
            { value: 'Oswald', label: 'Oswald' },
            { value: 'Josefin Sans', label: 'Josefin Sans' },
            { value: 'Lora', label: 'Lora' },
            { value: 'Cormorant Garamond', label: 'Cormorant Garamond' },
            { value: 'Abril Fatface', label: 'Abril Fatface' },
            { value: 'Dancing Script', label: 'Dancing Script' },
            { value: 'Georgia', label: 'Georgia' },
            { value: 'Arial', label: 'Arial' },
            { value: 'Times New Roman', label: 'Times New Roman' },
            { value: 'Courier New', label: 'Courier New' }
        ];
    }

    // Escape HTML to prevent XSS when building control panel
    static _esc(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    addTextElement(text = 'New Text', options = {}) {
        const id = `text-${this.nextId++}`;
        const element = {
            id,
            text,
            y: options.y || 50,
            fontSize: options.fontSize || 16,
            fontFamily: options.fontFamily || 'Montserrat',
            color: options.color || '#000000',
            alignment: options.alignment || 'center'
        };

        this.textElements.push(element);
        this._createDOMElement(element);
        this.updateControlPanel();
        return element;
    }

    _createDOMElement(element) {
        const div = document.createElement('div');
        div.className = 'draggable-text';
        div.id = element.id;
        div.textContent = element.text;
        div.style.top = `${element.y}px`;
        div.style.fontSize = `${element.fontSize}px`;
        div.style.fontFamily = element.fontFamily;
        div.style.color = element.color;
        div.style.textAlign = element.alignment;

        // Per-element start handlers (lightweight, removed on teardown)
        div.addEventListener('mousedown', e => this._handleDragStart(element, e));
        div.addEventListener('touchstart', e => this._handleDragStart(element, e));
        this.overlayContainer.appendChild(div);
    }

    _handleDragStart(element, e) {
        const div = document.getElementById(element.id);
        if (!div) return;
        div.classList.add('dragging');
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        this._dragging = { element, div, startY: clientY, initialY: element.y };
        e.preventDefault();
    }

    _handleDrag(type, e) {
        if (!this._dragging) return;
        const { element, div, startY, initialY } = this._dragging;
        const clientY = type === 'mouse' ? e.clientY : (e.touches ? e.touches[0].clientY : 0);
        // Clamp within overlay
        const maxY = this.overlayContainer.clientHeight - 20;
        element.y = Math.max(0, Math.min(initialY + (clientY - startY), maxY));
        div.style.top = `${element.y}px`;
    }

    _handleDragEnd() {
        if (!this._dragging) return;
        this._dragging.div.classList.remove('dragging');
        this._dragging = null;
    }

    updateTextElement(id, properties) {
        const element = this.textElements.find(el => el.id === id);
        if (!element) return;
        Object.assign(element, properties);
        const div = document.getElementById(id);
        if (div) {
            if (properties.text !== undefined) div.textContent = properties.text;
            if (properties.fontSize !== undefined) div.style.fontSize = `${properties.fontSize}px`;
            if (properties.fontFamily !== undefined) div.style.fontFamily = properties.fontFamily;
            if (properties.color !== undefined) div.style.color = properties.color;
            if (properties.alignment !== undefined) div.style.textAlign = properties.alignment;
        }
    }

    removeTextElement(id) {
        const index = this.textElements.findIndex(el => el.id === id);
        if (index === -1) return;
        this.textElements.splice(index, 1);
        const div = document.getElementById(id);
        if (div) div.remove();
        this.updateControlPanel();
    }

    updateControlPanel() {
        const container = document.getElementById('textElements');
        if (!container) return;
        container.textContent = ''; // safe clear (not innerHTML)

        this.textElements.forEach(element => {
            const item = document.createElement('div');
            item.className = 'text-element-item';

            // --- Header row ---
            const header = document.createElement('div');
            header.className = 'text-item-header';

            const label = document.createElement('span');
            label.className = 'text-item-label';
            label.textContent = element.text.length > 28 ? element.text.slice(0, 28) + '…' : element.text;
            header.appendChild(label);

            const editBtn = document.createElement('button');
            editBtn.className = 'btn-icon-sm text-edit-toggle';
            editBtn.title = 'Edit';
            editBtn.innerHTML = '<svg viewBox="0 0 24 24" width="11" height="11"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>';
            header.appendChild(editBtn);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-icon-sm text-remove-toggle';
            removeBtn.title = 'Remove';
            removeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="11" height="11"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>';
            header.appendChild(removeBtn);

            item.appendChild(header);

            // --- Edit body ---
            const body = document.createElement('div');
            body.className = 'text-item-body';
            body.style.display = 'none';

            const fields = [
                { label: 'Text', type: 'text', value: element.text, prop: null },
                { label: 'Font', type: 'select', value: element.fontFamily, prop: 'fontFamily', options: TextManager.FONTS },
                { label: 'Size', type: 'number', value: element.fontSize, prop: 'fontSize', min: 8, max: 72 },
                { label: 'Align', type: 'select', value: element.alignment, prop: 'alignment', options: [
                    { value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }
                ]},
                { label: 'Color', type: 'color', value: element.color, prop: 'color' }
            ];

            fields.forEach(f => {
                const row = document.createElement('div');
                row.className = 'text-edit-row';
                const lbl = document.createElement('label');
                lbl.textContent = f.label;
                row.appendChild(lbl);

                let input;
                if (f.type === 'select') {
                    input = document.createElement('select');
                    f.options.forEach(opt => {
                        const o = document.createElement('option');
                        o.value = opt.value;
                        o.textContent = opt.label;
                        if (opt.value === f.value) o.selected = true;
                        input.appendChild(o);
                    });
                } else {
                    input = document.createElement('input');
                    input.type = f.type;
                    input.value = f.value;
                    if (f.min != null) input.min = f.min;
                    if (f.max != null) input.max = f.max;
                    if (f.type === 'text') input.className = 'text-input';
                }
                row.appendChild(input);
                body.appendChild(row);

                // Event handlers
                if (f.prop === null) {
                    // Text input
                    input.addEventListener('input', () => {
                        this.updateTextElement(element.id, { text: input.value });
                        const t = input.value;
                        label.textContent = t.length > 28 ? t.slice(0, 28) + '…' : t;
                    });
                } else {
                    input.addEventListener('change', () => {
                        const val = f.type === 'number' ? parseInt(input.value) : input.value;
                        this.updateTextElement(element.id, { [f.prop]: val });
                    });
                }
            });

            item.appendChild(body);

            // Toggle/remove handlers
            editBtn.addEventListener('click', () => {
                body.style.display = body.style.display === 'none' ? '' : 'none';
            });
            removeBtn.addEventListener('click', () => this.removeTextElement(element.id));

            container.appendChild(item);
        });
    }

    getTextElements() {
        return this.textElements;
    }

    clearAll() {
        this.textElements = [];
        this.overlayContainer.textContent = ''; // safe clear
        this.updateControlPanel();
    }
}
