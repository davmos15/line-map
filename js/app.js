document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('fileInput');
    const uploadFeedback = document.getElementById('uploadFeedback');
    const printSizeSelect = document.getElementById('printSize');
    const orientationBtn = document.getElementById('orientationBtn');
    const routeColorInput = document.getElementById('routeColor');
    const backgroundColorInput = document.getElementById('backgroundColor');
    const lineWidthSlider = document.getElementById('lineWidth');
    const lineWidthValue = document.getElementById('lineWidthValue');
    const lineStyleSelect = document.getElementById('lineStyle');
    const smoothingSlider = document.getElementById('smoothing');
    const smoothingValue = document.getElementById('smoothingValue');
    const addTextBtn = document.getElementById('addTextBtn');
    const exportBtn = document.getElementById('exportBtn');
    const exportFormat = document.getElementById('exportFormat');
    const resetBtn = document.getElementById('resetBtn');
    const canvas = document.getElementById('routeCanvas');
    const textOverlay = document.getElementById('textOverlay');
    const loadingOverlay = document.getElementById('loadingOverlay');

    // Initialize managers
    const routeRenderer = new RouteRenderer(canvas);
    const textManager = new TextManager(textOverlay);
    const exportManager = new ExportManager(routeRenderer, textManager);

    let currentGPSData = null;

    // Initialize canvas
    routeRenderer.setPrintSize('a4');
    syncOverlaySize();

    // --- File Upload ---
    fileUploadArea.addEventListener('click', () => fileInput.click());

    fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadArea.classList.add('drag-over');
    });

    fileUploadArea.addEventListener('dragleave', () => {
        fileUploadArea.classList.remove('drag-over');
    });

    fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFileUpload(e.target.files[0]);
    });

    async function handleFileUpload(file) {
        try {
            showLoading(true);
            uploadFeedback.className = 'upload-feedback';

            const result = await GPSParser.parseFile(file);
            currentGPSData = result;

            if (result.coordinates.length === 0) {
                throw new Error('No GPS coordinates found in file');
            }

            routeRenderer.loadCoordinates(result.coordinates);

            // Show file info
            uploadFeedback.className = 'upload-feedback success';
            uploadFeedback.innerHTML = `
                <strong>${file.name}</strong><br>
                ${result.coordinates.length} GPS points loaded
            `;

            // Update upload area to show loaded state
            fileUploadArea.classList.add('file-loaded');
            const prompt = fileUploadArea.querySelector('.upload-prompt');
            if (prompt) {
                prompt.querySelector('p').textContent = `${file.name} loaded — drop another file to replace`;
            }

            exportBtn.disabled = false;

            // Add default text elements with metadata
            textManager.clearAll();

            if (result.metadata.name) {
                textManager.addTextElement(result.metadata.name, {
                    x: 50, y: 50, fontSize: 24, fontFamily: 'Playfair Display'
                });
            }

            if (result.metadata.time) {
                textManager.addTextElement(result.metadata.time.toLocaleDateString(), {
                    x: 50, y: 80, fontSize: 16, fontFamily: 'Montserrat'
                });
            }

            if (result.metadata.distance) {
                const distKm = (result.metadata.distance / 1000).toFixed(2);
                textManager.addTextElement(`${distKm} km`, {
                    x: 50, y: 110, fontSize: 16, fontFamily: 'Montserrat'
                });
            }

            if (result.metadata.duration) {
                const h = Math.floor(result.metadata.duration / 3600);
                const m = Math.floor((result.metadata.duration % 3600) / 60);
                textManager.addTextElement(h > 0 ? `${h}h ${m}m` : `${m}m`, {
                    x: 50, y: 140, fontSize: 16, fontFamily: 'Montserrat'
                });
            }

            syncOverlaySize();
        } catch (error) {
            uploadFeedback.className = 'upload-feedback error';
            uploadFeedback.textContent = `Error: ${error.message}`;
            console.error('File upload error:', error);
        } finally {
            showLoading(false);
        }
    }

    function showLoading(show) {
        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    // --- Print Size ---
    printSizeSelect.addEventListener('change', (e) => {
        routeRenderer.setPrintSize(e.target.value);
        syncOverlaySize();
    });

    // --- Orientation ---
    orientationBtn.addEventListener('click', () => {
        const newOrientation = routeRenderer.orientation === 'portrait' ? 'landscape' : 'portrait';
        routeRenderer.setOrientation(newOrientation);
        orientationBtn.textContent = newOrientation === 'portrait' ? 'Portrait' : 'Landscape';
        orientationBtn.title = `Switch to ${newOrientation === 'portrait' ? 'landscape' : 'portrait'}`;
        syncOverlaySize();
    });

    // --- Colors ---
    routeColorInput.addEventListener('change', (e) => {
        routeRenderer.setColors(e.target.value, backgroundColorInput.value);
    });
    backgroundColorInput.addEventListener('change', (e) => {
        routeRenderer.setColors(routeColorInput.value, e.target.value);
    });

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            routeColorInput.value = btn.dataset.route;
            backgroundColorInput.value = btn.dataset.bg;
            routeRenderer.setColors(btn.dataset.route, btn.dataset.bg);
        });
    });

    // --- Line Width ---
    lineWidthSlider.addEventListener('input', (e) => {
        const w = parseFloat(e.target.value);
        lineWidthValue.textContent = `${w}px`;
        routeRenderer.setLineWidth(w);
    });

    // --- Line Style ---
    lineStyleSelect.addEventListener('change', (e) => {
        routeRenderer.setLineStyle(e.target.value);
    });

    // --- Smoothing ---
    smoothingSlider.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        smoothingValue.textContent = v === 0 ? 'Off' : `${Math.round(v * 100)}%`;
        routeRenderer.setSmoothing(v);
    });

    // --- Text ---
    addTextBtn.addEventListener('click', () => {
        const canvasRect = canvas.getBoundingClientRect();
        textManager.addTextElement('Custom Text', {
            x: canvasRect.width / 2 - 50,
            y: canvasRect.height / 2,
            fontSize: 20,
            fontFamily: 'Montserrat'
        });
    });

    // --- Export ---
    exportBtn.addEventListener('click', async () => {
        const format = exportFormat.value;
        const filename = currentGPSData?.metadata?.name || 'lineart-map';
        try {
            await exportManager.exportImage(format, filename.replace(/[^a-z0-9]/gi, '_'));
        } catch (error) {
            console.error('Export error:', error);
            alert('Export failed. Please try a different format.');
        }
    });

    // --- Reset ---
    resetBtn.addEventListener('click', () => {
        currentGPSData = null;
        routeRenderer.coordinates = [];
        routeRenderer.bounds = null;

        // Clear canvas
        const size = routeRenderer.getSize();
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(routeRenderer.canvasScale, routeRenderer.canvasScale);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size.width, size.height);

        textManager.clearAll();
        exportBtn.disabled = true;

        // Reset upload area
        fileUploadArea.classList.remove('file-loaded');
        const prompt = fileUploadArea.querySelector('.upload-prompt');
        if (prompt) {
            prompt.querySelector('p').textContent = 'Drag & drop your GPS file here or click to browse';
        }
        uploadFeedback.className = 'upload-feedback';
        uploadFeedback.textContent = '';
        fileInput.value = '';

        // Reset controls to defaults
        routeColorInput.value = '#000000';
        backgroundColorInput.value = '#FFFFFF';
        routeRenderer.setColors('#000000', '#FFFFFF');
        lineWidthSlider.value = '2';
        lineWidthValue.textContent = '2px';
        lineStyleSelect.value = 'solid';
        smoothingSlider.value = '0';
        smoothingValue.textContent = 'Off';
    });

    // --- Resize Handling ---
    function syncOverlaySize() {
        requestAnimationFrame(() => {
            const rect = canvas.getBoundingClientRect();
            textOverlay.style.width = `${rect.width}px`;
            textOverlay.style.height = `${rect.height}px`;
        });
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(syncOverlaySize, 100);
    });
});
