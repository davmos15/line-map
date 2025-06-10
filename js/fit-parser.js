// Simple FIT file parser for basic coordinate extraction
class FitParser {
    constructor() {
        this.records = [];
        this.sessions = [];
    }

    parse(arrayBuffer) {
        const dataView = new DataView(arrayBuffer);
        let offset = 0;

        // Read FIT file header (12 or 14 bytes)
        const headerSize = dataView.getUint8(offset);
        offset += headerSize;

        // Simple parsing - extract record messages with GPS data
        const records = [];
        const sessions = [];

        try {
            while (offset < arrayBuffer.byteLength - 2) {
                const recordHeader = dataView.getUint8(offset);
                offset++;

                // Check if it's a definition message or data message
                if ((recordHeader & 0x40) === 0x40) {
                    // Definition message - skip for now
                    const reserved = dataView.getUint8(offset);
                    offset++;
                    const arch = dataView.getUint8(offset);
                    offset++;
                    const globalMsgNum = dataView.getUint16(offset, true);
                    offset += 2;
                    const numFields = dataView.getUint8(offset);
                    offset++;
                    
                    // Skip field definitions
                    offset += numFields * 3;
                } else {
                    // Data message - try to extract GPS coordinates
                    // This is a simplified extraction - real FIT parsing is more complex
                    const localMsgType = recordHeader & 0x0F;
                    
                    // Look for common GPS data patterns
                    if (offset + 16 <= arrayBuffer.byteLength) {
                        const possibleLat = dataView.getInt32(offset, true);
                        const possibleLon = dataView.getInt32(offset + 4, true);
                        
                        // Check if values are in valid GPS range
                        if (Math.abs(possibleLat) < 2147483647 && Math.abs(possibleLon) < 2147483647) {
                            records.push({
                                position_lat: possibleLat,
                                position_long: possibleLon
                            });
                        }
                        
                        offset += 8;
                    } else {
                        break;
                    }
                }

                // Safety check to prevent infinite loops
                if (offset >= arrayBuffer.byteLength - 2) {
                    break;
                }
            }
        } catch (e) {
            console.warn('FIT parsing error:', e);
        }

        this.records = records;
        this.sessions = sessions;
        
        return {
            records: this.records,
            sessions: this.sessions
        };
    }
}