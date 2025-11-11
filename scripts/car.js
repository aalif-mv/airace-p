class Car {
    constructor(x, y, angle = 0, scaleFactor = 20, rayOptions, imgSrc = './images/car.png') {
        this.x = x;
        this.y = y;
        this.angle = angle;

        // Physics
        this.speed = 0.1;
        this.acceleration = 0.05;
        this.maxSpeed = 5;
        this.maxTopSpeed = 20;
        this.accelerationIncrement = 0.5;
        this.friction = 0.2;
        this.brakeForce = 1;
        this.turnSpeed = 0.03;
        this.minTurnFactor = 0.12;
        this.angularVelocity = 0;

        // Dimensions
        this.width = 2 * scaleFactor;
        this.length = 4 * scaleFactor;

        // Input
        this.accelHoldTime = 0;

        // Image
        this.img = new Image();
        this.img.src = imgSrc;

        // Rays
        this.rayCount = rayOptions.count || 5;
        this.rayLength = rayOptions.length || 200;
        this.rayFOV = rayOptions.fov || Math.PI / 2;
        this.rays = [];
        this.collisions = [];

        // AI tracking
        this.prevDistance = 0;
        this.checkpointTimes = [];

        this.prevDistance;
        this.lateralOffset;
        this.angleError
        this.alive = true;
    }

    update(input, dt = 1) {
        // --- Acceleration & braking ---
        if (input.up) {
            this.accelHoldTime += dt;
            const currentMaxSpeed = Math.min(this.maxSpeed + this.accelHoldTime * this.accelerationIncrement, this.maxTopSpeed);
            const speedFactor = (currentMaxSpeed - this.speed) / currentMaxSpeed;
            this.speed += this.acceleration * speedFactor * dt;
            this.speed = Math.min(this.speed, currentMaxSpeed);
        } else this.accelHoldTime = Math.max(this.accelHoldTime - dt * 0.5, 0);

        if (input.down && this.speed > 0) {
            const brakeIntensity = input.downDuration > 0.2 ? 1.5 : 0.5;
            this.speed -= this.brakeForce * brakeIntensity * dt;
            if (this.speed < 0) this.speed = 0;
        }

        // --- Friction ---
        if (!input.up && !input.down && this.speed > 0) {
            const drag = 0.002;
            const rolling = 0.01;
            const frictionForce = rolling + drag * this.speed ** 2;
            this.speed -= frictionForce * dt;
            if (this.speed < 0) this.speed = 0;
        }

        this.speed = Math.max(-this.maxTopSpeed / 2, Math.min(this.speed, this.maxTopSpeed));

        // --- Turning ---
        if (Math.abs(this.speed) > 0.01) {
            const turnDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
            if (turnDir !== 0) {
                const lowSpeed = 0.5, normalSpeed = this.maxTopSpeed * 0.5, highSpeed = this.maxTopSpeed;
                let speedFactor;
                if (this.speed < normalSpeed) {
                    speedFactor = this.minTurnFactor + ((this.speed - lowSpeed)/(normalSpeed - lowSpeed))*(1 - this.minTurnFactor);
                    speedFactor = Math.max(this.minTurnFactor, Math.min(speedFactor, 1));
                } else {
                    speedFactor = 1 - ((this.speed - normalSpeed)/(highSpeed - normalSpeed))*0.7;
                    speedFactor = Math.max(0.3, speedFactor);
                }
                const turnAmount = this.turnSpeed * speedFactor;
                const targetAngularVel = turnDir * turnAmount;
                this.angularVelocity += (targetAngularVel - this.angularVelocity) * 0.2;
                this.angle += this.angularVelocity * dt;
            } else this.angularVelocity *= 0.8;
        } else this.angularVelocity = 0;

        // --- Move car ---
        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;

        // --- Compute rays ---
        this.computeRays();
    }
    

    computeRays() {
        this.rays = [];
        const halfFOV = this.rayFOV / 2;
        for (let i = 0; i < this.rayCount; i++) {
            const alpha = this.rayCount === 1 ? 0 : -halfFOV + (i / (this.rayCount - 1)) * this.rayFOV;
            const rayAngle = this.angle + alpha;
            const start = [this.x, this.y];
            const end = [
                this.x + Math.cos(rayAngle) * this.rayLength,
                this.y + Math.sin(rayAngle) * this.rayLength
            ];
            this.rays.push({ start, end });
        }
    }

    // --- Stable intersection ---
    getIntersection(A, B, C, D) {
        const Ax = +A[0], Ay = +A[1], Bx = +B[0], By = +B[1];
        const Cx = +C[0], Cy = +C[1], Dx = +D[0], Dy = +D[1];

        const denom = (Dy - Cy)*(Bx - Ax) - (Dx - Cx)*(By - Ay);
        if (Math.abs(denom) < 1e-10) return null; // parallel

        const t = ((Dx - Cx)*(Ay - Cy) - (Dy - Cy)*(Ax - Cx)) / denom;
        const u = ((Cx - Ax)*(Ay - By) - (Cy - Ay)*(Ax - Bx)) / denom;

        if (t >= -0.001 && t <= 1.001 && u >= -0.001 && u <= 1.001) {
            return {
                point: [Ax + t*(Bx - Ax), Ay + t*(By - Ay)],
                offset: t * Math.hypot(Bx - Ax, By - Ay)
            };
        }
        return null;
    }

    checkRaysCollision(track) {
        if (!track) return;
        const segments = track.boundarySegments;
        const newCollisions = [];

        for (let ray of this.rays) {
            let closest = null;
            let minOffset = this.rayLength;

            for (let seg of segments) {
                const hit = this.getIntersection(ray.start, ray.end, seg[0], seg[1]);
                if (hit && hit.offset < minOffset) {
                    minOffset = hit.offset;
                    closest = hit.point;
                }
            }
            newCollisions.push(closest ? { point: closest, dist: minOffset } : null);
        }

        // Smooth transitions to avoid flicker
        if (!this.collisions || this.collisions.length !== newCollisions.length) {
            this.collisions = newCollisions;
        } else {
            for (let i = 0; i < newCollisions.length; i++) {
                if (!newCollisions[i] && this.collisions[i]) {
                    this.collisions[i].framesLeft = (this.collisions[i].framesLeft || 3) - 1;
                    if (this.collisions[i].framesLeft <= 0) this.collisions[i] = null;
                } else {
                    this.collisions[i] = newCollisions[i];
                }
            }
        }
    }

    drawRays(ctx, camera) {
        for (let i = 0; i < this.rays.length; i++) {
            const ray = this.rays[i];
            const start = camera.worldToCanvas(...ray.start);
            const hit = this.collisions?.[i];
            const end = hit ? camera.worldToCanvas(...hit.point) : camera.worldToCanvas(...ray.end);

            // Color: red=close, green=far
            let color = "lime";
            if (hit) {
                const t = hit.dist / this.rayLength;
                const r = Math.floor(255*(1 - t));
                const g = Math.floor(255*t);
                color = `rgb(${r},${g},0)`;
            }

            ctx.beginPath();
            ctx.moveTo(...start);
            ctx.lineTo(...end);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.stroke();

            // ctx.fillStyle = 'blue';
            // ctx.font = '20px Arial';
            // ctx.fillText(`Ray1: ${this.collisions[0]}`, 10, 70);
            // ctx.fillText(`Ray2: ${this.collisions[1]}`, 10, 90);
            // ctx.fillText(`Ray3: ${this.collisions[2]}`, 10, 110);
            // ctx.fillText(`Ray4: ${this.collisions[3]}`, 10, 130);
            // ctx.fillText(`Ray5: ${this.collisions[4]}`, 10, 150);
        }
    }

    draw(ctx, camera, alpha) {
        const [cx, cy] = camera.worldToCanvas(this.x, this.y);
        const carWidthPx = this.width * camera.zoom;
        const carLengthPx = this.length * camera.zoom;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.angle);

        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;

        if (this.img.complete) {
            ctx.globalAlpha = alpha;
            ctx.drawImage(this.img, -carLengthPx/2, -carWidthPx/2, carLengthPx, carWidthPx);
            ctx.globalAlpha = 1.0;
        } else {
            ctx.fillStyle = 'red';
            ctx.fillRect(-carLengthPx/2, -carWidthPx/2, carLengthPx, carWidthPx);
        }

        ctx.restore();

        // Draw Rays
        this.drawRays(ctx, camera);
    }
    updateDistance(track) {
        // const pos = track.getDistanceAlongTrack(this.x, this.y);
        // this.prevDistance = pos.distance;
        // this.lateralOffset = pos.lateralOffset;
        // this.onTrack = track.isOnTrack(this.x, this.y);

        const data = track.getTrackData(this.x, this.y, this.angle);

        this.prevDistance = data.distance;
        this.lateralOffset = data.lateralOffset;
        this.angleError = data.angleError;
    }
    getNNInputs(track) {
        // Ray distances (0-1)
        const rays = this.rays.map((ray, i) => {
            const hit = this.collisions[i];
            return hit ? hit.dist / this.rayLength : 1;
        });

        // Normalized speed
        const speedNorm = this.speed / this.maxSpeed;

        // Lateral offset normalized (relative to track width, assume max ~track width)
        const lateralNorm = (this.lateralOffset || 0) / (track.scaleFactor * 15); // adjust denominator if needed

        return [...rays, speedNorm, lateralNorm, this.angleError];
    }


    // applyNNoutputs(outputs) {
    //     const [steer, throttle, brake] = outputs;
    //     out = {
    //         left: steer < -0.3,
    //         right: steer > 0.3,
    //         up: throttle > 0.5,
    //         down: brake > 0.5
    //     }
    // }

    isInsideTrack(track) {
        if (!track || !track.leftWorld || !track.rightWorld) return false;

        // Combine left and right edges into a closed polygon
        const polygon = [...track.leftWorld, ...track.rightWorld.slice().reverse()];

        return this.pointInPolygon(this.x, this.y, polygon);
    }

    pointInPolygon(x, y, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i][0], yi = polygon[i][1];
            const xj = polygon[j][0], yj = polygon[j][1];
            const intersect = ((yi > y) !== (yj > y)) &&
                (x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }
}
