document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);

    // --- Defaults (single source of truth for reset) ---
    const DEFAULTS = {
        routeColor: '#1B2A4A',
        backgroundColor: '#F5F0E8',
        lineWidth: 2.5,
        smoothing: 0.3,
        lineStyle: 'solid',
        showStartMarker: false,
        showElevation: false,
        showMap: true,
        mapOpacity: 0.7,
        colorMode: 'solid',
        orientation: 'portrait',
        printSize: 'a4',
        heatmapColors: { slow: [0,0,255], medium: [0,255,0], fast: [255,0,0] }
    };

    // --- Instructions Modal (accessible) ---
    const instructionsModal = $('instructionsModal');
    const closeModal = $('closeModal');
    $('instructionsBtn').addEventListener('click', () => {
        instructionsModal.style.display = 'flex';
        instructionsModal.setAttribute('aria-hidden', 'false');
        closeModal.focus();
    });
    function closeInstructions() {
        instructionsModal.style.display = 'none';
        instructionsModal.setAttribute('aria-hidden', 'true');
    }
    closeModal.addEventListener('click', closeInstructions);
    instructionsModal.addEventListener('click', e => { if (e.target === instructionsModal) closeInstructions(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && instructionsModal.style.display !== 'none') closeInstructions();
    });

    // --- DOM refs ---
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
    const showElevationToggle = $('showElevation');
    const elevationRow = $('elevationRow');
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
    let _mapLoadToken = 0; // versioning for async map loads

    routeRenderer.setPrintSize('a4');
    syncOverlaySize();

    // --- Upload (keyboard accessible via label pattern) ---
    fileUploadArea.addEventListener('click', () => fileInput.click());
    fileUploadArea.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
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

            // Auto-load map tiles (versioned)
            if (routeRenderer.showMap) loadMapVersioned();

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

            // Elevation availability
            elevationRow.style.display = routeRenderer.hasElevationData ? '' : 'none';

            // Safe feedback (no innerHTML with user data)
            uploadFeedback.className = 'upload-feedback success';
            uploadFeedback.textContent = '';
            const strong = document.createElement('strong');
            strong.textContent = file.name;
            uploadFeedback.appendChild(strong);
            uploadFeedback.appendChild(document.createTextNode(
                ` — ${result.coordinates.length} pts${routeRenderer.hasTimeData ? ' · speed' : ''}`
            ));

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

    // Text positions in mm (not pixels) so exports are viewport-independent
    function buildDefaultText(result) {
        textManager.clearAll();
        const rc = routeRenderer.routeColor;
        const size = routeRenderer.getSize();
        // Store y in display pixels = mm * displayScale
        const ds = routeRenderer.displayScale;

        if (result.metadata.name) {
            textManager.addTextElement(result.metadata.name.toUpperCase(), {
                y: 18 * ds, fontSize: 11 * ds, fontFamily: 'Playfair Display', alignment: 'center', color: rc
            });
        }
        if (result.metadata.time) {
            const opts = { year: 'numeric', month: 'long', day: 'numeric' };
            textManager.addTextElement(result.metadata.time.toLocaleDateString(undefined, opts), {
                y: 31 * ds, fontSize: 5.5 * ds, fontFamily: 'Raleway', alignment: 'center', color: rc
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
                y: (size.height - 21) * ds, fontSize: 5.5 * ds, fontFamily: 'Montserrat', alignment: 'center', color: rc
            });
        }
    }

    function syncTextColors(color) {
        textManager.getTextElements().forEach(el => {
            textManager.updateTextElement(el.id, { color });
        });
    }

    function showLoading(show) {
        if (loadingOverlay) loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    // Versioned map tile loading — prevents stale renders from old requests
    async function loadMapVersioned() {
        const token = ++_mapLoadToken;
        await routeRenderer.loadMapTiles();
        if (token !== _mapLoadToken) return; // stale
        routeRenderer.render(); // loadMapTiles no longer calls render itself
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
        if (routeRenderer.showMap && routeRenderer.bounds) loadMapVersioned();
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
            document.querySelectorAll('.preset-dot').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

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

            if (routeRenderer.showMap && routeRenderer.bounds) loadMapVersioned();
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
    showElevationToggle.addEventListener('change', e => {
        routeRenderer.showElevation = e.target.checked;
        if (routeRenderer.coordinates.length > 0) routeRenderer.render();
    });
    showMarkerToggle.addEventListener('change', e => {
        routeRenderer.showStartMarker = e.target.checked;
        if (routeRenderer.coordinates.length > 0) routeRenderer.render();
    });
    showMapToggle.addEventListener('change', e => {
        routeRenderer.showMap = e.target.checked;
        mapOpacityRow.style.display = e.target.checked ? '' : 'none';
        if (e.target.checked && routeRenderer.bounds) {
            loadMapVersioned();
        } else {
            routeRenderer._mapReady = false;
            if (routeRenderer.coordinates.length > 0) routeRenderer.render();
        }
    });
    mapOpacitySlider.addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        mapOpacityValue.textContent = `${Math.round(v * 100)}%`;
        routeRenderer.setMapOpacity(v);
    });

    // --- Text ---
    addTextBtn.addEventListener('click', () => {
        const ds = routeRenderer.displayScale;
        const size = routeRenderer.getSize();
        textManager.addTextElement('Custom Text', {
            y: (size.height / 2) * ds,
            fontSize: 8 * ds, fontFamily: 'Montserrat', alignment: 'center',
            color: routeRenderer.routeColor
        });
    });

    // --- Export (wait for map if loading) ---
    exportBtn.addEventListener('click', async () => {
        const name = currentGPSData?.metadata?.name || 'lineart-map';
        try {
            // If map is enabled but not ready, wait briefly
            if (routeRenderer.showMap && !routeRenderer._mapReady && routeRenderer.bounds) {
                exportBtn.textContent = 'Loading map…';
                await routeRenderer.loadMapTiles();
            }
            await exportManager.exportImage(exportFormat.value, name.replace(/[^a-z0-9]/gi, '_'));
        } catch (e) {
            alert('Export failed. Try a different format.');
        } finally {
            exportBtn.textContent = 'Download';
        }
    });

    // --- Reset (centralized through DEFAULTS) ---
    resetBtn.addEventListener('click', () => {
        currentGPSData = null;
        _mapLoadToken++;

        // Reset renderer state
        routeRenderer.coordinates = [];
        routeRenderer.bounds = null;
        routeRenderer.speeds = [];
        routeRenderer.hasTimeData = false;
        routeRenderer.hasElevationData = false;
        routeRenderer.colorMode = DEFAULTS.colorMode;
        routeRenderer.showStartMarker = DEFAULTS.showStartMarker;
        routeRenderer.showElevation = DEFAULTS.showElevation;
        routeRenderer.showMap = DEFAULTS.showMap;
        routeRenderer.mapOpacity = DEFAULTS.mapOpacity;
        routeRenderer._mapReady = false;
        routeRenderer._mapCompositeDirty = true;
        routeRenderer._mapCompositeCache = null;
        routeRenderer.heatmapColors = { ...DEFAULTS.heatmapColors };
        routeRenderer.setColors(DEFAULTS.routeColor, DEFAULTS.backgroundColor);
        routeRenderer.setLineWidth(DEFAULTS.lineWidth);
        routeRenderer.setSmoothing(DEFAULTS.smoothing);
        routeRenderer.setLineStyle(DEFAULTS.lineStyle);
        routeRenderer.orientation = DEFAULTS.orientation;
        routeRenderer.printSize = DEFAULTS.printSize;
        routeRenderer.updateCanvasSize();

        // Clear canvas
        const size = routeRenderer.getSize();
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1,0,0,1,0,0);
        ctx.scale(routeRenderer.canvasScale, routeRenderer.canvasScale);
        ctx.fillStyle = DEFAULTS.backgroundColor;
        ctx.fillRect(0, 0, size.width, size.height);

        textManager.clearAll();
        exportBtn.disabled = true;

        // Reset upload area
        fileUploadArea.classList.remove('file-loaded');
        const prompt = fileUploadArea.querySelector('.upload-prompt span');
        if (prompt) prompt.textContent = 'Drop GPS file or browse';
        uploadFeedback.className = 'upload-feedback';
        uploadFeedback.textContent = '';
        fileInput.value = '';

        // Reset UI controls to match DEFAULTS
        document.querySelector('input[name="colorMode"][value="solid"]').checked = true;
        solidColorControls.style.display = '';
        speedInfo.style.display = 'none';
        document.querySelectorAll('.preset-dot').forEach(b => b.classList.remove('active'));
        customColorRow.style.display = 'none';
        customColorBtn.textContent = 'Custom';

        routeColorInput.value = DEFAULTS.routeColor;
        backgroundColorInput.value = DEFAULTS.backgroundColor;
        backgroundColor2Input.value = DEFAULTS.backgroundColor;
        heatSlowInput.value = '#0000FF';
        heatMediumInput.value = '#00FF00';
        heatFastInput.value = '#FF0000';
        lineWidthSlider.value = String(DEFAULTS.lineWidth);
        lineWidthValue.textContent = String(DEFAULTS.lineWidth);
        lineStyleSelect.value = DEFAULTS.lineStyle;
        smoothingSlider.value = String(DEFAULTS.smoothing);
        smoothingValue.textContent = `${Math.round(DEFAULTS.smoothing * 100)}%`;
        showMarkerToggle.checked = DEFAULTS.showStartMarker;
        showElevationToggle.checked = DEFAULTS.showElevation;
        elevationRow.style.display = 'none';
        showMapToggle.checked = DEFAULTS.showMap;
        mapOpacitySlider.value = String(DEFAULTS.mapOpacity);
        mapOpacityValue.textContent = `${Math.round(DEFAULTS.mapOpacity * 100)}%`;
        mapOpacityRow.style.display = '';
        orientationBtn.textContent = 'Portrait';
        printSizeSelect.value = DEFAULTS.printSize;
    });

    // --- Resize ---
    function syncOverlaySize() {
        requestAnimationFrame(() => {
            const r = canvas.getBoundingClientRect();
            textOverlay.style.width = `${r.width}px`;
            textOverlay.style.height = `${r.height}px`;
            const size = routeRenderer.getSize();
            routeRenderer.displayScale = r.width / size.width;
        });
    }
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(syncOverlaySize, 100); });
});
