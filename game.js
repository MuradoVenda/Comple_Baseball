const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 400; canvas.height = 300;

let score = 0, strikes = 0, combo = 0, state = "WAITING", swingTimer = 0, selectedBat = 'normal';
let timer = 0, hitStopTimer = 0, praiseMsg = "", initialSpeed = 1.15;
let ball = { x: 450, y: 180, num: 0, speed: initialSpeed, isMagic: false, type: 'normal', offset: 0 };
let particles = [], fireParticles = [], audioCtx = null;

// 아이패드/iOS 호환용 배트 선택 및 게임 시작
function selectBat(type) {
    // 1. 사운드 엔진 활성화 (사용자 터치 시점에 수행)
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    // 2. 상태 변경
    selectedBat = type;
    document.getElementById('selection-overlay').style.display = 'none';
    
    // 3. 게임 엔진 강제 가동
    state = "PLAYING";
    resetBall();
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    
    if (type === 'homerun') {
        if (selectedBat === 'chicken') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(450, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        } else {
            osc.type = 'triangle'; 
            osc.frequency.setValueAtTime(523, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        }
    } else if (type === 'miss') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    }
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}

function createFire(x, y, intensity, isMega = false) {
    for(let i=0; i < intensity; i++) {
        fireParticles.push({
            x: x + (Math.random() - 0.5) * (isMega ? 35 : 10),
            y: y + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 5 - 2,
            life: 1.0, size: Math.random() * (isMega ? 20 : 10) + 6
        });
    }
}

function drawField() {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 150);
    skyGrad.addColorStop(0, "#2980b9"); skyGrad.addColorStop(1, "#6dd5fa");
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, 400, 300);
    ctx.fillStyle = "#8d3030"; ctx.fillRect(0, 30, 90, 120); 
    ctx.fillStyle = "#a54040"; ctx.fillRect(320, 20, 80, 130);
    ctx.fillStyle = "#333333"; ctx.fillRect(0, 150, 400, 150);
    ctx.fillStyle = "#1a5276"; ctx.fillRect(230, 135, 75, 25);
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 3; ctx.strokeRect(65, 210, 40, 40);
}

function drawPlayer(x, y) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "#34495e"; ctx.fillRect(-12, 0, 8, 24); ctx.fillRect(2, 0, 8, 24);
    ctx.fillStyle = "#f1c40f"; ctx.fillRect(-15, -30, 30, 30);
    ctx.fillStyle = "#ffdbac"; ctx.fillRect(-8, -46, 16, 16);
    
    // 모자 복구
    ctx.fillStyle = "#2980b9";
    ctx.fillRect(-10, -52, 20, 8);
    ctx.fillRect(0, -52, 18, 3);

    ctx.save(); ctx.translate(0, -15);
    if (swingTimer > 0) {
        const progress = (15 - swingTimer) / 15;
        ctx.rotate(-Math.PI / 1.5 + (progress * Math.PI * 1.2));
    } else { ctx.rotate(-Math.PI / 1.5); }
    
    if (selectedBat === 'normal') { ctx.fillStyle = "#d35400"; ctx.fillRect(-3, -45, 6, 45); }
    else if (selectedBat === 'chicken') { 
        ctx.fillStyle = "#f1c40f"; ctx.fillRect(-4, -35, 8, 30);
        ctx.fillStyle = "#e74c3c"; ctx.fillRect(-6, -42, 12, 8);
    } else { ctx.fillStyle = "#795548"; ctx.fillRect(-2, -40, 4, 40); ctx.fillStyle = "#00bcd4"; ctx.fillRect(-15, -45, 30, 6); }
    ctx.restore(); ctx.restore();
}

function update() {
    if (state === "WAITING") return; // 선택 전에는 정지
    if (hitStopTimer > 0) { hitStopTimer--; return; }
    if (swingTimer > 0) swingTimer--;
    
    if (combo >= 15) createFire(80, 210, 3, true);
    else if (combo >= 5) createFire(80, 210, 1, false);
    
    fireParticles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.025;
        if(p.life <= 0) fireParticles.splice(i, 1);
    });

    if (state === "PLAYING") {
        ball.x -= ball.speed;
        ball.offset = ball.isMagic ? Math.sin(ball.x * 0.05) * 30 : 0;
        if (ball.x < 80) startMiss();
    } else if (state === "HOMERUN") {
        ball.x += 15; ball.y -= 12;
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
    if (state !== "WAITING" && state !== "MISS") {
        ctx.save(); ctx.translate(0, ball.offset);
        let color = ball.type === 'giant' ? "#e67e22" : (ball.type === 'sparkle' ? `hsl(${Date.now() % 360}, 100%, 75%)` : (ball.isMagic ? "#9b59b6" : "white"));
        ctx.fillStyle = color;
        if (ball.isMagic) { ctx.shadowBlur = 20; ctx.shadowColor = color; }
        ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.type==='giant'?32:16, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = (ball.isMagic||ball.type==='giant')?"white":"black";
        ctx.font = `bold ${ball.type === 'giant' ? 30 : 20}px Arial`; ctx.textAlign="center";
        ctx.fillText(ball.num, ball.x, ball.y+7); ctx.restore();
    }
    if (hitStopTimer > 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)"; ctx.fillRect(0,0,400,300);
        ctx.fillStyle = "#e74c3c"; ctx.font="bold 45px Arial"; ctx.textAlign="center"; ctx.fillText(praiseMsg, 200, 150);
    }
}

function handleInput(n) {
    if (state !== "PLAYING" || hitStopTimer > 0) return;
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    swingTimer = 15;
    if (ball.num + n === 10) {
        state = "HOMERUN"; timer = 50; score += 10; combo++; 
        if (ball.isMagic) { hitStopTimer = 30; praiseMsg = "AMAZING!"; }
        playSound('homerun'); updateUI();
    } else startMiss();
}

function startMiss() { strikes++; combo = 0; if (strikes >= 3) { alert("Game Over!"); location.reload(); } resetBall(); updateUI(); playSound('miss'); }
function resetBall() { 
    ball.x = 400; ball.y = 180;
    ball.num = Math.floor(Math.random()*9)+1;
    let r = Math.random();
    ball.isMagic = r < 0.3;
    ball.type = ball.isMagic ? (r < 0.1 ? 'giant' : (r < 0.2 ? 'sparkle' : 'normal')) : 'normal';
    ball.speed *= 1.04; state = "PLAYING";
}
function updateUI() { document.getElementById("scoreText").innerText = score; document.getElementById("strikeText").innerText = "X ".repeat(strikes) || "READY"; document.getElementById("levelText").innerText = ball.speed.toFixed(1); }
function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();