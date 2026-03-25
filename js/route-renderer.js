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
        this.padding = 40;
        this.lineWidth = 2;
        this.routeColor = '#000000';
        this.backgroundColor = '#FFFFFF';
        this.printSize = 'a4';
        this.orientation = 'portrait';
        this.lineStyle = 'solid';
        this.smoothing = 0;
        this.displayScale = 2;
        this.canvasScale = 3;
        this.colorMode = 'solid'; // 'solid' or 'speed'
        this.speeds = []; // per-segment speeds
        this.speedRange = { min: 0, max: 1 };
        this.hasTimeData = false;
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
        if (this.coordinates.length > 0) this.render();
    }

    setOrientation(orientation) {
        this.orientation = orientation;
        this.updateCanvasSize();
        if (this.coordinates.length > 0) this.render();
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

        // Check if we have time data
        const withTime = this.coordinates.filter(c => c.time != null);
        if (withTime.length < 2) return;

        this.hasTimeData = true;
        let minSpeed = Infinity, maxSpeed = 0;

        for (let i = 1; i < this.coordinates.length; i++) {
            const prev = this.coordinates[i - 1];
            const curr = this.coordinates[i];

            if (prev.time && curr.time) {
                const dt = (curr.time - prev.time) / 1000; // seconds
                if (dt > 0) {
                    const dist = GPSParser.calculateDistance(prev, curr); // meters
                    const speed = dist / dt; // m/s
                    this.speeds.push(speed);
                    if (speed < minSpeed) minSpeed = speed;
                    if (speed > maxSpeed) maxSpeed = speed;
                } else {
                    this.speeds.push(this.speeds.length > 0 ? this.speeds[this.speeds.length - 1] : 0);
                }
            } else {
                // No time for this pair, use previous speed or 0
                this.speeds.push(this.speeds.length > 0 ? this.speeds[this.speeds.length - 1] : 0);
            }
        }

        // Use 5th and 95th percentile to avoid outliers skewing the gradient
        if (this.speeds.length > 0) {
            const sorted = [...this.speeds].sort((a, b) => a - b);
            const p5 = sorted[Math.floor(sorted.length * 0.05)];
            const p95 = sorted[Math.floor(sorted.length * 0.95)];
            this.speedRange = { min: p5, max: p95 };
        }
    }

    // HSL-based gradient: blue (slow) → cyan → green → yellow → red (fast)
    speedToColor(speed) {
        const { min, max } = this.speedRange;
        const t = Math.max(0, Math.min(1, (speed - min) / (max - min || 1)));
        const hue = (1 - t) * 240; // 240=blue → 0=red
        return `hsl(${hue}, 100%, 50%)`;
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

        // Draw each segment with its speed color
        for (let i = 0; i < points.length - 1; i++) {
            const speed = this.speeds[i] !== undefined ? this.speeds[i] : 0;
            ctx.strokeStyle = this.speedToColor(speed);
            ctx.beginPath();
            ctx.moveTo(points[i].x, points[i].y);

            if (this.smoothing > 0 && points.length > 2) {
                const p0 = points[Math.max(0, i - 1)];
                const p1 = points[i];
                const p2 = points[i + 1];
                const p3 = points[Math.min(points.length - 1, i + 2)];
                const t = this.smoothing;
                const cp1x = p1.x + (p2.x - p0.x) * t / 6;
                const cp1y = p1.y + (p2.y - p0.y) * t / 6;
                const cp2x = p2.x - (p3.x - p1.x) * t / 6;
                const cp2y = p2.y - (p3.y - p1.y) * t / 6;
                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            } else {
                ctx.lineTo(points[i + 1].x, points[i + 1].y);
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
            const cp1x = p1.x + (p2.x - p0.x) * t / 6;
            const cp1y = p1.y + (p2.y - p0.y) * t / 6;
            const cp2x = p2.x - (p3.x - p1.x) * t / 6;
            const cp2y = p2.y - (p3.y - p1.y) * t / 6;
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
    }

    render() {
        if (!this.bounds || this.coordinates.length === 0) return;
        const size = this.getSize();

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.canvasScale, this.canvasScale);

        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, size.width, size.height);

        this.renderRoute(this.ctx, size);
    }
}
