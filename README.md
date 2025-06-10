# Route Visualizer Web App

A web application that converts GPS activity files (GPX, TCX, FIT) into customizable line drawings suitable for printing.

## Features

- **File Upload**: Support for GPX, TCX, and FIT format GPS files
- **Route Visualization**: Clean line drawing representation of GPS tracks
- **Print Sizes**: A5, A4, A3, A2, A1, A0 formats
- **Text Customization**: 
  - Add multiple text elements
  - Drag-and-drop positioning
  - Font size, family, color, and alignment controls
- **Color Customization**: Route line and background colors with presets
- **Export Options**: PNG, SVG, and PDF formats at high resolution

## Running the Application

### Option 1: Python Server (Recommended)
```bash
python3 server.py
```
Then open http://localhost:8000 in your browser.

### Option 2: Direct File Access
Open `index.html` directly in a modern web browser (some features may be limited).

## Usage

1. **Upload GPS File**: Drag and drop or click to browse for GPX, TCX, or FIT files
2. **Select Print Size**: Choose from standard paper sizes (A5-A0)
3. **Customize Colors**: Use color pickers or presets for route and background
4. **Add Text**: Click "Add Text" to add customizable text elements
   - Drag text to position
   - Edit content, font, size, color, and alignment
5. **Export**: Choose format (PNG/SVG/PDF) and click "Download Image"

## Technical Details

- Pure JavaScript implementation (no framework dependencies)
- HTML5 Canvas for rendering
- High-resolution export support
- Mobile responsive design
- Drag-and-drop text positioning

## Browser Support

Works best in modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## File Format Support

- **GPX**: Standard GPS Exchange Format
- **TCX**: Garmin Training Center XML
- **FIT**: Flexible and Interoperable Data Transfer (basic support)