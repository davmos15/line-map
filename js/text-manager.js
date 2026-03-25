class TextManager {
    constructor(overlayContainer) {
        this.overlayContainer = overlayContainer;
        this.textElements = [];
        this.nextId = 1;
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
        this.createDOMElement(element);
        this.updateControlPanel();
        return element;
    }

    createDOMElement(element) {
        const div = document.createElement('div');
        div.className = 'draggable-text';
        div.id = element.id;
        div.textContent = element.text;
        div.style.top = `${element.y}px`;
        div.style.fontSize = `${element.fontSize}px`;
        div.style.fontFamily = element.fontFamily;
        div.style.color = element.color;
        div.style.textAlign = element.alignment;

        this.makeDraggable(div, element);
        this.overlayContainer.appendChild(div);
    }

    makeDraggable(div, element) {
        let isDragging = false;
        let startY, initialY;

        const startDrag = (e) => {
            isDragging = true;
            div.classList.add('dragging');
            startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
            initialY = element.y;
            e.preventDefault();
        };

        const drag = (e) => {
            if (!isDragging) return;
            const currentY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
            element.y = initialY + (currentY - startY);
            div.style.top = `${element.y}px`;
        };

        const endDrag = () => {
            isDragging = false;
            div.classList.remove('dragging');
        };

        div.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', endDrag);
        div.addEventListener('touchstart', startDrag);
        document.addEventListener('touchmove', drag);
        document.addEventListener('touchend', endDrag);
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
        container.innerHTML = '';

        const fontOptions = TextManager.FONTS.map(f =>
            `<option value="${f.value}">${f.label}</option>`
        ).join('');

        this.textElements.forEach(element => {
            const item = document.createElement('div');
            item.className = 'text-element-item';

            // Truncate display text
            const display = element.text.length > 28 ? element.text.slice(0, 28) + '…' : element.text;

            item.innerHTML = `
                <div class="text-item-header" data-id="${element.id}">
                    <span class="text-item-label">${display}</span>
                    <button class="btn-icon-sm text-edit-toggle" data-id="${element.id}" title="Edit">
                        <svg viewBox="0 0 24 24" width="11" height="11"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>
                    </button>
                    <button class="btn-icon-sm text-remove-toggle" data-id="${element.id}" title="Remove">
                        <svg viewBox="0 0 24 24" width="11" height="11"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>
                    </button>
                </div>
                <div class="text-item-body" data-id="${element.id}" style="display:none">
                    <div class="text-edit-row">
                        <label>Text</label>
                        <input type="text" class="text-input" value="${element.text}"
                               placeholder="Enter text" data-id="${element.id}">
                    </div>
                    <div class="text-edit-row">
                        <label>Font</label>
                        <select data-id="${element.id}" data-property="fontFamily">
                            ${fontOptions.replace(
                                `value="${element.fontFamily}"`,
                                `value="${element.fontFamily}" selected`
                            )}
                        </select>
                    </div>
                    <div class="text-edit-row">
                        <label>Size</label>
                        <input type="number" min="8" max="72" value="${element.fontSize}"
                               data-id="${element.id}" data-property="fontSize">
                    </div>
                    <div class="text-edit-row">
                        <label>Align</label>
                        <select data-id="${element.id}" data-property="alignment">
                            <option value="left" ${element.alignment === 'left' ? 'selected' : ''}>Left</option>
                            <option value="center" ${element.alignment === 'center' ? 'selected' : ''}>Center</option>
                            <option value="right" ${element.alignment === 'right' ? 'selected' : ''}>Right</option>
                        </select>
                    </div>
                    <div class="text-edit-row">
                        <label>Color</label>
                        <input type="color" value="${element.color}"
                               data-id="${element.id}" data-property="color">
                    </div>
                </div>
            `;
            container.appendChild(item);
        });

        // Toggle edit panels
        container.querySelectorAll('.text-edit-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const body = container.querySelector(`.text-item-body[data-id="${id}"]`);
                if (body) body.style.display = body.style.display === 'none' ? '' : 'none';
            });
        });

        // Remove buttons
        container.querySelectorAll('.text-remove-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.removeTextElement(e.currentTarget.dataset.id);
            });
        });

        // Text input
        container.querySelectorAll('.text-input').forEach(input => {
            input.addEventListener('input', (e) => {
                this.updateTextElement(e.target.dataset.id, { text: e.target.value });
                // Update the label in the header
                const header = container.querySelector(`.text-item-header[data-id="${e.target.dataset.id}"] .text-item-label`);
                if (header) {
                    const t = e.target.value;
                    header.textContent = t.length > 28 ? t.slice(0, 28) + '…' : t;
                }
            });
        });

        // Property inputs
        container.querySelectorAll('input[data-property], select[data-property]').forEach(input => {
            input.addEventListener('change', (e) => {
                const value = e.target.type === 'number' ? parseInt(e.target.value) : e.target.value;
                this.updateTextElement(e.target.dataset.id, {
                    [e.target.dataset.property]: value
                });
            });
        });
    }

    getTextElements() {
        return this.textElements;
    }

    clearAll() {
        this.textElements = [];
        this.overlayContainer.innerHTML = '';
        this.updateControlPanel();
    }
}
