class F1Track {
    constructor(canvas, trackData, scaleFactor = 20, image) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.scaleFactor = scaleFactor;

        this.bg_image_source = image;

        const grassImg = new Image();
        grassImg.src = this.bg_image_source;

        // Scale CSV data
        this.trackData = trackData.map(pt => [
            dp2(pt[0] * this.scaleFactor),
            dp2(pt[1] * this.scaleFactor),
            dp2(pt[2] * this.scaleFactor),
            dp2(pt[3] * this.scaleFactor)
        ]);

        this.camera = new Camera(canvas);

        this.leftWorld = [];
        this.rightWorld = [];

        this.precomputeTrack();

        this.computeBounds();
        this.computeWorldBoundaries();
        this.boundarySegments = this.getBoundarySegments(); // store once
        this.camera.centerOn(this.centerX, this.centerY);

        this.computeCenterlineDistances();
        this.generateCheckpoints(10);
    }

    precomputeTrack() {
        const n = this.trackData.length;
        const pts = new Array(n);
        const dist = new Float64Array(n);
        const segDx = new Float64Array(n - 1);
        const segDy = new Float64Array(n - 1);
        const segLen2 = new Float64Array(n - 1);
        const segAngle = new Float64Array(n - 1);

        pts[0] = [this.trackData[0][0], this.trackData[0][1]];
        dist[0] = 0;

        for (let i = 0; i < n - 1; i++) {
            const [x0, y0] = this.trackData[i];
            const [x1, y1] = this.trackData[i + 1];
            const dx = x1 - x0, dy = y1 - y0;
            segDx[i] = dx;
            segDy[i] = dy;
            segLen2[i] = dx * dx + dy * dy;
            segAngle[i] = Math.atan2(dy, dx);
            pts[i + 1] = [x1, y1];
            dist[i + 1] = dist[i] + Math.hypot(dx, dy);
        }

        this.centerlinePts = pts;
        this.centerlineDist = dist;
        this.segDx = segDx;
        this.segDy = segDy;
        this.segLen2 = segLen2;
        this.segAngle = segAngle;
        this.totalTrackLength = dist[n - 1];
    }


    computeBounds() {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        for (const [x, y, wRight, wLeft] of this.trackData) {
            const leftX = x - wLeft;
            const rightX = x + wRight;
            const leftY = y - wLeft;
            const rightY = y + wRight;

            minX = Math.min(minX, leftX);
            maxX = Math.max(maxX, rightX);
            minY = Math.min(minY, leftY);
            maxY = Math.max(maxY, rightY);
        }

        this.minX = minX; this.maxX = maxX; this.minY = minY; this.maxY = maxY;
        this.centerX = (minX + maxX) / 2;
        this.centerY = (minY + maxY) / 2;

        const margin = 50;
        const scaleX = (this.canvas.width - 2 * margin) / (maxX - minX);
        const scaleY = (this.canvas.height - 2 * margin) / (maxY - minY);
        this.trackScale = Math.min(scaleX, scaleY);
    }

    computeWorldBoundaries() {
        this.leftWorld = [];
        this.rightWorld = [];

        const len = this.trackData.length;
        for (let i = 0; i < len; i++) {
            const [x, y, wRight, wLeft] = this.trackData[i];
            const [nx, ny] = this.trackData[(i + 1) % len];
            const angle = Math.atan2(ny - y, nx - x);

            const lx = x - wLeft * Math.cos(angle + Math.PI / 2);
            const ly = y - wLeft * Math.sin(angle + Math.PI / 2);
            const rx = x + wRight * Math.cos(angle + Math.PI / 2);
            const ry = y + wRight * Math.sin(angle + Math.PI / 2);

            this.leftWorld.push([lx, ly]);
            this.rightWorld.push([rx, ry]);
        }

        this.leftWorld.push(this.leftWorld[0]);
        this.rightWorld.push(this.rightWorld[0]);
    }

    // Subdivided segments for AI ray intersection
    getBoundarySegments(min = 8, max = 15) {
        const segs = [];
        const lw = this.leftWorld;
        const rw = this.rightWorld;

        const interp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

        const minSub = min, maxSub = max;

        for (let i = 0; i < lw.length - 1; i++) {
            const prev = lw[i === 0 ? lw.length - 2 : i - 1];
            const curr = lw[i];
            const next = lw[i + 1];

            let angle1 = Math.atan2(curr[1] - prev[1], curr[0] - prev[0]);
            let angle2 = Math.atan2(next[1] - curr[1], next[0] - curr[0]);
            let deltaAngle = Math.abs(angle2 - angle1);
            if (deltaAngle > Math.PI) deltaAngle = 2 * Math.PI - deltaAngle;

            const subdivisions = Math.round(minSub + (deltaAngle / Math.PI) * (maxSub - minSub));

            for (let s = 0; s < subdivisions; s++) {
                const t1 = s / subdivisions;
                const t2 = (s + 1) / subdivisions;

                segs.push([interp(lw[i], lw[i + 1], t1), interp(lw[i], lw[i + 1], t2)]);
                segs.push([interp(rw[i], rw[i + 1], t1), interp(rw[i], rw[i + 1], t2)]);
            }
        }
        return segs;
    }

    getCanvasBoundaries() {
        const leftPts = this.leftWorld.map(([x, y]) => this.camera.worldToCanvas(x, y));
        const rightPts = this.rightWorld.map(([x, y]) => this.camera.worldToCanvas(x, y));
        return { leftPts, rightPts };
    }

    drawCenterLine(blur = 0) {
        const ctx = this.ctx;
        ctx.save();
        ctx.filter = `blur(${blur / 20}px)`;
        ctx.strokeStyle = 'rgba(255,255,255,0.56)';
        ctx.lineWidth = (18 / this.scaleFactor) * (this.camera.zoom * 10);
        ctx.setLineDash([(this.scaleFactor / 4) * (this.camera.zoom * 10), (this.scaleFactor / 8) * (this.camera.zoom * 10)]);

        const pts = this.trackData.map(pt => this.camera.worldToCanvas(pt[0], pt[1]));
        ctx.beginPath();
        pts.forEach(([cx, cy], i) => (i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy)));
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
        ctx.setLineDash([]);
    }

    drawBackgroundGrid(buffer = 1) {
        const ctx = this.ctx;

        if (!this._grassImg) {
            this._grassImg = new Image();
            this._grassImg.src = this.bg_image_source;
            return;
        }

        const cam = this.camera;
        const zoom = cam.zoom;
        const scale = 1;

        // base tile size in world units
        const worldTileSize = (this._grassImg.width / scale);

        // find top-left visible world coordinate
        const halfW = ctx.canvas.width / (2 * zoom * scale);
        const halfH = ctx.canvas.height / (2 * zoom * scale);
        const startX = cam.x - halfW;
        const startY = cam.y - halfH;

        // number of tiles needed
        const tilesX = Math.ceil(ctx.canvas.width / (worldTileSize * zoom * scale)) + 2 * buffer;
        const tilesY = Math.ceil(ctx.canvas.height / (worldTileSize * zoom * scale)) + 2 * buffer;

        ctx.save();

        for (let i = -buffer; i < tilesX - buffer; i++) {
            for (let j = -buffer; j < tilesY - buffer; j++) {
                const worldX = Math.floor((startX / worldTileSize) + i) * worldTileSize;
                const worldY = Math.floor((startY / worldTileSize) + j) * worldTileSize;
                const [cx, cy] = cam.worldToCanvas(worldX, worldY, scale);

                const drawSize = this._grassImg.width * scale * zoom;
                ctx.drawImage(this._grassImg, cx, cy, drawSize, drawSize);
            }
        }

        ctx.restore();
    }



    drawTrack(blur = 0) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawBackgroundGrid();
        const { leftPts, rightPts } = this.getCanvasBoundaries();

        ctx.beginPath();
        leftPts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        for (let i = rightPts.length - 1; i >= 0; i--) ctx.lineTo(...rightPts[i]);
        ctx.closePath();
        ctx.fillStyle = 'black';
        ctx.fill();

        const dashSize = (this.scaleFactor / 8) * (this.camera.zoom * 10);
        ctx.lineWidth = (10 / this.scaleFactor) * (this.camera.zoom * 10);

        ctx.strokeStyle = 'red';
        ctx.setLineDash([dashSize, dashSize]);
        [leftPts, rightPts].forEach(pts => {
            ctx.beginPath();
            pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
            ctx.closePath();
            ctx.stroke();
        });

        ctx.strokeStyle = 'white';
        ctx.lineDashOffset = dashSize;
        [leftPts, rightPts].forEach(pts => {
            ctx.beginPath();
            pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
            ctx.closePath();
            ctx.stroke();
        });
        ctx.lineDashOffset = 0;

        this.drawCenterLine(blur);
    }

    // ---------------- AI/Car tracking ----------------

    computeCenterlineDistances() {
        this.centerlinePts = this.trackData.map(pt => [pt[0], pt[1]]);
        this.centerlineDist = [0];
        for (let i = 1; i < this.centerlinePts.length; i++) {
            const [x0, y0] = this.centerlinePts[i - 1];
            const [x1, y1] = this.centerlinePts[i];
            const d = Math.hypot(x1 - x0, y1 - y0);
            this.centerlineDist.push(this.centerlineDist[i - 1] + d);
        }
        this.totalTrackLength = this.centerlineDist[this.centerlineDist.length - 1];
    }

    getDistanceAlongTrack(x, y) {
        let minDist = Infinity;
        let closestSeg = 0, tClosest = 0;
        for (let i = 0; i < this.centerlinePts.length - 1; i++) {
            const [x0, y0] = this.centerlinePts[i];
            const [x1, y1] = this.centerlinePts[i + 1];
            const dx = x1 - x0, dy = y1 - y0;
            const len2 = dx * dx + dy * dy;
            let t = ((x - x0) * dx + (y - y0) * dy) / len2;
            t = Math.max(0, Math.min(1, t));
            const projX = x0 + t * dx;
            const projY = y0 + t * dy;
            const dist = Math.hypot(x - projX, y - projY);
            if (dist < minDist) { minDist = dist; closestSeg = i; tClosest = t; }
        }
        const distanceAlongTrack = this.centerlineDist[closestSeg] +
            tClosest * (this.centerlineDist[closestSeg + 1] - this.centerlineDist[closestSeg]);
        return { distance: distanceAlongTrack, lateralOffset: minDist };
    }
    // carAngle in radians, same reference as Math.atan2
    getTrackData(x, y, carAngle, out = {}) {
        const pts = this.centerlinePts;
        const dxs = this.segDx, dys = this.segDy, len2s = this.segLen2;
        let minD2 = Infinity, seg = 0, t = 0, projX = 0, projY = 0;

        for (let i = 0; i < dxs.length; i++) {
            const [x0, y0] = pts[i];
            const dx = dxs[i], dy = dys[i];
            let tt = ((x - x0) * dx + (y - y0) * dy) / len2s[i];
            if (tt < 0) tt = 0; else if (tt > 1) tt = 1;
            const cx = x0 + tt * dx;
            const cy = y0 + tt * dy;
            const d2 = (x - cx) ** 2 + (y - cy) ** 2;
            if (d2 < minD2) { minD2 = d2; seg = i; t = tt; projX = cx; projY = cy; }
        }

        const minDist = Math.sqrt(minD2);
        const [sx0, sy0] = pts[seg];
        const segDx = dxs[seg], segDy = dys[seg];
        const trackAngle = this.segAngle[seg];

        // signed lateral offset
        const cross = (x - sx0) * segDy - (y - sy0) * segDx;
        const lateralOffset = Math.sign(cross) * minDist;

        // distance along centerline
        const distAlong = this.centerlineDist[seg] +
            t * (this.centerlineDist[seg + 1] - this.centerlineDist[seg]);

        // angle difference normalized to (-PI, PI]
        let angleError = carAngle - trackAngle;
        angleError = (angleError + Math.PI) % (2 * Math.PI);
        if (angleError <= 0) angleError += 2 * Math.PI;
        angleError -= Math.PI;

        out.distance = distAlong;
        out.lateralOffset = lateralOffset;
        out.angleError = angleError;
        return out;
    }


    isOnTrack(x, y) {
        const poly = [...this.leftWorld, ...this.rightWorld.slice().reverse()];
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const [xi, yi] = poly[i];
            const [xj, yj] = poly[j];
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 1e-10) + xi)) inside = !inside;
        }
        return inside;
    }

    generateCheckpoints(num = 10) {
        this.checkpoints = [];
        const step = this.totalTrackLength / num;
        for (let i = 0; i < num; i++) {
            const distTarget = i * step;
            const idx = this.centerlineDist.findIndex(d => d >= distTarget);
            this.checkpoints.push({ pos: this.centerlinePts[idx], time: null });
        }
    }

    checkCheckpointCross(car, prevDistance) {
        for (let i = 0; i < this.checkpoints.length; i++) {
            const cpDist = this.centerlineDist[this.centerlinePts.indexOf(this.checkpoints[i].pos)];
            const d = this.getDistanceAlongTrack(car.x, car.y).distance;
            if (prevDistance < cpDist && d >= cpDist && !this.checkpoints[i].time) {
                this.checkpoints[i].time = performance.now();
                return i;
            }
        }
        return -1;
    }

}
