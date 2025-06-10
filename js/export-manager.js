class ExportManager {
    constructor(routeRenderer, textManager) {
        this.routeRenderer = routeRenderer;
        this.textManager = textManager;
    }

    async exportImage(format = 'png', filename = 'route-map') {
        const sizes = {
            'a5': { width: 148, height: 210 },
            'a4': { width: 210, height: 297 },
            'a3': { width: 297, height: 420 },
            'a2': { width: 420, height: 594 },
            'a1': { width: 594, height: 841 },
            'a0': { width: 841, height: 1189 }
        };

        const printSize = this.routeRenderer.printSize;
        const size = sizes[printSize];
        const scale = 10; // High resolution export

        if (format === 'svg') {
            return this.exportSVG(size, filename);
        } else if (format === 'pdf') {
            return this.exportPDF(size, filename);
        } else {
            return this.exportRaster(format, size, scale, filename);
        }
    }

    async exportRaster(format, size, scale, filename) {
        // Create a temporary canvas for export
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = size.width * scale;
        exportCanvas.height = size.height * scale;
        
        const ctx = exportCanvas.getContext('2d');
        ctx.scale(scale, scale);

        // Fill background
        ctx.fillStyle = this.routeRenderer.backgroundColor;
        ctx.fillRect(0, 0, size.width, size.height);

        // Draw the route
        const routeCanvas = this.routeRenderer.getCanvasForExport();
        ctx.drawImage(routeCanvas, 0, 0, size.width, size.height);

        // Draw text elements
        const textElements = this.textManager.getTextElements();
        textElements.forEach(element => {
            ctx.font = `${element.fontSize}px ${element.fontFamily}`;
            ctx.fillStyle = element.color;
            ctx.textAlign = element.alignment;
            ctx.fillText(element.text, element.x, element.y + element.fontSize);
        });

        // Convert to blob and download
        exportCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.${format}`;
            a.click();
            URL.revokeObjectURL(url);
        }, `image/${format}`, format === 'jpeg' ? 0.95 : undefined);
    }

    exportSVG(size, filename) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', size.width);
        svg.setAttribute('height', size.height);
        svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        // Background
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', size.width);
        rect.setAttribute('height', size.height);
        rect.setAttribute('fill', this.routeRenderer.backgroundColor);
        svg.appendChild(rect);

        // Route path
        if (this.routeRenderer.coordinates.length > 0) {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            let d = '';
            
            this.routeRenderer.coordinates.forEach((coord, index) => {
                const point = this.routeRenderer.latLonToCanvas(coord.lat, coord.lon);
                if (index === 0) {
                    d += `M ${point.x} ${point.y}`;
                } else {
                    d += ` L ${point.x} ${point.y}`;
                }
            });

            path.setAttribute('d', d);
            path.setAttribute('stroke', this.routeRenderer.routeColor);
            path.setAttribute('stroke-width', this.routeRenderer.lineWidth);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(path);
        }

        // Text elements
        const textElements = this.textManager.getTextElements();
        textElements.forEach(element => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', element.x);
            text.setAttribute('y', element.y + element.fontSize);
            text.setAttribute('font-family', element.fontFamily);
            text.setAttribute('font-size', element.fontSize);
            text.setAttribute('fill', element.color);
            text.setAttribute('text-anchor', element.alignment === 'center' ? 'middle' : 
                                         element.alignment === 'right' ? 'end' : 'start');
            text.textContent = element.text;
            svg.appendChild(text);
        });

        // Convert to blob and download
        const svgData = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.svg`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async exportPDF(size, filename) {
        if (typeof window.jspdf === 'undefined') {
            alert('PDF export library not loaded. Please try PNG or SVG format.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const orientation = size.width > size.height ? 'landscape' : 'portrait';
        const pdf = new jsPDF({
            orientation: orientation,
            unit: 'mm',
            format: [size.width, size.height]
        });

        // Create temporary canvas for PDF
        const exportCanvas = document.createElement('canvas');
        const scale = 5;
        exportCanvas.width = size.width * scale;
        exportCanvas.height = size.height * scale;
        
        const ctx = exportCanvas.getContext('2d');
        ctx.scale(scale, scale);

        // Fill background
        ctx.fillStyle = this.routeRenderer.backgroundColor;
        ctx.fillRect(0, 0, size.width, size.height);

        // Draw the route
        const routeCanvas = this.routeRenderer.getCanvasForExport();
        ctx.drawImage(routeCanvas, 0, 0, size.width, size.height);

        // Draw text elements
        const textElements = this.textManager.getTextElements();
        textElements.forEach(element => {
            ctx.font = `${element.fontSize}px ${element.fontFamily}`;
            ctx.fillStyle = element.color;
            ctx.textAlign = element.alignment;
            ctx.fillText(element.text, element.x, element.y + element.fontSize);
        });

        // Add to PDF
        const imgData = exportCanvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, size.width, size.height);
        pdf.save(`${filename}.pdf`);
    }
}