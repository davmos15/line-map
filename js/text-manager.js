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
            item.innerHTML = `
                <div class="text-element-controls">
                    <input type="text" class="text-input" value="${element.text}"
                           placeholder="Enter text" data-id="${element.id}">
                    <div class="text-style-controls">
                        <input type="number" min="8" max="72" value="${element.fontSize}"
                               data-id="${element.id}" data-property="fontSize" placeholder="Size">
                        <select data-id="${element.id}" data-property="fontFamily">
                            ${fontOptions.replace(
                                `value="${element.fontFamily}"`,
                                `value="${element.fontFamily}" selected`
                            )}
                        </select>
                        <input type="color" value="${element.color}"
                               data-id="${element.id}" data-property="color">
                        <select data-id="${element.id}" data-property="alignment">
                            <option value="left" ${element.alignment === 'left' ? 'selected' : ''}>Left</option>
                            <option value="center" ${element.alignment === 'center' ? 'selected' : ''}>Center</option>
                            <option value="right" ${element.alignment === 'right' ? 'selected' : ''}>Right</option>
                        </select>
                    </div>
                    <button class="remove-text-btn" data-id="${element.id}">Remove</button>
                </div>
            `;
            container.appendChild(item);
        });

        container.querySelectorAll('.text-input').forEach(input => {
            input.addEventListener('input', (e) => {
                this.updateTextElement(e.target.dataset.id, { text: e.target.value });
            });
        });

        container.querySelectorAll('input[data-property], select[data-property]').forEach(input => {
            input.addEventListener('change', (e) => {
                const value = e.target.type === 'number' ? parseInt(e.target.value) : e.target.value;
                this.updateTextElement(e.target.dataset.id, {
                    [e.target.dataset.property]: value
                });
            });
        });

        container.querySelectorAll('.remove-text-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.removeTextElement(e.target.dataset.id);
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
