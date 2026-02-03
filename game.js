const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 400; canvas.height = 300;

let score = 0, strikes = 0, combo = 0, state = "WAITING", swingTimer = 0, selectedBat = 'normal';
let timer = 0, hitStopTimer = 0, praiseMsg = "";
let ball = { x: 450, y: 180, num: 0, speed: 1.9, isMagic: false, type: 'normal', offset: 0 };
let fireParticles = [], confetti = [], audioCtx = null, gameStarted = false;

function selectBat(type) {
    if (gameStarted) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    selectedBat = type;
    document.getElementById('selection-overlay').style.display = 'none';
    gameStarted = true; state = "PLAYING"; resetBall();
}

// 휘파람 및 타격음 통합 사운드 함수
function playSound(type) {
    if (!audioCtx || audioCtx.state !== 'running') return;

    if (type === 'magicHit') {
        // 여러 개의 휘파람 소리 생성
        for(let i=0; i<3; i++) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.type = 'sine';
            const freq = 800 + (i * 400); // 다양한 높낮이
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime + (i * 0.05));
            osc.frequency.exponentialRampToValueAtTime(freq * 1.5, audioCtx.currentTime + 0.1 + (i * 0.1));
            osc.frequency.exponentialRampToValueAtTime(freq * 0.8, audioCtx.currentTime + 0.3 + (i * 0.1));
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            osc.start(); osc.stop(audioCtx.currentTime + 0.6);
        }
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);

    if (type === 'homerun' || type === 'magicHit') {
        if (selectedBat === 'chicken') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(900, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1800, audioCtx.currentTime + 0.1);
        } else {
            osc.type = 'triangle'; osc.frequency.setValueAtTime(600, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.15);
        }
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    } else {
        osc.type = 'sine'; osc.frequency.setValueAtTime(120, audioCtx.currentTime);
        gain.gain.setTargetAtTime(0, audioCtx.currentTime + 0.05, 0.03);
    }
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}

// 콘페티 생성 함수
function createConfetti() {
    for (let i = 0; i < 40; i++) {
        confetti.push({
            x: 80, y: 180,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.8) * 12,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            size: Math.random() * 6 + 4,
            life: 1.0
        });
    }
}

function drawField() {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 150);
    skyGrad.addColorStop(0, "#2980b9"); skyGrad.addColorStop(1, "#6dd5fa");
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, 400, 300);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath(); ctx.arc(300, 50, 20, 0, Math.PI*2); ctx.arc(320, 50, 25, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#8d3030"; ctx.fillRect(0, 30, 90, 120); 
    ctx.fillStyle = "#5d2020"; ctx.fillRect(10, 45, 15, 15); ctx.fillRect(40, 45, 15, 15); ctx.fillRect(10, 75, 15, 15); ctx.fillRect(40, 75, 15, 15);
    ctx.fillStyle = "#a54040"; ctx.fillRect(320, 20, 80, 130);
    ctx.fillStyle = "#333333"; ctx.fillRect(0, 150, 400, 150);
    ctx.fillStyle = "#f1c40f"; ctx.fillRect(180, 150, 5, 150);
    ctx.fillStyle = "#1a5276"; ctx.fillRect(230, 135, 75, 25);
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(245, 160, 7, 0, Math.PI*2); ctx.arc(290, 160, 7, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 3; ctx.strokeRect(65, 210, 40, 40);
}

function drawPlayer(x, y) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "#34495e"; ctx.fillRect(-12, 0, 8, 24); ctx.fillRect(2, 0, 8, 24);
    ctx.fillStyle = "#f1c40f"; ctx.fillRect(-15, -30, 30, 30);
    ctx.fillStyle = "#ffdbac"; ctx.fillRect(-8, -46, 16, 16);
    ctx.fillStyle = "#2980b9"; ctx.fillRect(-10, -52, 20, 8); ctx.fillRect(0, -52, 18, 3);
    ctx.save(); ctx.translate(0, -15);
    if (swingTimer > 0) {
        const progress = (15 - swingTimer) / 15;
        ctx.rotate(-Math.PI / 1.5 + (progress * Math.PI * 1.2));
    } else { ctx.rotate(-Math.PI / 1.5); }
    if (selectedBat === 'normal') { ctx.fillStyle = "#d35400"; ctx.fillRect(-3, -45, 6, 45); }
    else if (selectedBat === 'chicken') { ctx.fillStyle = "#f1c40f"; ctx.fillRect(-4, -35, 8, 30); ctx.fillStyle = "#e74c3c"; ctx.fillRect(-6, -42, 12, 8); }
    else { ctx.fillStyle = "#795548"; ctx.fillRect(-2, -40, 4, 40); ctx.fillStyle = "#00bcd4"; ctx.fillRect(-15, -45, 30, 6); }
    ctx.restore(); ctx.restore();
}

function update() {
    if (!gameStarted) return;
    if (hitStopTimer > 0) {
        hitStopTimer--;
    } else {
        if (swingTimer > 0) swingTimer--;
        if (state === "PLAYING") {
            ball.x -= ball.speed;
            ball.offset = ball.isMagic ? Math.sin(ball.x * 0.05) * 30 : 0;
            if (ball.x < 80) startMiss();
        } else if (state === "HOMERUN") {
            ball.x += 15; ball.y -= 12;
            timer--; if (timer <= 0) resetBall();
        }
    }
    // 입자 업데이트
    fireParticles.forEach((p, i) => { p.y += p.vy; p.life -= 0.03; if(p.life <= 0) fireParticles.splice(i, 1); });
    confetti.forEach((c, i) => { 
        c.x += c.vx; c.y += c.vy; c.vy += 0.4; c.life -= 0.015;
        if(c.life <= 0) confetti.splice(i, 1); 
    });
}

function draw() {
    ctx.clearRect(0, 0, 400, 300);
    drawField();
    fireParticles.forEach(p => {
        ctx.fillStyle = `rgba(255, ${Math.floor(200 * p.life)}, 0, ${p.life})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
    });
    confetti.forEach(c => {
        ctx.fillStyle = c.color; ctx.globalAlpha = c.life;
        ctx.fillRect(c.x, c.y, c.size, c.size); ctx.globalAlpha = 1.0;
    });
    drawPlayer(80, 230);
    if (gameStarted && (state === "PLAYING" || state === "HOMERUN")) {
        ctx.save(); ctx.translate(0, ball.offset);
        let color = ball.type === 'giant' ? "#e67e22" : (ball.type === 'sparkle' ? `hsl(${Date.now()%360},100%,70%)` : (ball.isMagic ? "#9b59b6" : "white"));
        ctx.fillStyle = color;
        if (ball.isMagic) { ctx.shadowBlur = 15; ctx.shadowColor = color; }
        ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.type==='giant'?32:16, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = (ball.isMagic||ball.type==='giant')?"#fff":"#000";
        ctx.font = "bold 20px Arial"; ctx.textAlign="center"; ctx.fillText(ball.num, ball.x, ball.y+7); ctx.restore();
    }
    if (hitStopTimer > 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)"; ctx.fillRect(0, 0, 400, 300);
        ctx.fillStyle = "#f1c40f"; ctx.font = "bold 50px Arial"; ctx.textAlign = "center";
        ctx.shadowColor = "black"; ctx.shadowBlur = 10;
        ctx.fillText(praiseMsg, 200, 150); ctx.shadowBlur = 0;
    }
}

function handleInput(n) {
    if (state !== "PLAYING" || hitStopTimer > 0) return;
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    swingTimer = 15;
    if (ball.num + n === 10) {
        if (ball.isMagic) {
            score += 30; // 마구 보너스
            praiseMsg = "NICE!";
            hitStopTimer = 40;
            createConfetti();
            playSound('magicHit');
        } else {
            score += 10;
            playSound('homerun');
        }
        combo++; updateUI();
        state = "HOMERUN"; timer = 50;
    } else startMiss();
}

function startMiss() { strikes++; combo = 0; if (strikes >= 3) { alert("Game Over!"); location.reload(); } resetBall(); updateUI(); playSound('miss'); }
function resetBall() { 
    ball.x = 400; ball.y = 180;
    ball.num = Math.floor(Math.random()*9)+1;
    let r = Math.random();
    ball.isMagic = r < 0.3;
    ball.type = ball.isMagic ? (r < 0.1 ? 'giant' : (r < 0.2 ? 'sparkle' : 'normal')) : 'normal';
    ball.speed *= 1.05; state = "PLAYING";
}
function updateUI() { document.getElementById("scoreText").innerText = score; document.getElementById("strikeText").innerText = "X ".repeat(strikes) || "READY"; document.getElementById("levelText").innerText = ball.speed.toFixed(1); }
function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();