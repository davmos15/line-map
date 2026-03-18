class ExportManager {
    constructor(routeRenderer, textManager) {
        this.routeRenderer = routeRenderer;
        this.textManager = textManager;
    }

    async exportImage(format = 'png', filename = 'route-map') {
        const size = this.routeRenderer.getSize();

        if (format === 'svg') {
            return this.exportSVG(size, filename);
        } else if (format === 'pdf') {
            return this.exportPDF(size, filename);
        } else {
            return this.exportRaster(format, size, 10, filename);
        }
    }

    // Convert text element pixel position to mm-space
    _textToMM(element) {
        const displayScale = this.routeRenderer.displayScale;
        return {
            x: element.x / displayScale,
            y: element.y / displayScale,
            fontSize: element.fontSize / displayScale,
            fontFamily: element.fontFamily,
            color: element.color,
            alignment: element.alignment,
            text: element.text
        };
    }

    _drawTextElements(ctx, size) {
        const textElements = this.textManager.getTextElements();
        textElements.forEach(element => {
            const mm = this._textToMM(element);
            ctx.font = `${mm.fontSize}px ${mm.fontFamily}`;
            ctx.fillStyle = mm.color;
            ctx.textAlign = mm.alignment;
            ctx.fillText(mm.text, mm.x, mm.y + mm.fontSize);
        });
    }

    _drawWatermark(ctx, size) {
        ctx.save();
        ctx.font = '3px Arial';
        ctx.fillStyle = 'rgba(180,180,180,0.4)';
        ctx.textAlign = 'right';
        ctx.fillText('Made with LineArt Maps', size.width - 5, size.height - 5);
        ctx.restore();
    }

    async exportRaster(format, size, scale, filename) {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = size.width * scale;
        exportCanvas.height = size.height * scale;

        const ctx = exportCanvas.getContext('2d');
        ctx.scale(scale, scale);

        // Fill background
        ctx.fillStyle = this.routeRenderer.backgroundColor;
        ctx.fillRect(0, 0, size.width, size.height);

        // Re-render route directly at export resolution (no drawImage scaling issue)
        this.routeRenderer.renderRoute(ctx, size);

        // Draw text elements (converted from pixel-space to mm-space)
        this._drawTextElements(ctx, size);

        // Watermark
        this._drawWatermark(ctx, size);

        // Convert to blob and download
        exportCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.${format}`;
            a.click();
            URL.revokeObjectURL(url);
        }, `image/${format}`);
    }

    exportSVG(size, filename) {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width', `${size.width}mm`);
        svg.setAttribute('height', `${size.height}mm`);
        svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
        svg.setAttribute('xmlns', ns);

        // Background
        const rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('width', size.width);
        rect.setAttribute('height', size.height);
        rect.setAttribute('fill', this.routeRenderer.backgroundColor);
        svg.appendChild(rect);

        // Route path
        if (this.routeRenderer.coordinates.length > 0) {
            const path = document.createElementNS(ns, 'path');
            const coords = this.routeRenderer.coordinates;
            const points = coords.map(c => this.routeRenderer.latLonToCanvas(c.lat, c.lon, size));

            let d = '';
            if (this.routeRenderer.smoothing > 0 && points.length > 2) {
                d = this._buildSmoothedSVGPath(points);
            } else {
                points.forEach((p, i) => {
                    d += i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`;
                });
            }

            path.setAttribute('d', d);
            path.setAttribute('stroke', this.routeRenderer.routeColor);
            path.setAttribute('stroke-width', this.routeRenderer.lineWidth);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');

            if (this.routeRenderer.lineStyle === 'dashed') {
                const w = this.routeRenderer.lineWidth;
                path.setAttribute('stroke-dasharray', `${w * 4},${w * 3}`);
            } else if (this.routeRenderer.lineStyle === 'dotted') {
                const w = this.routeRenderer.lineWidth;
                path.setAttribute('stroke-dasharray', `${w},${w * 2}`);
            }

            svg.appendChild(path);
        }

        // Text elements (converted to mm-space)
        this.textManager.getTextElements().forEach(element => {
            const mm = this._textToMM(element);
            const text = document.createElementNS(ns, 'text');
            text.setAttribute('x', mm.x);
            text.setAttribute('y', mm.y + mm.fontSize);
            text.setAttribute('font-family', mm.fontFamily);
            text.setAttribute('font-size', mm.fontSize);
            text.setAttribute('fill', mm.color);
            text.setAttribute('text-anchor',
                mm.alignment === 'center' ? 'middle' :
                mm.alignment === 'right' ? 'end' : 'start');
            text.textContent = mm.text;
            svg.appendChild(text);
        });

        // Watermark
        const wm = document.createElementNS(ns, 'text');
        wm.setAttribute('x', size.width - 5);
        wm.setAttribute('y', size.height - 5);
        wm.setAttribute('font-family', 'Arial');
        wm.setAttribute('font-size', '3');
        wm.setAttribute('fill', 'rgba(180,180,180,0.4)');
        wm.setAttribute('text-anchor', 'end');
        wm.textContent = 'Made with LineArt Maps';
        svg.appendChild(wm);

        // Download
        const svgData = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.svg`;
        a.click();
        URL.revokeObjectURL(url);
    }

    _buildSmoothedSVGPath(points) {
        const t = this.routeRenderer.smoothing;
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            const cp1x = p1.x + (p2.x - p0.x) * t / 6;
            const cp1y = p1.y + (p2.y - p0.y) * t / 6;
            const cp2x = p2.x - (p3.x - p1.x) * t / 6;
            const cp2y = p2.y - (p3.y - p1.y) * t / 6;
            d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
        }
        return d;
    }

    async exportPDF(size, filename) {
        if (typeof window.jspdf === 'undefined') {
            alert('PDF export library not loaded. Please try PNG or SVG format.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const orientation = size.width > size.height ? 'landscape' : 'portrait';
        const pdf = new jsPDF({
            orientation,
            unit: 'mm',
            format: [Math.min(size.width, size.height), Math.max(size.width, size.height)]
        });

        // Create temporary canvas for PDF
        const scale = 5;
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = size.width * scale;
        exportCanvas.height = size.height * scale;

        const ctx = exportCanvas.getContext('2d');
        ctx.scale(scale, scale);

        // Fill background
        ctx.fillStyle = this.routeRenderer.backgroundColor;
        ctx.fillRect(0, 0, size.width, size.height);

        // Re-render route at export resolution
        this.routeRenderer.renderRoute(ctx, size);

        // Draw text elements
        this._drawTextElements(ctx, size);

        // Watermark
        this._drawWatermark(ctx, size);

        // Add to PDF
        const imgData = exportCanvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, size.width, size.height);
        pdf.save(`${filename}.pdf`);
    }
}
