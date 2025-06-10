class GPSParser {
    static async parseFile(file) {
        const fileType = file.name.split('.').pop().toLowerCase();
        const text = await file.text();
        
        switch(fileType) {
            case 'gpx':
                return this.parseGPX(text);
            case 'tcx':
                return this.parseTCX(text);
            case 'fit':
                return this.parseFIT(file);
            default:
                throw new Error('Unsupported file format');
        }
    }

    static parseGPX(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
            throw new Error('Invalid GPX file format');
        }

        const coordinates = [];
        const metadata = {
            name: '',
            time: null,
            distance: 0,
            duration: null
        };

        const nameElement = xmlDoc.querySelector('name');
        if (nameElement) {
            metadata.name = nameElement.textContent;
        }

        const timeElement = xmlDoc.querySelector('time');
        if (timeElement) {
            metadata.time = new Date(timeElement.textContent);
        }

        const trackpoints = xmlDoc.querySelectorAll('trkpt');
        const waypoints = xmlDoc.querySelectorAll('wpt');
        const points = trackpoints.length > 0 ? trackpoints : waypoints;

        let prevPoint = null;
        let firstTime = null;
        let lastTime = null;

        points.forEach(point => {
            const lat = parseFloat(point.getAttribute('lat'));
            const lon = parseFloat(point.getAttribute('lon'));
            
            if (!isNaN(lat) && !isNaN(lon)) {
                coordinates.push({ lat, lon });

                const timeElem = point.querySelector('time');
                if (timeElem) {
                    const time = new Date(timeElem.textContent);
                    if (!firstTime) firstTime = time;
                    lastTime = time;
                }

                if (prevPoint) {
                    metadata.distance += this.calculateDistance(prevPoint, { lat, lon });
                }
                prevPoint = { lat, lon };
            }
        });

        if (firstTime && lastTime) {
            metadata.duration = (lastTime - firstTime) / 1000; // seconds
        }

        return { coordinates, metadata };
    }

    static parseTCX(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
            throw new Error('Invalid TCX file format');
        }

        const coordinates = [];
        const metadata = {
            name: '',
            time: null,
            distance: 0,
            duration: null
        };

        const activityElement = xmlDoc.querySelector('Activity');
        if (activityElement) {
            const sport = activityElement.getAttribute('Sport');
            if (sport) metadata.name = sport;
        }

        const idElement = xmlDoc.querySelector('Id');
        if (idElement) {
            metadata.time = new Date(idElement.textContent);
        }

        const trackpoints = xmlDoc.querySelectorAll('Trackpoint');
        let prevPoint = null;
        let firstTime = null;
        let lastTime = null;

        trackpoints.forEach(point => {
            const latElem = point.querySelector('LatitudeDegrees');
            const lonElem = point.querySelector('LongitudeDegrees');
            
            if (latElem && lonElem) {
                const lat = parseFloat(latElem.textContent);
                const lon = parseFloat(lonElem.textContent);
                
                if (!isNaN(lat) && !isNaN(lon)) {
                    coordinates.push({ lat, lon });

                    const timeElem = point.querySelector('Time');
                    if (timeElem) {
                        const time = new Date(timeElem.textContent);
                        if (!firstTime) firstTime = time;
                        lastTime = time;
                    }

                    if (prevPoint) {
                        metadata.distance += this.calculateDistance(prevPoint, { lat, lon });
                    }
                    prevPoint = { lat, lon };
                }
            }
        });

        const distanceElem = xmlDoc.querySelector('DistanceMeters');
        if (distanceElem) {
            metadata.distance = parseFloat(distanceElem.textContent);
        }

        const totalTimeElem = xmlDoc.querySelector('TotalTimeSeconds');
        if (totalTimeElem) {
            metadata.duration = parseFloat(totalTimeElem.textContent);
        } else if (firstTime && lastTime) {
            metadata.duration = (lastTime - firstTime) / 1000;
        }

        return { coordinates, metadata };
    }

    static async parseFIT(file) {
        if (typeof FitParser === 'undefined') {
            throw new Error('FIT parser library not loaded');
        }

        const arrayBuffer = await file.arrayBuffer();
        const fitParser = new FitParser();
        
        const { records, sessions } = fitParser.parse(arrayBuffer);
        
        const coordinates = [];
        const metadata = {
            name: file.name.replace('.fit', ''),
            time: null,
            distance: 0,
            duration: null
        };

        if (sessions && sessions.length > 0) {
            const session = sessions[0];
            if (session.start_time) {
                metadata.time = new Date(session.start_time);
            }
            if (session.total_distance) {
                metadata.distance = session.total_distance;
            }
            if (session.total_elapsed_time) {
                metadata.duration = session.total_elapsed_time;
            }
        }

        let prevPoint = null;
        records.forEach(record => {
            if (record.position_lat && record.position_long) {
                const lat = record.position_lat * (180 / Math.pow(2, 31));
                const lon = record.position_long * (180 / Math.pow(2, 31));
                
                coordinates.push({ lat, lon });

                if (!metadata.distance && prevPoint) {
                    metadata.distance += this.calculateDistance(prevPoint, { lat, lon });
                }
                prevPoint = { lat, lon };
            }
        });

        return { coordinates, metadata };
    }

    static calculateDistance(point1, point2) {
        const R = 6371000; // Earth's radius in meters
        const dLat = this.toRad(point2.lat - point1.lat);
        const dLon = this.toRad(point2.lon - point1.lon);
        const lat1 = this.toRad(point1.lat);
        const lat2 = this.toRad(point2.lat);

        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return R * c;
    }

    static toRad(deg) {
        return deg * (Math.PI / 180);
    }
}