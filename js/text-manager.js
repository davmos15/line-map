class TextManager {
    constructor(overlayContainer) {
        this.overlayContainer = overlayContainer;
        this.textElements = [];
        this.nextId = 1;
        this.activeElement = null;
    }

    addTextElement(text = 'New Text', options = {}) {
        const id = `text-${this.nextId++}`;
        const element = {
            id,
            text,
            x: options.x || 50,
            y: options.y || 50,
            fontSize: options.fontSize || 16,
            fontFamily: options.fontFamily || 'Arial',
            color: options.color || '#000000',
            alignment: options.alignment || 'left'
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
        div.style.left = `${element.x}px`;
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
        let startX, startY, initialX, initialY;

        const startDrag = (e) => {
            isDragging = true;
            div.classList.add('dragging');
            
            const rect = div.getBoundingClientRect();
            const containerRect = this.overlayContainer.getBoundingClientRect();
            
            startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
            
            initialX = rect.left - containerRect.left;
            initialY = rect.top - containerRect.top;
            
            e.preventDefault();
        };

        const drag = (e) => {
            if (!isDragging) return;
            
            const currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            const currentY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
            
            const deltaX = currentX - startX;
            const deltaY = currentY - startY;
            
            const newX = initialX + deltaX;
            const newY = initialY + deltaY;
            
            // Keep within container bounds
            const containerRect = this.overlayContainer.getBoundingClientRect();
            const elementRect = div.getBoundingClientRect();
            
            element.x = Math.max(0, Math.min(newX, containerRect.width - elementRect.width));
            element.y = Math.max(0, Math.min(newY, containerRect.height - elementRect.height));
            
            div.style.left = `${element.x}px`;
            div.style.top = `${element.y}px`;
        };

        const endDrag = () => {
            isDragging = false;
            div.classList.remove('dragging');
        };

        // Mouse events
        div.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', endDrag);
        
        // Touch events
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
        if (div) {
            div.remove();
        }
        
        this.updateControlPanel();
    }

    updateControlPanel() {
        const container = document.getElementById('textElements');
        container.innerHTML = '';

        this.textElements.forEach(element => {
            const item = document.createElement('div');
            item.className = 'text-element-item';
            item.innerHTML = `
                <div class="text-element-controls">
                    <input type="text" class="text-input" value="${element.text}" 
                           placeholder="Enter text" data-id="${element.id}">
                    <div class="text-style-controls">
                        <input type="number" min="8" max="72" value="${element.fontSize}" 
                               data-id="${element.id}" data-property="fontSize" 
                               placeholder="Size">
                        <select data-id="${element.id}" data-property="fontFamily">
                            <option value="Arial" ${element.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                            <option value="Helvetica" ${element.fontFamily === 'Helvetica' ? 'selected' : ''}>Helvetica</option>
                            <option value="Times New Roman" ${element.fontFamily === 'Times New Roman' ? 'selected' : ''}>Times</option>
                            <option value="Georgia" ${element.fontFamily === 'Georgia' ? 'selected' : ''}>Georgia</option>
                            <option value="Courier New" ${element.fontFamily === 'Courier New' ? 'selected' : ''}>Courier</option>
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

        // Add event listeners
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