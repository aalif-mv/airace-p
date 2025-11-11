// AIRacer.js
class AIRacer {
  constructor(car, genome, track) {
    this.car = car;
    this.genome = genome;
    this.fitness = 0;
    this.alive = true;
    this.track = track;
    // this.fitness = 0;
    this.logData = [['ray', 'ray', 'ray', 'ray', 'ray', 'speedNorm', 'lateralNorm', 'angle', 'left', 'right', 'throttle', 'brake']];
    this.lead = false;
    this.logTimer = performance.now();
    this.logDelay = 1000; // 1s
  }

  update(dt) {
    if (!this.alive) {
      return;
    }
    if (!this.car.isInsideTrack(this.track)) {
      this.alive = false;
      this.car.alive = false;
      return;
    }

    // Update rays and distance
    this.car.checkRaysCollision(this.track);
    this.car.updateDistance(this.track);

    // Get normalized inputs
    const inputs = this.car.getNNInputs(this.track);

    // Feed forward through neural net
    const outputs = this.genome.activate(inputs);

    const [left, right, throttle, brake] = outputs;
    let out = {
        left:   left > 0.5,
        right: right > 0.5,
        up: throttle > 0.5,
        down:  brake < 0.5
    }
    // console.log(out)

    if (this.lead) {
      const now = performance.now();
      const dt = now - this.logTimer;
      if (dt > this.logDelay) {
        this.logTimer = now;
        // this.log(now, [inputs, [this.car.angle], [steer, throttle, brake]])
      }
    }
    

    // Apply outputs to car controls
    // this.car.applyNNoutputs(outputs);

    // Update physics and apply outputs to car
    this.car.update(out, dt);

    // Assign fitness (distance along track)
    this.fitness = (this.car.prevDistance);
  }

  log(t, d = []) {
    const data = [].concat(...d);
    this.logData.push(data);
  }

  reset(car) {
    this.car = car;
    this.alive = true;
  }
}
