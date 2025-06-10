// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('fileInput');
    const uploadFeedback = document.getElementById('uploadFeedback');
    const printSizeSelect = document.getElementById('printSize');
    const routeColorInput = document.getElementById('routeColor');
    const backgroundColorInput = document.getElementById('backgroundColor');
    const addTextBtn = document.getElementById('addTextBtn');
    const exportBtn = document.getElementById('exportBtn');
    const exportFormat = document.getElementById('exportFormat');
    const canvas = document.getElementById('routeCanvas');
    const textOverlay = document.getElementById('textOverlay');
    const canvasContainer = document.getElementById('canvasContainer');

    // Initialize managers
    const routeRenderer = new RouteRenderer(canvas);
    const textManager = new TextManager(textOverlay);
    const exportManager = new ExportManager(routeRenderer, textManager);

    // Current GPS data
    let currentGPSData = null;

    // Initialize canvas size
    routeRenderer.setPrintSize('a4');

    // File upload handling
    fileUploadArea.addEventListener('click', () => {
        fileInput.click();
    });

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
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileUpload(file);
        }
    });

    async function handleFileUpload(file) {
        try {
            uploadFeedback.className = 'upload-feedback';
            uploadFeedback.textContent = 'Processing file...';
            uploadFeedback.classList.add('success');

            const result = await GPSParser.parseFile(file);
            currentGPSData = result;

            if (result.coordinates.length === 0) {
                throw new Error('No GPS coordinates found in file');
            }

            // Load route into renderer
            routeRenderer.loadCoordinates(result.coordinates);
            
            // Update feedback
            uploadFeedback.textContent = `Successfully loaded ${result.coordinates.length} points`;
            
            // Enable export button
            exportBtn.disabled = false;

            // Add default text elements with metadata
            textManager.clearAll();
            
            if (result.metadata.name) {
                textManager.addTextElement(result.metadata.name, {
                    x: 50,
                    y: 50,
                    fontSize: 24,
                    fontFamily: 'Arial'
                });
            }

            if (result.metadata.time) {
                const dateStr = result.metadata.time.toLocaleDateString();
                textManager.addTextElement(dateStr, {
                    x: 50,
                    y: 80,
                    fontSize: 16,
                    fontFamily: 'Arial'
                });
            }

            if (result.metadata.distance) {
                const distanceKm = (result.metadata.distance / 1000).toFixed(2);
                textManager.addTextElement(`${distanceKm} km`, {
                    x: 50,
                    y: 110,
                    fontSize: 16,
                    fontFamily: 'Arial'
                });
            }

            if (result.metadata.duration) {
                const hours = Math.floor(result.metadata.duration / 3600);
                const minutes = Math.floor((result.metadata.duration % 3600) / 60);
                const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                textManager.addTextElement(durationStr, {
                    x: 50,
                    y: 140,
                    fontSize: 16,
                    fontFamily: 'Arial'
                });
            }

        } catch (error) {
            uploadFeedback.className = 'upload-feedback';
            uploadFeedback.textContent = `Error: ${error.message}`;
            uploadFeedback.classList.add('error');
            console.error('File upload error:', error);
        }
    }

    // Print size handling
    printSizeSelect.addEventListener('change', (e) => {
        routeRenderer.setPrintSize(e.target.value);
        
        // Update text overlay size to match canvas
        const canvasRect = canvas.getBoundingClientRect();
        textOverlay.style.width = `${canvasRect.width}px`;
        textOverlay.style.height = `${canvasRect.height}px`;
    });

    // Color handling
    routeColorInput.addEventListener('change', (e) => {
        routeRenderer.setColors(e.target.value, backgroundColorInput.value);
    });

    backgroundColorInput.addEventListener('change', (e) => {
        routeRenderer.setColors(routeColorInput.value, e.target.value);
    });

    // Color presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const routeColor = btn.dataset.route;
            const bgColor = btn.dataset.bg;
            
            routeColorInput.value = routeColor;
            backgroundColorInput.value = bgColor;
            
            routeRenderer.setColors(routeColor, bgColor);
        });
    });

    // Text management
    addTextBtn.addEventListener('click', () => {
        const canvasRect = canvas.getBoundingClientRect();
        const centerX = canvasRect.width / 2;
        const centerY = canvasRect.height / 2;
        
        textManager.addTextElement('Custom Text', {
            x: centerX - 50,
            y: centerY,
            fontSize: 20,
            fontFamily: 'Arial'
        });
    });

    // Export handling
    exportBtn.addEventListener('click', async () => {
        const format = exportFormat.value;
        const filename = currentGPSData?.metadata?.name || 'route-map';
        
        try {
            await exportManager.exportImage(format, filename.replace(/[^a-z0-9]/gi, '_'));
        } catch (error) {
            console.error('Export error:', error);
            alert('Export failed. Please try a different format.');
        }
    });

    // Window resize handling
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const canvasRect = canvas.getBoundingClientRect();
            textOverlay.style.width = `${canvasRect.width}px`;
            textOverlay.style.height = `${canvasRect.height}px`;
        }, 100);
    });

    // Initial text overlay size
    setTimeout(() => {
        const canvasRect = canvas.getBoundingClientRect();
        textOverlay.style.width = `${canvasRect.width}px`;
        textOverlay.style.height = `${canvasRect.height}px`;
    }, 0);
});