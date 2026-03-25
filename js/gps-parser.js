class GPSParser {
    static async parseFile(file) {
        const fileType = file.name.split('.').pop().toLowerCase();

        switch (fileType) {
            case 'gpx':
                return this.parseGPX(await file.text());
            case 'tcx':
                return this.parseTCX(await file.text());
            case 'fit':
                return this.parseFIT(file);
            default:
                throw new Error('Unsupported file format. Please use GPX, TCX, or FIT.');
        }
    }

    static parseGPX(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        if (xmlDoc.querySelector('parsererror')) {
            throw new Error('Invalid GPX file format');
        }

        const coordinates = [];
        const metadata = { name: '', time: null, distance: 0, duration: null };

        // Prefer trk > name or metadata > name over any random <name>
        const nameElement = xmlDoc.querySelector('trk > name') ||
                            xmlDoc.querySelector('metadata > name') ||
                            xmlDoc.querySelector('rte > name') ||
                            xmlDoc.querySelector('name');
        if (nameElement) metadata.name = nameElement.textContent;

        const timeElement = xmlDoc.querySelector('metadata > time, gpx > time');
        if (timeElement) metadata.time = new Date(timeElement.textContent);

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
                const coord = { lat, lon, time: null, ele: null };

                const timeElem = point.querySelector('time');
                if (timeElem) {
                    coord.time = new Date(timeElem.textContent);
                    if (!firstTime) firstTime = coord.time;
                    lastTime = coord.time;
                }

                const eleElem = point.querySelector('ele');
                if (eleElem) coord.ele = parseFloat(eleElem.textContent);

                coordinates.push(coord);

                if (prevPoint) {
                    metadata.distance += this.calculateDistance(prevPoint, { lat, lon });
                }
                prevPoint = { lat, lon };
            }
        });

        if (!metadata.time && firstTime) metadata.time = firstTime;
        if (firstTime && lastTime) {
            metadata.duration = (lastTime - firstTime) / 1000;
        }

        return { coordinates, metadata };
    }

    static parseTCX(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        if (xmlDoc.querySelector('parsererror')) {
            throw new Error('Invalid TCX file format');
        }

        const coordinates = [];
        const metadata = { name: '', time: null, distance: 0, duration: null };

        // Try to get activity name from Sport attribute
        const activityElement = xmlDoc.querySelector('Activity');
        if (activityElement) {
            const sport = activityElement.getAttribute('Sport');
            if (sport) metadata.name = sport;
        }

        // Fallback: try Notes element for a custom name
        if (!metadata.name) {
            const notesElem = xmlDoc.querySelector('Notes');
            if (notesElem && notesElem.textContent.trim()) {
                metadata.name = notesElem.textContent.trim();
            }
        }

        // Get start time from Id element
        const idElement = xmlDoc.querySelector('Id');
        if (idElement) {
            const d = new Date(idElement.textContent);
            if (!isNaN(d.getTime())) metadata.time = d;
        }

        // Aggregate distance and duration across all Laps
        const laps = xmlDoc.querySelectorAll('Lap');
        let totalDist = 0, totalTime = 0;
        laps.forEach(lap => {
            const distElem = lap.querySelector('DistanceMeters');
            const timeElem = lap.querySelector('TotalTimeSeconds');
            if (distElem) totalDist += parseFloat(distElem.textContent) || 0;
            if (timeElem) totalTime += parseFloat(timeElem.textContent) || 0;
        });
        if (totalDist > 0) metadata.distance = totalDist;
        if (totalTime > 0) metadata.duration = totalTime;

        // Extract coordinates with timestamps
        const trackpoints = xmlDoc.querySelectorAll('Trackpoint');
        let prevPoint = null;
        let firstTime = null;
        let lastTime = null;
        let calcDist = 0;

        trackpoints.forEach(point => {
            const latElem = point.querySelector('LatitudeDegrees');
            const lonElem = point.querySelector('LongitudeDegrees');

            if (latElem && lonElem) {
                const lat = parseFloat(latElem.textContent);
                const lon = parseFloat(lonElem.textContent);

                if (!isNaN(lat) && !isNaN(lon)) {
                    const coord = { lat, lon, time: null, ele: null };

                    const timeElem = point.querySelector('Time');
                    if (timeElem) {
                        const t = new Date(timeElem.textContent);
                        if (!isNaN(t.getTime())) {
                            coord.time = t;
                            if (!firstTime) firstTime = t;
                            lastTime = t;
                        }
                    }

                    const altElem = point.querySelector('AltitudeMeters');
                    if (altElem) coord.ele = parseFloat(altElem.textContent);

                    coordinates.push(coord);

                    if (prevPoint) {
                        calcDist += this.calculateDistance(prevPoint, { lat, lon });
                    }
                    prevPoint = { lat, lon };
                }
            }
        });

        // Fallback: use calculated distance if laps didn't provide it
        if (!metadata.distance && calcDist > 0) metadata.distance = calcDist;

        // Fallback: use first/last time if laps didn't provide duration
        if (!metadata.time && firstTime) metadata.time = firstTime;
        if (!metadata.duration && firstTime && lastTime) {
            metadata.duration = (lastTime - firstTime) / 1000;
        }

        return { coordinates, metadata };
    }

    static async parseFIT(file) {
        if (typeof FitParser === 'undefined') {
            throw new Error('FIT parser not available');
        }

        const arrayBuffer = await file.arrayBuffer();
        const fitParser = new FitParser();
        const { records, sessions } = fitParser.parse(arrayBuffer);

        const coordinates = [];
        const metadata = {
            name: file.name.replace(/\.fit$/i, ''),
            time: null,
            distance: 0,
            duration: null
        };

        if (sessions && sessions.length > 0) {
            const session = sessions[0];
            if (session.start_time) metadata.time = session.start_time;
            if (session.total_distance) metadata.distance = session.total_distance;
            if (session.total_elapsed_time) metadata.duration = session.total_elapsed_time;
        }

        // FIT timestamps are seconds since 1989-12-31 00:00:00 UTC
        const FIT_EPOCH = 631065600000; // ms offset from Unix epoch

        let prevPoint = null;
        records.forEach(record => {
            if (record.position_lat != null && record.position_long != null) {
                const lat = record.position_lat * (180 / Math.pow(2, 31));
                const lon = record.position_long * (180 / Math.pow(2, 31));
                const time = record.timestamp ? new Date(record.timestamp * 1000 + FIT_EPOCH) : null;
                coordinates.push({ lat, lon, time, ele: record.altitude || null });

                if (!metadata.distance && prevPoint) {
                    metadata.distance += this.calculateDistance(prevPoint, { lat, lon });
                }
                prevPoint = { lat, lon };
            }
        });

        return { coordinates, metadata };
    }

    static calculateDistance(point1, point2) {
        const R = 6371000;
        const dLat = this.toRad(point2.lat - point1.lat);
        const dLon = this.toRad(point2.lon - point1.lon);
        const lat1 = this.toRad(point1.lat);
        const lat2 = this.toRad(point2.lat);
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    static toRad(deg) {
        return deg * (Math.PI / 180);
    }
}
