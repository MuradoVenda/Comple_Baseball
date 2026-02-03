const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 400;
canvas.height = 300;

// --- [Game State] ---
let score = 0, strikes = 0, combo = 0; 
let state = "PLAYING", timer = 0, swingTimer = 0, comboTextTimer = 0;
let hitStopTimer = 0, praiseMsg = ""; 
let initialSpeed = 0.96; 
let ball = { x: 400, y: 180, num: 0, speed: initialSpeed, isMagic: false, type: 'normal', offset: 0 }; 
let particles = [], fireParticles = [];

// --- [Sound System] ---
let audioCtx;
let fireSoundNode = null; 

function playWhistle() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    for(let i=0; i<3; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        const startFreq = 1100 + Math.random() * 400;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(startFreq, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(startFreq + 400, audioCtx.currentTime + 0.4);
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start(); osc.stop(audioCtx.currentTime + 0.5);
    }
}

function updateFireSound() {
    if (!audioCtx) return;
    if (combo < 5) {
        if (fireSoundNode) fireSoundNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.2);
        return;
    }
    if (!fireSoundNode) {
        const noiseBuffer = audioCtx.createBuffer(1, 2 * audioCtx.sampleRate, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < output.length; i++) output[i] = Math.random() * 2 - 1;
        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer; noiseSource.loop = true;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 400;
        fireSoundNode = audioCtx.createGain(); fireSoundNode.gain.value = 0;
        noiseSource.connect(filter); filter.connect(fireSoundNode); fireSoundNode.connect(audioCtx.destination);
        noiseSource.start();
    }
    let targetVol = combo >= 15 ? 0.15 : (combo >= 5 ? 0.06 : 0);
    fireSoundNode.gain.setTargetAtTime(targetVol, audioCtx.currentTime, 0.3);
}

function playSound(type) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    if (type === 'homerun') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(523, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046, audioCtx.currentTime + 0.2);
    } else if (type === 'miss') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.4);
    }
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    osc.start(); osc.stop(audioCtx.currentTime + 0.4);
}

// --- [Graphics: Brick City & Real Road] ---
function drawField() {
    // 1. Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 150);
    skyGrad.addColorStop(0, "#2980b9"); skyGrad.addColorStop(1, "#6dd5fa");
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 2. Realistic Brick Buildings
    ctx.fillStyle = "#8d3030"; ctx.fillRect(0, 30, 90, 120); 
    ctx.fillStyle = "#a54040"; ctx.fillRect(320, 20, 80, 130);
    // Windows & Details
    ctx.fillStyle = "#2c3e50";
    for(let i=0; i<3; i++) {
        ctx.fillRect(20, 50 + i*30, 20, 15); ctx.fillRect(350, 40 + i*35, 20, 20);
    }

    // 3. Concrete Street
    ctx.fillStyle = "#333333"; ctx.fillRect(0, 150, 400, 150);
    ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 2;
    for(let i=0; i<10; i++) { ctx.beginPath(); ctx.moveTo(0, 160 + i*15); ctx.lineTo(400, 160 + i*15); ctx.stroke(); }

    // 4. Vintage Blue Car
    ctx.fillStyle = "#1a5276"; ctx.fillRect(230, 135, 75, 25); // Body
    ctx.fillStyle = "#2e86c1"; ctx.fillRect(245, 120, 45, 18); // Top
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(245, 160, 9, 0, Math.PI*2); ctx.arc(290, 160, 9, 0, Math.PI*2); ctx.fill();

    // 5. Chalk Home Plate
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 3;
    ctx.strokeRect(65, 210, 40, 40);
}

function drawPlayer(x, y) {
    ctx.save(); ctx.translate(x, y);
    
    // Detailed Player with Two Legs
    ctx.fillStyle = "#34495e"; // Jeans
    ctx.fillRect(-12, 0, 8, 24); // Left Leg
    ctx.fillRect(2, 0, 8, 24);  // Right Leg
    ctx.fillStyle = "#000"; ctx.fillRect(-13, 20, 10, 5); ctx.fillRect(1, 20, 10, 5); // Shoes

    ctx.fillStyle = "#f1c40f"; // Yellow Shirt
    ctx.fillRect(-15, -30, 30, 30); 
    
    ctx.fillStyle = "#ffdbac"; // Skin
    ctx.fillRect(-8, -46, 16, 16); // Head
    
    // Red Baseball Cap
    ctx.fillStyle = "#c0392b"; ctx.fillRect(-10, -50, 20, 7); // Cap body
    ctx.fillRect(2, -50, 14, 2); // Cap brim

    // --- [Realistic Swing Animation] ---
    ctx.save();
    ctx.translate(0, -15); // Shoulder pivot
    if (swingTimer > 0) {
        // Swing from Low-Left to High-Right (Upercut)
        const progress = (15 - swingTimer) / 15;
        const swingAngle = -Math.PI / 1.5 + (progress * Math.PI * 1.2);
        ctx.rotate(swingAngle);
    } else if (state === "MISS") {
        ctx.rotate(Math.PI / 4 + timer * 0.2); // Fall back on miss
    } else {
        // Ready Stance (Bat held high and back)
        ctx.rotate(-Math.PI / 1.5 + Math.sin(Date.now() / 200) * 0.05); 
    }
    
    ctx.fillStyle = "#8e44ad"; // Hands/Glove
    ctx.fillRect(-4, -5, 8, 8);
    ctx.fillStyle = "#d35400"; // Bat
    ctx.fillRect(-3, -45, 6, 45); 
    ctx.restore();
    
    ctx.restore();
}

function createFire(x, y, intensity, isMega = false) {
    for(let i=0; i < intensity; i++) {
        fireParticles.push({
            x: x + (Math.random() - 0.5) * (isMega ? 35 : 10),
            y: y + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * (isMega ? 4 : 2),
            vy: -Math.random() * (isMega ? 7 : 4) - 2,
            life: 1.0, size: Math.random() * (isMega ? 20 : 10) + 6
        });
    }
}

function update() {
    if (hitStopTimer > 0) { hitStopTimer--; return; } 
    if (swingTimer > 0) swingTimer--;
    if (comboTextTimer > 0) comboTextTimer--; 
    
    if (combo >= 15) createFire(80, 200, 4, true);
    else if (combo >= 10) createFire(80, 180, 2, false);
    else if (combo >= 5) createFire(95, 190, 1, false);

    for (let i = fireParticles.length - 1; i >= 0; i--) {
        let p = fireParticles[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.025; 
        if (p.life <= 0) fireParticles.splice(i, 1);
    }

    if (state === "PLAYING") {
        ball.x -= ball.speed;
        ball.offset = ball.isMagic ? Math.sin(ball.x * 0.05) * 30 : 0;
        if (ball.x < 80) startMiss();
    } else if (state === "HOMERUN") {
        ball.x += 15; ball.y -= 12;
        particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.4; });
        timer--;
        if (timer <= 0) { particles = []; resetBall(); }
    } else if (state === "MISS") {
        timer--; if (timer <= 0) resetBall();
    }
}

function draw() {
    drawField(); 
    
    fireParticles.forEach(p => {
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(255, ${Math.floor(200 * p.life)}, 0, ${p.life})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    });

    drawPlayer(80, 230);

    if (state !== "MISS" && state !== "GAMEOVER") {
        ctx.save(); ctx.translate(0, ball.offset); 
        let radius = ball.type === 'giant' ? 32 : 16;
        let ballColor = ball.type === 'giant' ? "#e67e22" : (ball.type === 'sparkle' ? `hsl(${Date.now() % 360}, 100%, 75%)` : (ball.isMagic ? "#9b59b6" : "white"));
        ctx.fillStyle = ballColor;
        if (ball.isMagic) { ctx.shadowBlur = 20; ctx.shadowColor = ballColor; }
        ctx.beginPath(); ctx.arc(ball.x, ball.y, radius, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = (ball.type === 'giant' || ball.isMagic) ? "white" : "black"; 
        ctx.font = `bold ${ball.type === 'giant' ? 30 : 20}px Arial`; ctx.textAlign = "center";
        ctx.fillText(ball.num, ball.x, ball.y + (ball.type === 'giant' ? 10 : 7));
        ctx.restore();
    }

    if (hitStopTimer > 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)"; ctx.fillRect(0,0,400,300);
        ctx.fillStyle = "#e74c3c"; ctx.font = "bold 50px Arial"; ctx.textAlign = "center";
        ctx.fillText(praiseMsg, 200, 150);
    }
    if (comboTextTimer > 0 && combo > 0) {
        ctx.fillStyle = "#f1c40f"; ctx.font = "italic bold 26px Arial"; ctx.textAlign = "right";
        ctx.fillText(`${combo} COMBO!`, 380, 60);
    }
    if (state === "GAMEOVER") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)"; ctx.fillRect(0, 0, 400, 300);
        ctx.fillStyle = "#3498db"; ctx.font = "bold 40px Arial"; ctx.textAlign = "center";
        ctx.fillText("GOOD GAME!", 200, 140);
        ctx.fillStyle = "white"; ctx.font = "18px Arial"; ctx.fillText("Tap to Restart", 200, 180);
    }
}

function handleInput(n) {
    if (state !== "PLAYING" || hitStopTimer > 0) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    swingTimer = 15; 
    if (ball.num + n === 10) startHomerun(); else startMiss();
}

function startHomerun() {
    state = "HOMERUN"; timer = 60; score += 10; combo++; comboTextTimer = 40;
    if (ball.speed < 8) ball.speed *= 1.05;
    if (ball.isMagic) { hitStopTimer = 30; praiseMsg = "AMAZING!"; playWhistle(); }
    updateUI(); playSound('homerun'); updateFireSound();
    for(let i=0; i<40; i++) particles.push({x: 100, y: 180, vx: Math.random()*15-5, vy: -Math.random()*15, c: `hsl(${Math.random()*360},100%,50%)`});
}

function startMiss() { strikes++; combo = 0; updateUI(); updateFireSound(); if (strikes >= 3) state = "GAMEOVER"; else { state = "MISS"; timer = 40; playSound('miss'); }}
function updateUI() { document.getElementById("scoreText").innerText = `SCORE: ${score} | STRIKES: ${strikes}`; document.getElementById("levelText").innerText = `SPEED: ${ball.speed.toFixed(1)}`; }
function resetBall() { ball.x = 400; ball.y = 180 + Math.random()*40; ball.num = Math.floor(Math.random() * 10) + 1; let rand = Math.random(); ball.isMagic = rand < 0.3; ball.type = ball.isMagic ? (rand < 0.1 ? 'giant' : (rand < 0.2 ? 'sparkle' : 'normal')) : 'normal'; ball.offset = 0; state = "PLAYING"; }
function resetGame() { score = 0; strikes = 0; combo = 0; ball.speed = initialSpeed; fireParticles = []; updateUI(); resetBall(); updateFireSound(); }
canvas.addEventListener("click", () => { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (state === "GAMEOVER") resetGame(); });
function loop() { update(); draw(); requestAnimationFrame(loop); }
updateUI(); resetBall(); loop();