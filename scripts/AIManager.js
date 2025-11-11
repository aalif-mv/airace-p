class AIManager extends AISaver {
  /**
   * @param {object} track - your track object (with boundarySegments)
   * @param {function} createCarFn - function returning a new Car instance
   * @param {number} popSize - number of genomes
   * @param {number} inputCount - number of neural net inputs (rays+speed+angle+offset)
   * @param {number} outputCount - number of outputs (steer, throttle, brake)
   * @param {number} maxTime - max time per generation in ms
   */
  constructor(track, createCarFn, popSize = 50, inputCount = 7, outputCount = 3, maxTime = 20000) {
    // NEAT instance
    const neatInstance = new neataptic.Neat(
      inputCount,
      outputCount,
      null,
      {
        mutation: neataptic.methods.mutation.ALL,
        popsize: popSize,
        mutationRate: 0.4,
        mutationAmount: 2,
        elitism: Math.round(0.1 * popSize)
      }
    );
    super(neatInstance);
    this.track = track;
    this.createCarFn = createCarFn;
    this.populationSize = popSize;
    this.inputCount = inputCount;
    this.outputCount = outputCount;
    this.maxTime = maxTime;

    this.generation = 1;
    this.timeElapsed = 0;

    this.racers = [];
    this.createPopulation();
  }

  createPopulation() {
    this.racers = this.neat.population.map((genome, i) => {
      const car = this.createCarFn(i);
      return new AIRacer(car, genome, this.track);
    });
  }

  update(dt) {
    let allDead = true;
    this.timeElapsed += dt;
    timeCounter.textContent = timeCounter.innerText.split(':')[0] + `: ${this.timeElapsed.toFixed(1)}`;

    for (const racer of this.racers) {
      if (racer.alive) {
        racer.update(dt);
        if (racer.alive) allDead = false;
      }
    }

    // Force evolution if all dead or maxTime exceeded
    if (allDead || this.timeElapsed >= this.maxTime) {
      this.evolve();
      this.timeElapsed = 0;
      this.generation += 1;
      genCounter.textContent = genCounter.innerText.split(':')[0] + `: ${this.generation}`;
    }

    return allDead;
  }

  evolve() {
    // Assign fitness
    for (const racer of this.racers) {
      racer.genome.score = racer.fitness;
    }

    // Sort population by fitness
    this.neat.sort();
    // console.log('best fitness A: ', this.neat.population[0].score)

    const best = this.neat.getFittest();
    console.log('best fitness: ', best.score);
    const json = best.toJSON();
    let sto = parseFloat(localStorage.getItem('bestBrainScore'));
    if (sto == NaN || sto < best.score) {
      localStorage.setItem("bestBrain", JSON.stringify(json));
      localStorage.setItem("bestBrainScore", best.score);
      console.log('Successfully updated the localstorage BEST Brain ....')
    }

    const newPopulation = [];

    // Keep elites
    const eliteCount = Math.round(0.1 * this.neat.population.length);
    for (let i = 0; i < eliteCount; i++) {
      newPopulation.push(this.neat.population[i]);
    }

    // Breed the rest
    while (newPopulation.length < this.neat.population.length) {
      const parent1 = this.neat.getParent();
      const parent2 = this.neat.getParent();
      const child = neataptic.Network.crossOver(parent1, parent2);
      this.neat.mutate(child); // ✅ use neat instance to mutate
      newPopulation.push(child);
    }

    this.neat.population = newPopulation;
    this.createPopulation();
  }


  getBest() {
    return this.neat.population[0];
  }

  draw() {
    for (const racer of this.racers) {
      // if (racer.alive) {
        const alpha = racer.lead ? 1.0 : 0.4;
        racer.car.draw(this.track.ctx, this.track.camera, alpha);
      // }
    }
  }
  // Make camera follow the leading car
  updateCamera(lerpFactor = 0.5) {
      let leader = null;
      let maxDistance = -Infinity;

      for (const racer of this.racers) {
        racer.lead = false;
          if (!racer.alive) continue;
          if (racer.car.prevDistance > maxDistance) {
              maxDistance = racer.car.prevDistance;
              leader = racer;
          }
      }

      if (leader) {
        const offset = 5;
        const cX = leader.car.x + Math.cos(leader.car.angle + Math.PI) * offset;
        const cY = leader.car.y + Math.sin(leader.car.angle + Math.PI) * offset;
        this.track.camera.centerTo(cX, cY, lerpFactor);
        leader.lead = true;

        return leader.car.speed.toFixed(2);
      }
  }
  setLeader() {
    let leader = null;
    let maxDistance = -Infinity;

    for (const racer of this.racers) {
        if (!racer.alive) continue;
        if (racer.car.prevDistance > maxDistance) {
            maxDistance = racer.car.prevDistance;
            leader = racer;
        }
    }
    if (leader) {
      leader.lead = true;
    }
  }
}
