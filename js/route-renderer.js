class RouteRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.coordinates = [];
        this.bounds = null;
        this.padding = 40;
        this.lineWidth = 2;
        this.routeColor = '#000000';
        this.backgroundColor = '#FFFFFF';
        this.printSize = 'a4';
        this.dpi = 300;
    }

    setPrintSize(size) {
        this.printSize = size;
        this.updateCanvasSize();
        if (this.coordinates.length > 0) {
            this.render();
        }
    }

    updateCanvasSize() {
        const sizes = {
            'a5': { width: 148, height: 210 },
            'a4': { width: 210, height: 297 },
            'a3': { width: 297, height: 420 },
            'a2': { width: 420, height: 594 },
            'a1': { width: 594, height: 841 },
            'a0': { width: 841, height: 1189 }
        };

        const size = sizes[this.printSize];
        const scale = 3; // For high resolution
        
        this.canvas.width = size.width * scale;
        this.canvas.height = size.height * scale;
        
        // Set display size
        this.canvas.style.width = `${size.width * 2}px`;
        this.canvas.style.height = `${size.height * 2}px`;
        
        // Scale context for high DPI
        this.ctx.scale(scale, scale);
    }

    setColors(routeColor, backgroundColor) {
        this.routeColor = routeColor;
        this.backgroundColor = backgroundColor;
        if (this.coordinates.length > 0) {
            this.render();
        }
    }

    setLineWidth(width) {
        this.lineWidth = width;
        if (this.coordinates.length > 0) {
            this.render();
        }
    }

    loadCoordinates(coordinates) {
        this.coordinates = coordinates;
        this.calculateBounds();
        this.render();
    }

    calculateBounds() {
        if (this.coordinates.length === 0) return;

        let minLat = this.coordinates[0].lat;
        let maxLat = this.coordinates[0].lat;
        let minLon = this.coordinates[0].lon;
        let maxLon = this.coordinates[0].lon;

        this.coordinates.forEach(coord => {
            minLat = Math.min(minLat, coord.lat);
            maxLat = Math.max(maxLat, coord.lat);
            minLon = Math.min(minLon, coord.lon);
            maxLon = Math.max(maxLon, coord.lon);
        });

        this.bounds = { minLat, maxLat, minLon, maxLon };
    }

    latLonToCanvas(lat, lon) {
        const sizes = {
            'a5': { width: 148, height: 210 },
            'a4': { width: 210, height: 297 },
            'a3': { width: 297, height: 420 },
            'a2': { width: 420, height: 594 },
            'a1': { width: 594, height: 841 },
            'a0': { width: 841, height: 1189 }
        };

        const canvasSize = sizes[this.printSize];
        const width = canvasSize.width;
        const height = canvasSize.height;

        const latRange = this.bounds.maxLat - this.bounds.minLat;
        const lonRange = this.bounds.maxLon - this.bounds.minLon;

        // Add padding to the bounds
        const paddedWidth = width - (2 * this.padding);
        const paddedHeight = height - (2 * this.padding);

        // Calculate scale to fit the route within the canvas
        const scaleX = paddedWidth / lonRange;
        const scaleY = paddedHeight / latRange;
        const scale = Math.min(scaleX, scaleY);

        // Center the route
        const centerLat = (this.bounds.minLat + this.bounds.maxLat) / 2;
        const centerLon = (this.bounds.minLon + this.bounds.maxLon) / 2;
        const centerX = width / 2;
        const centerY = height / 2;

        const x = centerX + (lon - centerLon) * scale;
        const y = centerY - (lat - centerLat) * scale; // Invert Y axis

        return { x, y };
    }

    render() {
        if (!this.bounds || this.coordinates.length === 0) return;

        const sizes = {
            'a5': { width: 148, height: 210 },
            'a4': { width: 210, height: 297 },
            'a3': { width: 297, height: 420 },
            'a2': { width: 420, height: 594 },
            'a1': { width: 594, height: 841 },
            'a0': { width: 841, height: 1189 }
        };

        const size = sizes[this.printSize];

        // Clear canvas
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, size.width, size.height);

        // Draw route
        this.ctx.strokeStyle = this.routeColor;
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.beginPath();
        
        this.coordinates.forEach((coord, index) => {
            const point = this.latLonToCanvas(coord.lat, coord.lon);
            
            if (index === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        });

        this.ctx.stroke();
    }

    getCanvasDataURL(format = 'png') {
        if (format === 'png') {
            return this.canvas.toDataURL('image/png');
        } else if (format === 'jpeg') {
            return this.canvas.toDataURL('image/jpeg', 0.95);
        }
        return null;
    }

    getCanvasForExport() {
        return this.canvas;
    }
}