// Shared paper size constants (single source of truth)
const PAPER_SIZES = {
    'a5': { width: 148, height: 210 },
    'a4': { width: 210, height: 297 },
    'a3': { width: 297, height: 420 },
    'a2': { width: 420, height: 594 },
    'a1': { width: 594, height: 841 },
    'a0': { width: 841, height: 1189 }
};

class RouteRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.coordinates = [];
        this.bounds = null;
        this.padding = 55;
        this.lineWidth = 2.5;
        this.routeColor = '#1B2A4A';
        this.backgroundColor = '#F5F0E8';
        this.printSize = 'a4';
        this.orientation = 'portrait';
        this.lineStyle = 'solid';
        this.smoothing = 0.3;
        this.displayScale = 2;
        this.canvasScale = 3;
        this.colorMode = 'solid';
        this.speeds = [];
        this.speedRange = { min: 0, max: 1 };
        this.hasTimeData = false;
        this.showStartMarker = false;
        this.showMap = true;
        this.mapOpacity = 0.7; // 0 = hidden, 1 = full strength
        this._tileCache = {};
        this._mapReady = false;
        // Heatmap colors as [r,g,b] arrays
        this.heatmapColors = {
            slow: [0, 0, 255],
            medium: [0, 255, 0],
            fast: [255, 0, 0]
        };
    }

    static hexToRGB(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b];
    }

    setHeatmapColor(which, hex) {
        this.heatmapColors[which] = RouteRenderer.hexToRGB(hex);
        if (this.coordinates.length > 0 && this.colorMode === 'speed') this.render();
    }

    getSize() {
        const base = PAPER_SIZES[this.printSize];
        if (this.orientation === 'landscape') {
            return { width: base.height, height: base.width };
        }
        return { ...base };
    }

    setPrintSize(size) {
        this.printSize = size;
        this.updateCanvasSize();
        if (this.coordinates.length > 0) {
            if (this.showMap && this.bounds) this.loadMapTiles();
            else this.render();
        }
    }

    setOrientation(orientation) {
        this.orientation = orientation;
        this.updateCanvasSize();
        if (this.coordinates.length > 0) {
            if (this.showMap && this.bounds) this.loadMapTiles();
            else this.render();
        }
    }

    updateCanvasSize() {
        const size = this.getSize();
        this.canvas.width = size.width * this.canvasScale;
        this.canvas.height = size.height * this.canvasScale;
        this.canvas.style.width = `${size.width * this.displayScale}px`;
        this.canvas.style.height = `${size.height * this.displayScale}px`;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.canvasScale, this.canvasScale);
    }

    setColors(routeColor, backgroundColor) {
        this.routeColor = routeColor;
        this.backgroundColor = backgroundColor;
        if (this.coordinates.length > 0) this.render();
    }

    setLineWidth(width) {
        this.lineWidth = width;
        if (this.coordinates.length > 0) this.render();
    }

    setLineStyle(style) {
        this.lineStyle = style;
        if (this.coordinates.length > 0) this.render();
    }

    setSmoothing(value) {
        this.smoothing = value;
        if (this.coordinates.length > 0) this.render();
    }

    setColorMode(mode) {
        this.colorMode = mode;
        if (this.coordinates.length > 0) this.render();
    }

    loadCoordinates(coordinates) {
        this.coordinates = coordinates;
        this.calculateBounds();
        this.calculateSpeeds();
        this.render();
    }

    calculateBounds() {
        if (this.coordinates.length === 0) return;
        let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
        this.coordinates.forEach(c => {
            if (c.lat < minLat) minLat = c.lat;
            if (c.lat > maxLat) maxLat = c.lat;
            if (c.lon < minLon) minLon = c.lon;
            if (c.lon > maxLon) maxLon = c.lon;
        });
        this.bounds = { minLat, maxLat, minLon, maxLon };
    }

    calculateSpeeds() {
        this.speeds = [];
        this.hasTimeData = false;
        if (this.coordinates.length < 2) return;

        const withTime = this.coordinates.filter(c => c.time != null);
        if (withTime.length < 2) return;

        this.hasTimeData = true;
        let minSpeed = Infinity, maxSpeed = 0;

        for (let i = 1; i < this.coordinates.length; i++) {
            const prev = this.coordinates[i - 1];
            const curr = this.coordinates[i];

            if (prev.time && curr.time) {
                const dt = (curr.time - prev.time) / 1000;
                if (dt > 0) {
                    const dist = GPSParser.calculateDistance(prev, curr);
                    const speed = dist / dt;
                    this.speeds.push(speed);
                    if (speed < minSpeed) minSpeed = speed;
                    if (speed > maxSpeed) maxSpeed = speed;
                } else {
                    this.speeds.push(this.speeds.length > 0 ? this.speeds[this.speeds.length - 1] : 0);
                }
            } else {
                this.speeds.push(this.speeds.length > 0 ? this.speeds[this.speeds.length - 1] : 0);
            }
        }

        if (this.speeds.length > 0) {
            const sorted = [...this.speeds].sort((a, b) => a - b);
            this.speedRange = {
                min: sorted[Math.floor(sorted.length * 0.05)],
                max: sorted[Math.floor(sorted.length * 0.95)]
            };
        }
    }

    // Interpolate between two RGB arrays
    _lerpColor(c1, c2, t) {
        return [
            Math.round(c1[0] + (c2[0] - c1[0]) * t),
            Math.round(c1[1] + (c2[1] - c1[1]) * t),
            Math.round(c1[2] + (c2[2] - c1[2]) * t)
        ];
    }

    speedToColor(speed) {
        const { min, max } = this.speedRange;
        const t = Math.max(0, Math.min(1, (speed - min) / (max - min || 1)));
        let rgb;
        if (t < 0.5) {
            rgb = this._lerpColor(this.heatmapColors.slow, this.heatmapColors.medium, t * 2);
        } else {
            rgb = this._lerpColor(this.heatmapColors.medium, this.heatmapColors.fast, (t - 0.5) * 2);
        }
        return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    }

    latLonToCanvas(lat, lon, size) {
        size = size || this.getSize();
        const width = size.width;
        const height = size.height;
        const latRange = this.bounds.maxLat - this.bounds.minLat || 0.001;
        const lonRange = this.bounds.maxLon - this.bounds.minLon || 0.001;
        const paddedWidth = width - 2 * this.padding;
        const paddedHeight = height - 2 * this.padding;
        const scaleX = paddedWidth / lonRange;
        const scaleY = paddedHeight / latRange;
        const scale = Math.min(scaleX, scaleY);
        const centerLat = (this.bounds.minLat + this.bounds.maxLat) / 2;
        const centerLon = (this.bounds.minLon + this.bounds.maxLon) / 2;
        return {
            x: width / 2 + (lon - centerLon) * scale,
            y: height / 2 - (lat - centerLat) * scale
        };
    }

    _applyLineStyle(ctx) {
        switch (this.lineStyle) {
            case 'dashed':
                ctx.setLineDash([this.lineWidth * 4, this.lineWidth * 3]);
                break;
            case 'dotted':
                ctx.setLineDash([this.lineWidth, this.lineWidth * 2]);
                break;
            default:
                ctx.setLineDash([]);
        }
    }

    renderRoute(ctx, size) {
        if (!this.bounds || this.coordinates.length === 0) return;

        if (this.colorMode === 'speed' && this.hasTimeData) {
            this._renderSpeedRoute(ctx, size);
        } else {
            this._renderSolidRoute(ctx, size);
        }
    }

    _renderSolidRoute(ctx, size) {
        ctx.strokeStyle = this.routeColor;
        ctx.lineWidth = this.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        this._applyLineStyle(ctx);

        const points = this.coordinates.map(c => this.latLonToCanvas(c.lat, c.lon, size));

        ctx.beginPath();
        if (this.smoothing > 0 && points.length > 2) {
            this._drawSmoothedPath(ctx, points);
        } else {
            points.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    _renderSpeedRoute(ctx, size) {
        const points = this.coordinates.map(c => this.latLonToCanvas(c.lat, c.lon, size));

        ctx.lineWidth = this.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        this._applyLineStyle(ctx);

        // Draw each segment with a linear gradient from its color to the next
        // segment's color, creating truly smooth color transitions
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            // Skip near-zero-length segments (prevent gradient issues and dots)
            const dx = p2.x - p1.x, dy = p2.y - p1.y;
            if (dx * dx + dy * dy < 0.01) continue;

            const c1 = this.speedToColor(this.speeds[i] || 0);
            const c2 = this.speedToColor(this.speeds[Math.min(i + 1, this.speeds.length - 1)] || 0);

            const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
            grad.addColorStop(0, c1);
            grad.addColorStop(1, c2);

            ctx.strokeStyle = grad;
            ctx.beginPath();

            if (this.smoothing > 0 && points.length > 2) {
                const p0 = points[Math.max(0, i - 1)];
                const p3 = points[Math.min(points.length - 1, i + 2)];
                const t = this.smoothing;
                ctx.moveTo(p1.x, p1.y);
                ctx.bezierCurveTo(
                    p1.x + (p2.x - p0.x) * t / 6,
                    p1.y + (p2.y - p0.y) * t / 6,
                    p2.x - (p3.x - p1.x) * t / 6,
                    p2.y - (p3.y - p1.y) * t / 6,
                    p2.x, p2.y
                );
            } else {
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
            }
            ctx.stroke();
        }
        ctx.setLineDash([]);
    }

    _drawSmoothedPath(ctx, points) {
        const t = this.smoothing;
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            ctx.bezierCurveTo(
                p1.x + (p2.x - p0.x) * t / 6,
                p1.y + (p2.y - p0.y) * t / 6,
                p2.x - (p3.x - p1.x) * t / 6,
                p2.y - (p3.y - p1.y) * t / 6,
                p2.x, p2.y
            );
        }
    }

    // Draw inner border frame and start marker
    renderDecorations(ctx, size) {
        // Inner border — thin elegant frame
        const margin = 10;
        ctx.strokeStyle = this.colorMode === 'speed' ? 'rgba(120,120,120,0.25)' : this.routeColor;
        ctx.globalAlpha = this.colorMode === 'speed' ? 1 : 0.15;
        ctx.lineWidth = 0.4;
        ctx.setLineDash([]);
        ctx.strokeRect(margin, margin, size.width - 2 * margin, size.height - 2 * margin);
        ctx.globalAlpha = 1;

        // Start marker — small filled circle
        if (this.showStartMarker && this.bounds && this.coordinates.length > 0) {
            const start = this.latLonToCanvas(this.coordinates[0].lat, this.coordinates[0].lon, size);
            const markerColor = this.colorMode === 'speed' && this.hasTimeData
                ? this.speedToColor(this.speeds[0] || 0)
                : this.routeColor;
            ctx.fillStyle = markerColor;
            ctx.beginPath();
            ctx.arc(start.x, start.y, this.lineWidth * 1.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // --- Map tile background ---

    _isDarkBackground() {
        const hex = this.backgroundColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
    }

    _tileUrl(z, x, y) {
        const style = this._isDarkBackground() ? 'dark_nolabels' : 'light_nolabels';
        const server = ['a', 'b', 'c'][(x + y) % 3];
        return `https://${server}.basemaps.cartocdn.com/${style}/${z}/${x}/${y}@2x.png`;
    }

    _latLonToTile(lat, lon, z) {
        const n = Math.pow(2, z);
        const x = Math.floor((lon + 180) / 360 * n);
        const latRad = lat * Math.PI / 180;
        const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
        return { x, y };
    }

    _tileToLatLon(tx, ty, z) {
        const n = Math.pow(2, z);
        const lon = tx / n * 360 - 180;
        const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * ty / n)));
        return { lat: latRad * 180 / Math.PI, lon };
    }

    _getCanvasLatLonBounds(size) {
        const latRange = this.bounds.maxLat - this.bounds.minLat || 0.001;
        const lonRange = this.bounds.maxLon - this.bounds.minLon || 0.001;
        const paddedW = size.width - 2 * this.padding;
        const paddedH = size.height - 2 * this.padding;
        const scale = Math.min(paddedW / lonRange, paddedH / latRange);
        const cLat = (this.bounds.minLat + this.bounds.maxLat) / 2;
        const cLon = (this.bounds.minLon + this.bounds.maxLon) / 2;
        return {
            minLat: cLat - size.height / (2 * scale),
            maxLat: cLat + size.height / (2 * scale),
            minLon: cLon - size.width / (2 * scale),
            maxLon: cLon + size.width / (2 * scale)
        };
    }

    _calculateZoom() {
        const cb = this._getCanvasLatLonBounds(this.getSize());
        const lonRange = cb.maxLon - cb.minLon;
        for (let z = 17; z >= 1; z--) {
            if (lonRange / (360 / Math.pow(2, z)) <= 8) return z;
        }
        return 10;
    }

    _fetchTile(z, x, y) {
        const key = `${z}/${x}/${y}/${this._isDarkBackground() ? 'd' : 'l'}`;
        if (this._tileCache[key]) return Promise.resolve(this._tileCache[key]);
        return new Promise(resolve => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => { this._tileCache[key] = img; resolve(img); };
            img.onerror = () => resolve(null);
            img.src = this._tileUrl(z, x, y);
        });
    }

    async loadMapTiles() {
        if (!this.showMap || !this.bounds) { this._mapReady = false; return; }
        const size = this.getSize();
        const zoom = this._calculateZoom();
        const cb = this._getCanvasLatLonBounds(size);

        const minT = this._latLonToTile(cb.maxLat, cb.minLon, zoom);
        const maxT = this._latLonToTile(cb.minLat, cb.maxLon, zoom);

        // Pad by 1 tile on each side to cover edges
        const pad = 1;
        const promises = [];
        for (let tx = minT.x - pad; tx <= maxT.x + pad; tx++) {
            for (let ty = minT.y - pad; ty <= maxT.y + pad; ty++) {
                promises.push(this._fetchTile(zoom, tx, ty));
            }
        }
        this._mapMeta = { zoom, minX: minT.x - pad, minY: minT.y - pad, maxX: maxT.x + pad, maxY: maxT.y + pad };
        await Promise.all(promises);
        this._mapReady = true;
        this.render();
    }

    renderMapBackground(ctx, size) {
        if (!this.showMap || !this._mapReady || !this._mapMeta) return;
        const { zoom, minX, minY, maxX, maxY } = this._mapMeta;
        const dark = this._isDarkBackground();
        const key_suffix = dark ? 'd' : 'l';

        for (let tx = minX; tx <= maxX; tx++) {
            for (let ty = minY; ty <= maxY; ty++) {
                const tile = this._tileCache[`${zoom}/${tx}/${ty}/${key_suffix}`];
                if (!tile) continue;
                const tl = this._tileToLatLon(tx, ty, zoom);
                const br = this._tileToLatLon(tx + 1, ty + 1, zoom);
                const p1 = this.latLonToCanvas(tl.lat, tl.lon, size);
                const p2 = this.latLonToCanvas(br.lat, br.lon, size);
                ctx.drawImage(tile, p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
            }
        }
        // Wash with background color — mapOpacity controls how much map shows through
        // wash = 1 - mapOpacity (high opacity = less wash = more map visible)
        ctx.globalAlpha = 1 - this.mapOpacity;
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(0, 0, size.width, size.height);
        ctx.globalAlpha = 1;
    }

    render() {
        if (!this.bounds || this.coordinates.length === 0) return;
        const size = this.getSize();

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.canvasScale, this.canvasScale);

        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, size.width, size.height);

        this.renderMapBackground(this.ctx, size);
        this.renderDecorations(this.ctx, size);
        this.renderRoute(this.ctx, size);
    }
}
