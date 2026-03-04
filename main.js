import * as THREE from 'three';

// --- CONFIGURATION ---
const ENEMY_COUNT = 15;
const ENEMY_SPEED = 0.035;
const SPAWN_RADIUS = 35;
const BULLET_SPEED = 0.6;
const PLAYER_SPEED = 0.18;
const PLAYER_MAX_HP = 100;
const DAMAGE_PER_HIT = 10;
const DAMAGE_COOLDOWN_FRAMES = 90; // 1.5s de invencibilidade após levar dano

// --- STATE ---
let score = 0;
let playerHP = PLAYER_MAX_HP;
let damageCooldown = 0;
let isGameOver = false;
const enemies = [];
const bullets = [];
let gameStarted = false;
const mouse = new THREE.Vector2();
const worldMouse = new THREE.Vector3();
let lastMoveDir = new THREE.Vector3(0, 1, 0);

// --- SCENE SETUP ---
const scene = new THREE.Scene();

// Fog estilo floresta densa  
scene.fog = new THREE.Fog(0x112211, 40, 120);

// Orthographic Camera
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 30;
const camera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    frustumSize / -2,
    0.1, 1000
);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// --- TEXTURA PROCEDURAL DE FLORESTA (pixel art) ---
function createForestTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Base: verde escuro floresta
    ctx.fillStyle = '#1c3a1c';
    ctx.fillRect(0, 0, size, size);

    // Variação de cor base em blocos pixelados
    const blockSize = 8;
    for (let y = 0; y < size; y += blockSize) {
        for (let x = 0; x < size; x += blockSize) {
            if (Math.random() < 0.45) {
                const v = Math.floor(Math.random() * 3);
                const colors = ['#163016', '#1e401e', '#224422'];
                ctx.fillStyle = colors[v];
                ctx.fillRect(x, y, blockSize, blockSize);
            }
        }
    }

    // Grama alta - manchas mais claras
    for (let i = 0; i < 300; i++) {
        const gx = Math.floor(Math.random() * (size / blockSize)) * blockSize;
        const gy = Math.floor(Math.random() * (size / blockSize)) * blockSize;
        ctx.fillStyle = Math.random() < 0.5 ? '#2d5a2d' : '#285228';
        ctx.fillRect(gx, gy, blockSize, blockSize);
    }

    // Pedrinhas / Terra escura
    for (let i = 0; i < 80; i++) {
        const gx = Math.floor(Math.random() * (size / blockSize)) * blockSize;
        const gy = Math.floor(Math.random() * (size / blockSize)) * blockSize;
        ctx.fillStyle = Math.random() < 0.5 ? '#0d1f0d' : '#152615';
        ctx.fillRect(gx, gy, blockSize * 2, blockSize);
    }

    // Flores pixeladas
    for (let i = 0; i < 60; i++) {
        const gx = Math.floor(Math.random() * (size / blockSize)) * blockSize;
        const gy = Math.floor(Math.random() * (size / blockSize)) * blockSize;
        const flowerColors = ['#ff00ff', '#cc00ff', '#ff66ff', '#ffccff', '#00ffaa'];
        ctx.fillStyle = flowerColors[Math.floor(Math.random() * flowerColors.length)];
        ctx.fillRect(gx, gy, blockSize / 2, blockSize / 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter; // pixelado!
    texture.minFilter = THREE.NearestFilter;
    texture.repeat.set(30, 30);
    return texture;
}

const forestTexture = createForestTexture();
const groundGeometry = new THREE.PlaneGeometry(400, 400);
const groundMaterial = new THREE.MeshBasicMaterial({ map: forestTexture });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.position.z = -1;
scene.add(ground);

// --- PLAYER ---
const playerGroup = new THREE.Group();

// Corpo da player (círculo rosa)
const playerGeo = new THREE.CircleGeometry(1, 32);
const playerMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
const playerMesh = new THREE.Mesh(playerGeo, playerMat);
playerGroup.add(playerMesh);

// Inner circle (detalhe)
const innerGeo = new THREE.CircleGeometry(0.5, 32);
const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const innerMesh = new THREE.Mesh(innerGeo, innerMat);
innerMesh.position.z = 0.05;
playerGroup.add(innerMesh);

// Arma (pistola neon azul)
const gunGeo = new THREE.PlaneGeometry(0.35, 1.2);
const gunMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
const gunMesh = new THREE.Mesh(gunGeo, gunMat);
gunMesh.position.set(0, 1.1, 0.1);
playerGroup.add(gunMesh);

// --- HP BAR acima do player ---
const HP_BAR_WIDTH = 2.4;
const HP_BAR_HEIGHT = 0.28;

// Fundo da barra
const hpBgGeo = new THREE.PlaneGeometry(HP_BAR_WIDTH + 0.1, HP_BAR_HEIGHT + 0.1);
const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
const hpBarBg = new THREE.Mesh(hpBgGeo, hpBgMat);
hpBarBg.position.set(0, 1.85, 0.2);
playerGroup.add(hpBarBg);

// Barra de HP em si
const hpGeo = new THREE.PlaneGeometry(HP_BAR_WIDTH, HP_BAR_HEIGHT);
const hpMat = new THREE.MeshBasicMaterial({ color: 0xff00ff }); // Rosa neon inicial
const hpBar = new THREE.Mesh(hpGeo, hpMat);
hpBar.position.set(0, 1.85, 0.3);
playerGroup.add(hpBar);

playerGroup.position.set(0, 0, 0);
scene.add(playerGroup);

function updateHPBar() {
    const ratio = Math.max(0, playerHP / PLAYER_MAX_HP);
    hpBar.scale.x = ratio;
    // Desloca para manter alinhado à esquerda
    hpBar.position.x = -(HP_BAR_WIDTH * (1 - ratio)) / 2;

    if (playerHP > 50) {
        hpMat.color.set(0xff00ff); // Rosa neon
    } else if (playerHP > 25) {
        hpMat.color.set(0xffff00); // Amarelo
    } else {
        hpMat.color.set(0xff2200); // Vermelho
        // Pisca quando low HP
        if (Math.floor(Date.now() / 200) % 2 === 0) {
            hpMat.color.set(0xff0000);
        }
    }
}

// --- ÁRVORES ESTILO PIXEL ART (vista de cima) ---
function createTree(x, y) {
    const group = new THREE.Group();

    // Copa da árvore (círculo verde, vista de cima)
    const sizes = [1.5, 1.8, 2.2];
    const s = sizes[Math.floor(Math.random() * sizes.length)];
    const topGeo = new THREE.CircleGeometry(s, 6);
    const topColors = [0x1a4a1a, 0x1e5a1e, 0x224422, 0x2d5a1e];
    const topMat = new THREE.MeshBasicMaterial({ color: topColors[Math.floor(Math.random() * topColors.length)] });
    const top = new THREE.Mesh(topGeo, topMat);
    group.add(top);

    // Sombra da árvore
    const shadowGeo = new THREE.CircleGeometry(s * 0.7, 6);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x0a200a, transparent: true, opacity: 0.5 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.set(0.3, -0.3, -0.1);
    group.add(shadow);

    group.position.set(x, y, 0);
    scene.add(group);
}

for (let i = 0; i < 80; i++) {
    const x = (Math.random() - 0.5) * 200;
    const y = (Math.random() - 0.5) * 200;
    if (Math.abs(x) > 8 || Math.abs(y) > 8) createTree(x, y);
}

// --- SAPOS 2D ---
function createFrog() {
    const frog = new THREE.Group();

    const bodyGeo = new THREE.CircleGeometry(1, 16);
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x44dd44 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    frog.add(body);

    // Olhos
    const eyeGeo = new THREE.CircleGeometry(0.28, 12);
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const eyeL = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    eyeL.position.set(-0.45, 0.7, 0.1);
    const pupilL = new THREE.Mesh(new THREE.CircleGeometry(0.13, 8), pupilMat);
    pupilL.position.z = 0.1;
    eyeL.add(pupilL);
    frog.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    eyeR.position.set(0.45, 0.7, 0.1);
    const pupilR = new THREE.Mesh(new THREE.CircleGeometry(0.13, 8), pupilMat);
    pupilR.position.z = 0.1;
    eyeR.add(pupilR);
    frog.add(eyeR);

    const angle = Math.random() * Math.PI * 2;
    frog.position.x = playerGroup.position.x + Math.cos(angle) * SPAWN_RADIUS;
    frog.position.y = playerGroup.position.y + Math.sin(angle) * SPAWN_RADIUS;
    frog.position.z = 0;

    scene.add(frog);
    enemies.push(frog);
}

// --- TIRO ---
function shoot() {
    const bulletGeo = new THREE.CircleGeometry(0.18, 8);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const bullet = new THREE.Mesh(bulletGeo, bulletMat);

    bullet.position.set(playerGroup.position.x, playerGroup.position.y, 0);

    const dir = lastMoveDir.clone();
    bullets.push({ mesh: bullet, dir: dir });
    scene.add(bullet);
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.mesh.position.addScaledVector(b.dir, BULLET_SPEED);

        if (b.mesh.position.distanceTo(playerGroup.position) > 60) {
            scene.remove(b.mesh);
            bullets.splice(i, 1);
            continue;
        }

        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (b.mesh.position.distanceTo(enemy.position) < 1.5) {
                scene.remove(enemy);
                enemies.splice(j, 1);
                scene.remove(b.mesh);
                bullets.splice(i, 1);

                score += 100;
                document.getElementById('score-value').innerText = score.toString().padStart(6, '0');
                createFrog();
                break;
            }
        }
    }
}

// --- GAME OVER ---
function triggerGameOver() {
    isGameOver = true;
    gameStarted = false;
    document.getElementById('hud').style.display = 'none';
    document.getElementById('game-over').style.display = 'flex';
}

function resetGame() {
    // Remove todos os inimigos e tiros
    [...enemies].forEach(e => scene.remove(e));
    [...bullets].forEach(b => scene.remove(b.mesh));
    enemies.length = 0;
    bullets.length = 0;

    // Reseta estado
    score = 0;
    playerHP = PLAYER_MAX_HP;
    damageCooldown = 0;
    isGameOver = false;
    document.getElementById('score-value').innerText = '000000';
    updateHPBar();

    // Volta player ao centro
    playerGroup.position.set(0, 0, 0);
    camera.position.set(0, 0, 10);

    // Gera novos inimigos
    for (let i = 0; i < ENEMY_COUNT; i++) createFrog();

    document.getElementById('game-over').style.display = 'none';
    document.getElementById('game-menu').style.display = 'flex';
    document.getElementById('game-menu').style.opacity = '1';
}

// --- INTERAÇÃO ---
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const menu = document.getElementById('game-menu');
const hud = document.getElementById('hud');

startButton.addEventListener('click', () => {
    menu.style.opacity = '0';
    setTimeout(() => {
        menu.style.display = 'none';
        hud.style.display = 'flex';
        gameStarted = true;
    }, 500);
});

restartButton.addEventListener('click', () => {
    resetGame();
});

// Mouse tracking
window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('mousedown', (e) => {
    if (!gameStarted || e.target.closest('#game-menu') || e.target.closest('#game-over')) return;
    shoot();
    gunMesh.position.y -= 0.25;
    setTimeout(() => { gunMesh.position.y += 0.25; }, 60);
});

window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && gameStarted) {
        menu.style.display = 'flex';
        menu.style.opacity = '1';
        hud.style.display = 'none';
        gameStarted = false;
    }
});

// --- MOVIMENTO (player segue o mouse) ---
function updateMovement() {
    if (!gameStarted) return;

    // Calcula posição do mouse no mundo
    worldMouse.set(mouse.x, mouse.y, 0);
    worldMouse.unproject(camera);
    worldMouse.z = 0;

    const dx = worldMouse.x - playerGroup.position.x;
    const dy = worldMouse.y - playerGroup.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.3) {
        // Velocidade proporcional mas com teto
        const speed = Math.min(dist * 0.12, PLAYER_SPEED);
        playerGroup.position.x += (dx / dist) * speed;
        playerGroup.position.y += (dy / dist) * speed;

        // Grava direção atual para os tiros
        lastMoveDir.set(dx / dist, dy / dist, 0);

        // Rotaciona o player pra direção do movimento
        playerGroup.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    }

    // Câmera segue o player suavemente
    camera.position.x += (playerGroup.position.x - camera.position.x) * 0.08;
    camera.position.y += (playerGroup.position.y - camera.position.y) * 0.08;
}

// --- GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);

    if (gameStarted) {
        updateMovement();
        updateBullets();
        updateHPBar();

        if (damageCooldown > 0) damageCooldown--;

        enemies.forEach(frog => {
            const angleToPlayer = Math.atan2(
                playerGroup.position.y - frog.position.y,
                playerGroup.position.x - frog.position.x
            );

            frog.position.x += Math.cos(angleToPlayer) * ENEMY_SPEED;
            frog.position.y += Math.sin(angleToPlayer) * ENEMY_SPEED;
            frog.rotation.z = angleToPlayer - Math.PI / 2;

            // Dano ao player
            const distToPlayer = frog.position.distanceTo(playerGroup.position);
            if (distToPlayer < 1.5 && damageCooldown === 0) {
                playerHP -= DAMAGE_PER_HIT;
                damageCooldown = DAMAGE_COOLDOWN_FRAMES;

                if (playerHP <= 0) {
                    playerHP = 0;
                    triggerGameOver();
                }
            }
        });
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Init
for (let i = 0; i < ENEMY_COUNT; i++) createFrog();
animate();
