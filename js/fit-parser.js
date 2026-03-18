// Proper FIT file parser implementing the FIT SDK binary protocol
class FitParser {
    constructor() {
        this.definitions = {};
        this.records = [];
        this.sessions = [];
    }

    parse(arrayBuffer) {
        const view = new DataView(arrayBuffer);
        let offset = 0;

        // Parse file header
        const headerSize = view.getUint8(0);
        if (headerSize < 12) {
            throw new Error('Invalid FIT file: header too small');
        }

        const dataSize = view.getUint32(4, true);
        const sig = String.fromCharCode(
            view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)
        );
        if (sig !== '.FIT') {
            throw new Error('Invalid FIT file: missing .FIT signature');
        }

        offset = headerSize;
        const dataEnd = Math.min(headerSize + dataSize, arrayBuffer.byteLength - 2);

        this.definitions = {};
        this.records = [];
        this.sessions = [];

        while (offset < dataEnd) {
            const newOffset = this._parseRecord(view, offset, dataEnd);
            if (newOffset <= offset) break; // prevent infinite loop
            offset = newOffset;
        }

        return {
            records: this.records,
            sessions: this.sessions
        };
    }

    _parseRecord(view, offset, end) {
        if (offset >= end) return end;

        const header = view.getUint8(offset);
        offset++;

        // Compressed timestamp header
        if ((header & 0x80) !== 0) {
            const localMsgType = (header >> 5) & 0x03;
            return this._readDataMessage(view, offset, localMsgType, end);
        }

        const isDefinition = (header & 0x40) !== 0;
        const hasDev = (header & 0x20) !== 0;
        const localMsgType = header & 0x0F;

        if (isDefinition) {
            return this._readDefinition(view, offset, localMsgType, hasDev, end);
        } else {
            return this._readDataMessage(view, offset, localMsgType, end);
        }
    }

    _readDefinition(view, offset, localMsgType, hasDev, end) {
        if (offset + 5 > end) return end;

        offset++; // reserved
        const arch = view.getUint8(offset); offset++;
        const littleEndian = arch === 0;
        const globalMsgNum = view.getUint16(offset, littleEndian); offset += 2;
        const numFields = view.getUint8(offset); offset++;

        if (offset + numFields * 3 > end) return end;

        const fields = [];
        for (let i = 0; i < numFields; i++) {
            fields.push({
                defNum: view.getUint8(offset),
                size: view.getUint8(offset + 1),
                baseType: view.getUint8(offset + 2)
            });
            offset += 3;
        }

        if (hasDev) {
            if (offset >= end) return end;
            const numDev = view.getUint8(offset); offset++;
            if (offset + numDev * 3 > end) return end;
            offset += numDev * 3;
        }

        this.definitions[localMsgType] = { globalMsgNum, littleEndian, fields };
        return offset;
    }

    _readDataMessage(view, offset, localMsgType, end) {
        const def = this.definitions[localMsgType];
        if (!def) return end; // can't parse without definition

        const values = {};
        for (const field of def.fields) {
            if (offset + field.size > end) return end;
            values[field.defNum] = this._readValue(view, offset, field.size, field.baseType, def.littleEndian);
            offset += field.size;
        }

        // Global message 20 = record (GPS data)
        if (def.globalMsgNum === 20) {
            const lat = values[0];
            const lon = values[1];
            // 0x7FFFFFFF is the invalid sentinel for sint32
            if (lat != null && lon != null && lat !== 0x7FFFFFFF && lon !== 0x7FFFFFFF &&
                lat !== -2147483648 && lon !== -2147483648) {
                this.records.push({
                    position_lat: lat,
                    position_long: lon,
                    timestamp: values[253] || null,
                    distance: values[5] != null ? values[5] / 100 : null
                });
            }
        }

        // Global message 18 = session
        if (def.globalMsgNum === 18) {
            const session = {};
            if (values[2] != null) {
                // FIT timestamps are seconds since 1989-12-31 00:00:00 UTC
                session.start_time = new Date((values[2] + 631065600) * 1000);
            }
            if (values[7] != null) session.total_elapsed_time = values[7] / 1000;
            if (values[9] != null) session.total_distance = values[9] / 100;
            if (values[5] != null) session.sport = values[5];
            this.sessions.push(session);
        }

        return offset;
    }

    _readValue(view, offset, size, baseType, le) {
        const t = baseType & 0x1F;
        try {
            switch (t) {
                case 0: case 2: case 10: // enum, uint8, uint8z
                    return view.getUint8(offset);
                case 1: // sint8
                    return view.getInt8(offset);
                case 3: // sint16
                    return size >= 2 ? view.getInt16(offset, le) : null;
                case 4: case 11: // uint16, uint16z
                    return size >= 2 ? view.getUint16(offset, le) : null;
                case 5: // sint32
                    return size >= 4 ? view.getInt32(offset, le) : null;
                case 6: case 12: // uint32, uint32z
                    return size >= 4 ? view.getUint32(offset, le) : null;
                case 7: { // string
                    let s = '';
                    for (let i = 0; i < size; i++) {
                        const c = view.getUint8(offset + i);
                        if (c === 0) break;
                        s += String.fromCharCode(c);
                    }
                    return s;
                }
                case 8: // float32
                    return size >= 4 ? view.getFloat32(offset, le) : null;
                case 9: // float64
                    return size >= 8 ? view.getFloat64(offset, le) : null;
                default:
                    return null;
            }
        } catch (e) {
            return null;
        }
    }
}
