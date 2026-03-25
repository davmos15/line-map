document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    const fileUploadArea = $('fileUploadArea');
    const fileInput = $('fileInput');
    const uploadFeedback = $('uploadFeedback');
    const printSizeSelect = $('printSize');
    const orientationBtn = $('orientationBtn');
    const routeColorInput = $('routeColor');
    const backgroundColorInput = $('backgroundColor');
    const backgroundColor2Input = $('backgroundColor2');
    const heatSlowInput = $('heatSlow');
    const heatMediumInput = $('heatMedium');
    const heatFastInput = $('heatFast');
    const lineWidthSlider = $('lineWidth');
    const lineWidthValue = $('lineWidthValue');
    const lineStyleSelect = $('lineStyle');
    const smoothingSlider = $('smoothing');
    const smoothingValue = $('smoothingValue');
    const showMarkerToggle = $('showMarker');
    const showMapToggle = $('showMap');
    const mapOpacitySlider = $('mapOpacity');
    const mapOpacityValue = $('mapOpacityValue');
    const mapOpacityRow = $('mapOpacityRow');
    const addTextBtn = $('addTextBtn');
    const exportBtn = $('exportBtn');
    const exportFormat = $('exportFormat');
    const resetBtn = $('resetBtn');
    const canvas = $('routeCanvas');
    const textOverlay = $('textOverlay');
    const loadingOverlay = $('loadingOverlay');
    const solidColorControls = $('solidColorControls');
    const speedInfo = $('speedInfo');
    const speedModeLabel = $('speedModeLabel');
    const colorModeRadios = document.querySelectorAll('input[name="colorMode"]');

    const routeRenderer = new RouteRenderer(canvas);
    const textManager = new TextManager(textOverlay);
    const exportManager = new ExportManager(routeRenderer, textManager);
    let currentGPSData = null;

    routeRenderer.setPrintSize('a4');
    syncOverlaySize();

    // --- Upload ---
    fileUploadArea.addEventListener('click', () => fileInput.click());
    fileUploadArea.addEventListener('dragover', e => { e.preventDefault(); fileUploadArea.classList.add('drag-over'); });
    fileUploadArea.addEventListener('dragleave', () => fileUploadArea.classList.remove('drag-over'));
    fileUploadArea.addEventListener('drop', e => {
        e.preventDefault();
        fileUploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFileUpload(e.target.files[0]); });

    async function handleFileUpload(file) {
        try {
            showLoading(true);
            uploadFeedback.className = 'upload-feedback';
            const result = await GPSParser.parseFile(file);
            currentGPSData = result;
            if (result.coordinates.length === 0) throw new Error('No GPS coordinates found');

            routeRenderer.loadCoordinates(result.coordinates);

            // Auto-load map tiles if city map is enabled
            if (routeRenderer.showMap) routeRenderer.loadMapTiles();

            // Speed heatmap availability
            if (routeRenderer.hasTimeData) {
                speedModeLabel.classList.remove('disabled');
                speedModeLabel.querySelector('input').disabled = false;
            } else {
                speedModeLabel.classList.add('disabled');
                speedModeLabel.querySelector('input').disabled = true;
                if (routeRenderer.colorMode === 'speed') {
                    document.querySelector('input[name="colorMode"][value="solid"]').checked = true;
                    routeRenderer.setColorMode('solid');
                    solidColorControls.style.display = '';
                    speedInfo.style.display = 'none';
                }
            }

            uploadFeedback.className = 'upload-feedback success';
            uploadFeedback.innerHTML = `<strong>${file.name}</strong> — ${result.coordinates.length} pts${routeRenderer.hasTimeData ? ' · speed' : ''}`;

            fileUploadArea.classList.add('file-loaded');
            const prompt = fileUploadArea.querySelector('.upload-prompt span');
            if (prompt) prompt.textContent = `${file.name} — drop to replace`;

            exportBtn.disabled = false;
            buildDefaultText(result);
            syncOverlaySize();
        } catch (error) {
            uploadFeedback.className = 'upload-feedback error';
            uploadFeedback.textContent = error.message;
        } finally {
            showLoading(false);
        }
    }

    function buildDefaultText(result) {
        textManager.clearAll();
        const rc = routeRenderer.routeColor;
        const canvasH = canvas.getBoundingClientRect().height;

        if (result.metadata.name) {
            textManager.addTextElement(result.metadata.name.toUpperCase(), {
                y: 36, fontSize: 22, fontFamily: 'Playfair Display', alignment: 'center', color: rc
            });
        }
        if (result.metadata.time) {
            const opts = { year: 'numeric', month: 'long', day: 'numeric' };
            textManager.addTextElement(result.metadata.time.toLocaleDateString(undefined, opts), {
                y: 62, fontSize: 11, fontFamily: 'Raleway', alignment: 'center', color: rc
            });
        }
        const parts = [];
        let distKm = 0;
        if (result.metadata.distance) {
            distKm = result.metadata.distance / 1000;
            parts.push(`${distKm.toFixed(2)} km`);
        }
        if (result.metadata.duration) {
            const h = Math.floor(result.metadata.duration / 3600);
            const m = Math.floor((result.metadata.duration % 3600) / 60);
            const s = Math.floor(result.metadata.duration % 60);
            parts.push(h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`);
        }
        if (result.metadata.duration && distKm > 0) {
            const ps = result.metadata.duration / distKm;
            parts.push(`${Math.floor(ps/60)}:${String(Math.floor(ps%60)).padStart(2,'0')} /km`);
        }
        if (parts.length > 0) {
            textManager.addTextElement(parts.join('   ·   '), {
                y: canvasH - 42, fontSize: 11, fontFamily: 'Montserrat', alignment: 'center', color: rc
            });
        }
    }

    // Update all text element colors to match the route color
    function syncTextColors(color) {
        textManager.getTextElements().forEach(el => {
            textManager.updateTextElement(el.id, { color });
        });
    }

    function showLoading(show) {
        if (loadingOverlay) loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    // --- Page ---
    printSizeSelect.addEventListener('change', e => { routeRenderer.setPrintSize(e.target.value); syncOverlaySize(); });
    orientationBtn.addEventListener('click', () => {
        const o = routeRenderer.orientation === 'portrait' ? 'landscape' : 'portrait';
        routeRenderer.setOrientation(o);
        orientationBtn.textContent = o === 'portrait' ? 'Portrait' : 'Landscape';
        syncOverlaySize();
    });

    // --- Color Mode ---
    colorModeRadios.forEach(r => r.addEventListener('change', e => {
        routeRenderer.setColorMode(e.target.value);
        solidColorControls.style.display = e.target.value === 'speed' ? 'none' : '';
        speedInfo.style.display = e.target.value === 'speed' ? '' : 'none';
    }));

    // --- Colors ---
    routeColorInput.addEventListener('change', e => routeRenderer.setColors(e.target.value, backgroundColorInput.value));
    backgroundColorInput.addEventListener('change', e => {
        routeRenderer.setColors(routeColorInput.value, e.target.value);
        backgroundColor2Input.value = e.target.value;
        if (routeRenderer.showMap && routeRenderer.bounds) routeRenderer.loadMapTiles();
    });
    backgroundColor2Input.addEventListener('change', e => {
        routeRenderer.backgroundColor = e.target.value;
        backgroundColorInput.value = e.target.value;
        if (routeRenderer.coordinates.length > 0) routeRenderer.render();
    });

    heatSlowInput.addEventListener('change', e => routeRenderer.setHeatmapColor('slow', e.target.value));
    heatMediumInput.addEventListener('change', e => routeRenderer.setHeatmapColor('medium', e.target.value));
    heatFastInput.addEventListener('change', e => routeRenderer.setHeatmapColor('fast', e.target.value));

    // --- Custom color toggle ---
    const customColorBtn = $('customColorBtn');
    const customColorRow = $('customColorRow');
    customColorBtn.addEventListener('click', () => {
        const showing = customColorRow.style.display !== 'none';
        customColorRow.style.display = showing ? 'none' : 'flex';
        customColorBtn.textContent = showing ? 'Custom' : 'Hide';
    });

    // --- Presets ---
    document.querySelectorAll('.preset-dot').forEach(btn => {
        btn.addEventListener('click', () => {
            // Activate visual state
            document.querySelectorAll('.preset-dot').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Switch to solid mode
            document.querySelector('input[name="colorMode"][value="solid"]').checked = true;
            routeRenderer.setColorMode('solid');
            solidColorControls.style.display = '';
            speedInfo.style.display = 'none';

            const rc = btn.dataset.route;
            const bg = btn.dataset.bg;
            routeColorInput.value = rc;
            backgroundColorInput.value = bg;
            backgroundColor2Input.value = bg;
            routeRenderer.setColors(rc, bg);

            // Reload map tiles if map is showing (light/dark may have changed)
            if (routeRenderer.showMap && routeRenderer.bounds) routeRenderer.loadMapTiles();

            // Sync text colors to match theme
            syncTextColors(rc);
        });
    });

    // --- Route Controls ---
    lineWidthSlider.addEventListener('input', e => {
        lineWidthValue.textContent = e.target.value;
        routeRenderer.setLineWidth(parseFloat(e.target.value));
    });
    lineStyleSelect.addEventListener('change', e => routeRenderer.setLineStyle(e.target.value));
    smoothingSlider.addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        smoothingValue.textContent = v === 0 ? 'Off' : `${Math.round(v*100)}%`;
        routeRenderer.setSmoothing(v);
    });
    showMarkerToggle.addEventListener('change', e => {
        routeRenderer.showStartMarker = e.target.checked;
        if (routeRenderer.coordinates.length > 0) routeRenderer.render();
    });
    showMapToggle.addEventListener('change', e => {
        routeRenderer.showMap = e.target.checked;
        mapOpacityRow.style.display = e.target.checked ? '' : 'none';
        if (e.target.checked && routeRenderer.bounds) {
            routeRenderer.loadMapTiles();
        } else {
            routeRenderer._mapReady = false;
            if (routeRenderer.coordinates.length > 0) routeRenderer.render();
        }
    });
    mapOpacitySlider.addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        mapOpacityValue.textContent = `${Math.round(v * 100)}%`;
        routeRenderer.mapOpacity = v;
        if (routeRenderer.coordinates.length > 0) routeRenderer.render();
    });

    // --- Text ---
    addTextBtn.addEventListener('click', () => {
        textManager.addTextElement('Custom Text', {
            y: canvas.getBoundingClientRect().height / 2,
            fontSize: 16, fontFamily: 'Montserrat', alignment: 'center',
            color: routeRenderer.routeColor
        });
    });

    // --- Export ---
    exportBtn.addEventListener('click', async () => {
        const name = currentGPSData?.metadata?.name || 'lineart-map';
        try {
            await exportManager.exportImage(exportFormat.value, name.replace(/[^a-z0-9]/gi, '_'));
        } catch (e) {
            alert('Export failed. Try a different format.');
        }
    });

    // --- Reset ---
    resetBtn.addEventListener('click', () => {
        currentGPSData = null;
        routeRenderer.coordinates = [];
        routeRenderer.bounds = null;
        routeRenderer.speeds = [];
        routeRenderer.hasTimeData = false;
        routeRenderer.colorMode = 'solid';
        routeRenderer.showStartMarker = false;
        showMarkerToggle.checked = false;
        routeRenderer.showMap = true;
        routeRenderer.mapOpacity = 0.7;
        routeRenderer._mapReady = false;
        showMapToggle.checked = true;
        mapOpacitySlider.value = '0.7';
        mapOpacityValue.textContent = '70%';
        mapOpacityRow.style.display = '';

        const size = routeRenderer.getSize();
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1,0,0,1,0,0);
        ctx.scale(routeRenderer.canvasScale, routeRenderer.canvasScale);
        ctx.fillStyle = '#F5F0E8';
        ctx.fillRect(0, 0, size.width, size.height);

        textManager.clearAll();
        exportBtn.disabled = true;
        fileUploadArea.classList.remove('file-loaded');
        const prompt = fileUploadArea.querySelector('.upload-prompt span');
        if (prompt) prompt.innerHTML = 'Drop GPS file or <u>browse</u>';
        uploadFeedback.className = 'upload-feedback';
        fileInput.value = '';

        document.querySelector('input[name="colorMode"][value="solid"]').checked = true;
        solidColorControls.style.display = '';
        speedInfo.style.display = 'none';
        document.querySelectorAll('.preset-dot').forEach(b => b.classList.remove('active'));

        routeColorInput.value = '#1B2A4A';
        backgroundColorInput.value = '#F5F0E8';
        backgroundColor2Input.value = '#F5F0E8';
        heatSlowInput.value = '#0000FF';
        heatMediumInput.value = '#00FF00';
        heatFastInput.value = '#FF0000';
        routeRenderer.heatmapColors = { slow:[0,0,255], medium:[0,255,0], fast:[255,0,0] };
        routeRenderer.setColors('#1B2A4A', '#F5F0E8');
        lineWidthSlider.value = '2.5'; lineWidthValue.textContent = '2.5';
        lineStyleSelect.value = 'solid';
        smoothingSlider.value = '0.3'; smoothingValue.textContent = '30%';
        showMarkerToggle.checked = true;
    });

    // --- Resize ---
    function syncOverlaySize() {
        requestAnimationFrame(() => {
            const r = canvas.getBoundingClientRect();
            textOverlay.style.width = `${r.width}px`;
            textOverlay.style.height = `${r.height}px`;

            // Calculate effective display scale (CSS may constrain the canvas)
            const size = routeRenderer.getSize();
            const cssWidth = r.width;
            routeRenderer.displayScale = cssWidth / size.width;
        });
    }
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(syncOverlaySize, 100); });
});
