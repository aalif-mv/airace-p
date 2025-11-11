// Camera.js
class Camera {
    constructor(canvas, x = 0, y = 0, zoom = 1) {
        this.canvas = canvas;
        this.x = x;
        this.y = y;
        this.zoom = zoom;
    }

    worldToCanvas(worldX, worldY, scaleFactor = 1) {
        const scale = scaleFactor * this.zoom;
        const cx = (worldX - this.x) * scale + this.canvas.width / 2;
        const cy = (worldY - this.y) * scale + this.canvas.height / 2;
        return [cx, cy];
    }

    pan(dx, dy) {
        this.x += dx;
        this.y += dy;
    }

    setZoom(zoom) {
        this.zoom = zoom;
    }

    centerOn(x, y) {
        this.x = x;
        this.y = y;
    }
    centerTo(x, y, t = 0.1) {
        this.x += (x - this.x) * t;
        this.y += (y - this.y) * t;
    }
}
