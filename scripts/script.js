const canvas = document.getElementById('gameCanvas');
const fileInput = document.getElementById('csvFile');
const track_list = document.getElementById('track_list');
const brain_list = document.getElementById('brain_list');

const ai_test = document.getElementById('ai_test');
const ai_train = document.getElementById('ai_train');
const player_test = document.getElementById('player_test');

const fpsCounter = document.getElementById('fpsCounter');
const timeCounter = document.getElementById('timeCounter');
const trackLabel = document.getElementById('trackLabel');
const genCounter = document.getElementById('genCounter');
const trainedAI = document.getElementById('trainedAI');

TRACK_DATA.forEach(data => {
    const name = data[0];
    const path = `${TRACK_DATA_SOURCE[1]}${name.replace(/\s+/g, '')}.csv`;

    const list = document.createElement('li');
    list.innerText = name;
    list.addEventListener('click', () => initTrack(path)); // safer
    track_list.append(list);
});
for (const key in BRAINS) {
    if (Object.prototype.hasOwnProperty.call(BRAINS, key)) {
        const list = document.createElement('li');
        list.innerText = key;
        list.setAttribute('name', key);
        list.addEventListener('click', () => setAiModel(key)); // safer
        brain_list.append(list);
    }
}

console.warn('To use the site select a Mode by setting MODE[0] = x, where x can be 1, 2 or 3.')
console.info('1: Ai Training mode')
console.info('2: For Testing the game (Player controls the game)')
console.info('3: For Testing Trained Models')

function changeMode(value) {
    let label = document.getElementById('mode_label');
    label.innerText = 'Mode: ' + value;
    MODE[0] = parseInt(value);
    ai_test.classList.add('hidden');
    ai_train.classList.add('hidden');
    player_test.classList.add('hidden');

    genCounter.classList.add('hidden');
    trainedAI.classList.add('hidden');

    switch (MODE[0]) {
        case 1:
            ai_train.classList.remove('hidden');
            genCounter.classList.remove('hidden');
            break;
        case 3:
            ai_test.classList.remove('hidden');
            trainedAI.classList.remove('hidden');
            break;
        default:
            player_test.classList.remove('hidden');
            break;
    }
}

function setAiModel(k) {
    AIVersion[0] = k;
    trainedAI.textContent = trainedAI.innerText.split(':')[0] + `: ${AIVersion[0]}`;
}

function fullScreen() {
    var elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) { /* Safari */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE11 */
        elem.msRequestFullscreen();
    }
    resizeCanvas();
}
function fullScreenCanvas() {
    var elem = canvas;
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) { /* Safari */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE11 */
        elem.msRequestFullscreen();
    }
}

function initCanvas() {
    canvas.getContext('2d').font = '20px Arial';
    canvas.getContext('2d').fillText('Set a MODE and select a Track to run ...', canvas.width/4, canvas.height/2);
    canvas.getContext('2d').font = '12px cursive';
    canvas.getContext('2d').fillText('--- For more information check the console ---', canvas.width/3, 50+canvas.height/2);
}

function resizeCanvas() {
    // 8:5 rato with:height  x:h
    let browserHeight = window.innerHeight;
    // let browserWidth = window.innerWidth;
    let cW = 0;
    let cH = browserHeight-60;

    cW = (browserHeight*8)/5;
    // cW = browserHeight* (8/5)

    canvas.width = cW;
    canvas.height = cH;
    // documentElement.getElementById('canvasNav').style.width = cW + '!important';
    initCanvas()
}
resizeCanvas()
// -----------------------------------------------------------------------------------


let ai;

const MODE = [2]; // 1 = Ai, 2 = Player, 3 = ai Player
const raysOptions = { count: 5, length: 1000, fov: Math.PI/2 }
const AIVersion = ['version5'];
setAiModel('version5')

let f1track = null;
let car = null;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let cameraStart = { x: 0, y: 0 };
let animationFrame;

const input = { up: false, down: false, left: false, right: false, downDuration: 0 };

let lastTimestamp = 0;

// --- Load CSV ---
async function initTrack(cvsSource) {
    cancelAnimationFrame(animationFrame);
    const scaleFactorGlobal = 20;
    const data = await loadCSV(cvsSource);

    f1track = new F1Track(canvas, data, scaleFactorGlobal, '/images/grass-texture-2x-vintage.png');
    f1track.camera.zoom = 0.8;

    const [firstPt, nextPt] = f1track.trackData;
    const startAngle = Math.atan2(nextPt[1] - firstPt[1], nextPt[0] - firstPt[0]);

    if (MODE[0] == 1) {
        ai = new AIManager(
            f1track,
            () => new Car(firstPt[0], firstPt[1], startAngle, scaleFactorGlobal, raysOptions),
            100,   // population
            8,     // 5 rays + speed + lateral_offset + relative_angle
            4,     // steer (left, right), throttle, brake
            3000   // gen time count
        );
        // ai.loadFromLocal();
        // await ai.loadFromDB();
    } else {
        car = new Car(firstPt[0], firstPt[1], startAngle, scaleFactorGlobal, raysOptions);
    }
    f1track.camera.centerOn(firstPt[0], firstPt[1]);

    lastTimestamp = performance.now();
    animationFrame = requestAnimationFrame(gameLoop);
    console.log('Launch Successful.');
    let trackName = cvsSource.split('/')[cvsSource.split('/').length-1];
    trackLabel.textContent = trackLabel.innerText.split(':')[0] + `: ${trackName}`;
    
}

// initTrack('/TUMFTM-racetrack-database/tracks/IMS.csv');


fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) initTrack(file);
});

// --- Keyboard ---
window.addEventListener('keydown', e => {
    if (!car) return;
    switch (e.key) {
        case 'ArrowUp': case 'w': input.up = true; break;
        case 'ArrowDown': case 's': input.down = true; input.downDuration = 0; break;
        case 'ArrowLeft': case 'a': input.left = true; break;
        case 'ArrowRight': case 'd': input.right = true; break;
    }
});

window.addEventListener('keyup', e => {
    if (!car) return;
    switch (e.key) {
        case 'ArrowUp': case 'w': input.up = false; break;
        case 'ArrowDown': case 's': input.down = false; input.downDuration = 0; break;
        case 'ArrowLeft': case 'a': input.left = false; break;
        case 'ArrowRight': case 'd': input.right = false; break;
    }
});


canvas.addEventListener('mousemove', e => {
    if (isDragging && f1track) {
        const dx = (dragStart.x - e.clientX) / (f1track.trackScale * f1track.camera.zoom);
        const dy = (dragStart.y - e.clientY) / (f1track.trackScale * f1track.camera.zoom);
        f1track.camera.x = cameraStart.x + dx;
        f1track.camera.y = cameraStart.y + dy;
        f1track.drawTrack();
        if (car) car.draw(f1track.ctx, f1track.camera);
    }
});

canvas.addEventListener('mouseup', () => isDragging = false);
canvas.addEventListener('mouseleave', () => isDragging = false);

// --- Mouse Wheel Zoom ---
canvas.addEventListener('wheel', e => {
    if (!f1track) return;
    e.preventDefault();
    const zoomAmount = -e.deltaY * 0.001;
    f1track.camera.zoom *= (1 + zoomAmount);
    f1track.camera.zoom = Math.max(0.1, Math.min(15, f1track.camera.zoom));
});


// --- Game Loop ---
let lastTime = performance.now();
let fps = 0;

function gameLoop(timestamp) {
    if (!f1track) return;

    const now = performance.now();
    const dt = now - lastTime;
    lastTime = now;
    

    // Update FPS
    fps = 1000 / dt;
    delta = dt / 16.67;
    fpsCounter.textContent = fpsCounter.innerText.split(':')[0] + `: ${fps.toFixed(1)}`;

    // --- Update input duration ---
    if (input.down) input.downDuration += dt * (1/60); // seconds

    if (MODE[0] == 1) {
        // Update AI
        const allDead = ai.update(delta);

        // Evolve if all cars are dead
        // if (allDead) {
        //     ai.evolve();
        //     console.log('Generation:', ai.generation);
        // }
        let speed = ai.updateCamera()

        // Draw track
        f1track.drawTrack();

        // --- HUD ---
        f1track.ctx.fillStyle = 'white';
        f1track.ctx.font = '20px Arial';
        f1track.ctx.fillText(`Speed: ${speed}`, 10, 40);

        // Draw AI cars
        ai.draw();
    }

    if (MODE[0] == 2) {
        // --- Update car physics ---
        car.update(input, delta);
        car.updateDistance(f1track);
        // let log = car.getNNInputs(f1track);
        // let log2 = f1track.getTrackData(car.x, car.y, car.angle);
        // console.log(log2.distance, log2.lateralOffset, log2.angleError);
        // console.log(log);

        // --- Ray Casting ---
        car.checkRaysCollision(f1track);
        // --- Camera follows car ---
        const offset = 5;
        const cX = car.x + Math.cos(car.angle + Math.PI) * offset;
        const cY = car.y + Math.sin(car.angle + Math.PI) * offset;
        f1track.camera.centerTo(cX, cY, 0.2);

        // --- Draw track and car ---
        f1track.drawTrack(car.speed);
        car.draw(f1track.ctx, f1track.camera);

        // --- HUD ---
        f1track.ctx.fillStyle = 'white';
        f1track.ctx.font = '20px Arial';
        f1track.ctx.fillText(`Speed: ${car.speed.toFixed(2)}`, 10, 40);
    }

    if (MODE[0] == 3) {
        let saved = JSON.parse(BRAINS[AIVersion[0]])
        const aiCar = new AIRacer(car, neataptic.Network.fromJSON(saved), f1track);

        aiCar.update();

        // --- Camera follows car ---
        const offset = 5;
        const cX = car.x + Math.cos(car.angle + Math.PI) * offset;
        const cY = car.y + Math.sin(car.angle + Math.PI) * offset;
        f1track.camera.centerTo(cX, cY, 0.2);

        f1track.drawTrack(car.speed);
        car.draw(f1track.ctx, f1track.camera);
    }

    animationFrame = requestAnimationFrame(gameLoop)
}
