import * as THREE from 'three';

// --- CONFIGURATION ---
const ENEMY_COUNT = 15;
const ENEMY_SPEED = 0.035;
const SPAWN_RADIUS = 35;
const BULLET_SPEED = 0.6;
const PLAYER_SPEED = 0.15;
const PLAYER_MAX_HP = 100;
const DAMAGE_PER_HIT = 10;
const DAMAGE_COOLDOWN_FRAMES = 90;

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
let aimDir = new THREE.Vector3(0, 1, 0);

// Teclado
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// --- SCENE ---
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x112211, 40, 120);

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

// Cursor crosshair durante o jogo
renderer.domElement.style.cursor = 'crosshair';

// --- TEXTURA DO CHÃO (floresta pixel art) ---
function createForestTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1c3a1c';
    ctx.fillRect(0, 0, size, size);

    const blockSize = 8;
    for (let y = 0; y < size; y += blockSize) {
        for (let x = 0; x < size; x += blockSize) {
            if (Math.random() < 0.45) {
                const colors = ['#163016', '#1e401e', '#224422'];
                ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                ctx.fillRect(x, y, blockSize, blockSize);
            }
        }
    }
    for (let i = 0; i < 300; i++) {
        const gx = Math.floor(Math.random() * (size / blockSize)) * blockSize;
        const gy = Math.floor(Math.random() * (size / blockSize)) * blockSize;
        ctx.fillStyle = Math.random() < 0.5 ? '#2d5a2d' : '#285228';
        ctx.fillRect(gx, gy, blockSize, blockSize);
    }
    for (let i = 0; i < 60; i++) {
        const gx = Math.floor(Math.random() * (size / blockSize)) * blockSize;
        const gy = Math.floor(Math.random() * (size / blockSize)) * blockSize;
        const colors = ['#ff00ff', '#cc00ff', '#ff66ff', '#00ffaa'];
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.fillRect(gx, gy, blockSize / 2, blockSize / 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.repeat.set(30, 30);
    return texture;
}

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshBasicMaterial({ map: createForestTexture() })
);
ground.position.z = -1;
scene.add(ground);

// --- ÁRVORES COM SPRITE PNG ---
const textureLoader = new THREE.TextureLoader();
let treeTexture = null;

function initTrees() {
    for (let i = 0; i < 80; i++) {
        const x = (Math.random() - 0.5) * 200;
        const y = (Math.random() - 0.5) * 200;
        if (Math.abs(x) > 8 || Math.abs(y) > 8) createTree(x, y);
    }
}

textureLoader.load(
    'tree.png.png',
    (tex) => { treeTexture = tex; initTrees(); },
    undefined,
    () => { console.warn('tree.png não encontrado, usando árvores geométricas.'); initTrees(); }
);

function createTree(x, y) {
    const group = new THREE.Group();

    // Sombra circular no chão
    const shadowGeo = new THREE.CircleGeometry(1.4, 12);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x050f05, transparent: true, opacity: 0.55 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.set(0.3, -0.3, 0.01);
    group.add(shadow);

    if (treeTexture) {
        // Sprite da árvore PNG (vertical, virada pra cima)
        const size = 2.5 + Math.random() * 1.5;
        const treeMat = new THREE.MeshBasicMaterial({
            map: treeTexture,
            transparent: true,
            alphaTest: 0.15,
            depthWrite: false,
        });
        const treePlane = new THREE.Mesh(
            new THREE.PlaneGeometry(size, size * 1.2),
            treeMat
        );
        treePlane.position.z = 0.5;
        group.add(treePlane);
    } else {
        // Fallback geométrico
        const sizes = [1.5, 1.8, 2.2];
        const s = sizes[Math.floor(Math.random() * sizes.length)];
        const topColors = [0x1a4a1a, 0x1e5a1e, 0x224422];
        const top = new THREE.Mesh(
            new THREE.CircleGeometry(s, 6),
            new THREE.MeshBasicMaterial({ color: topColors[Math.floor(Math.random() * topColors.length)] })
        );
        group.add(top);
    }

    group.position.set(x, y, 0);
    scene.add(group);
}

// Trees são criadas no callback do TextureLoader (acima)

// --- PLAYER ---
const playerGroup = new THREE.Group();

const playerMesh = new THREE.Mesh(
    new THREE.CircleGeometry(1, 32),
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
);
playerGroup.add(playerMesh);

const innerMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
);
innerMesh.position.z = 0.05;
playerGroup.add(innerMesh);

// Arma
const gunMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 1.2),
    new THREE.MeshBasicMaterial({ color: 0x00ffff })
);
gunMesh.position.set(0, 1.1, 0.1);
playerGroup.add(gunMesh);

// --- HP BAR ---
const HP_BAR_WIDTH = 2.4;
const HP_BAR_HEIGHT = 0.28;

const hpBarBg = new THREE.Mesh(
    new THREE.PlaneGeometry(HP_BAR_WIDTH + 0.1, HP_BAR_HEIGHT + 0.1),
    new THREE.MeshBasicMaterial({ color: 0x111111 })
);
hpBarBg.position.set(0, 1.85, 0.2);
playerGroup.add(hpBarBg);

const hpMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
const hpBar = new THREE.Mesh(new THREE.PlaneGeometry(HP_BAR_WIDTH, HP_BAR_HEIGHT), hpMat);
hpBar.position.set(0, 1.85, 0.3);
playerGroup.add(hpBar);

playerGroup.position.set(0, 0, 0);
scene.add(playerGroup);

function updateHPBar() {
    const ratio = Math.max(0, playerHP / PLAYER_MAX_HP);
    hpBar.scale.x = ratio;
    hpBar.position.x = -(HP_BAR_WIDTH * (1 - ratio)) / 2;

    if (playerHP > 50) {
        hpMat.color.set(0xff00ff);
    } else if (playerHP > 25) {
        hpMat.color.set(0xffff00);
    } else {
        hpMat.color.set(Math.floor(Date.now() / 200) % 2 === 0 ? 0xff2200 : 0xff0000);
    }
}

// --- SAPOS ---
function createFrog() {
    const frog = new THREE.Group();

    const body = new THREE.Mesh(
        new THREE.CircleGeometry(1, 16),
        new THREE.MeshBasicMaterial({ color: 0x44dd44 })
    );
    frog.add(body);

    const eyeGeo = new THREE.CircleGeometry(0.28, 12);
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    [[- 0.45, 0.7], [0.45, 0.7]].forEach(([ex, ey]) => {
        const eye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
        eye.position.set(ex, ey, 0.1);
        const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.13, 8), pupilMat);
        pupil.position.z = 0.1;
        eye.add(pupil);
        frog.add(eye);
    });

    const angle = Math.random() * Math.PI * 2;
    frog.position.set(
        playerGroup.position.x + Math.cos(angle) * SPAWN_RADIUS,
        playerGroup.position.y + Math.sin(angle) * SPAWN_RADIUS,
        0
    );

    scene.add(frog);
    enemies.push(frog);
}

// --- TIRO ---
function shoot() {
    const bullet = new THREE.Mesh(
        new THREE.CircleGeometry(0.18, 8),
        new THREE.MeshBasicMaterial({ color: 0x00ffff })
    );
    bullet.position.set(playerGroup.position.x, playerGroup.position.y, 0);

    bullets.push({ mesh: bullet, dir: aimDir.clone() });
    scene.add(bullet);
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.mesh.position.addScaledVector(b.dir, BULLET_SPEED);

        if (b.mesh.position.distanceTo(playerGroup.position) > 60) {
            scene.remove(b.mesh); bullets.splice(i, 1); continue;
        }

        for (let j = enemies.length - 1; j >= 0; j--) {
            if (b.mesh.position.distanceTo(enemies[j].position) < 1.5) {
                scene.remove(enemies[j]); enemies.splice(j, 1);
                scene.remove(b.mesh); bullets.splice(i, 1);
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
    [...enemies].forEach(e => scene.remove(e));
    [...bullets].forEach(b => scene.remove(b.mesh));
    enemies.length = 0; bullets.length = 0;
    score = 0; playerHP = PLAYER_MAX_HP; damageCooldown = 0; isGameOver = false;
    document.getElementById('score-value').innerText = '000000';
    updateHPBar();
    playerGroup.position.set(0, 0, 0);
    camera.position.set(0, 0, 10);
    for (let i = 0; i < ENEMY_COUNT; i++) createFrog();
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('game-menu').style.display = 'flex';
    document.getElementById('game-menu').style.opacity = '1';
}

// --- INTERAÇÃO ---
document.getElementById('start-button').addEventListener('click', () => {
    const menu = document.getElementById('game-menu');
    menu.style.opacity = '0';
    setTimeout(() => {
        menu.style.display = 'none';
        document.getElementById('hud').style.display = 'flex';
        gameStarted = true;
    }, 500);
});

document.getElementById('restart-button').addEventListener('click', resetGame);

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('mousedown', (e) => {
    if (!gameStarted || e.target.closest('#game-menu') || e.target.closest('#game-over')) return;
    shoot();
    gunMesh.position.y -= 0.2;
    setTimeout(() => { gunMesh.position.y += 0.2; }, 60);
});

window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && gameStarted) {
        document.getElementById('game-menu').style.display = 'flex';
        document.getElementById('game-menu').style.opacity = '1';
        document.getElementById('hud').style.display = 'none';
        gameStarted = false;
    }
});

// --- MOVIMENTO WASD + Mira no Mouse ---
function updateMovement() {
    if (!gameStarted) return;

    // WASD move o player
    let moveX = 0, moveY = 0;
    if (keys['KeyW']) moveY += 1;
    if (keys['KeyS']) moveY -= 1;
    if (keys['KeyA']) moveX -= 1;
    if (keys['KeyD']) moveX += 1;

    if (moveX !== 0 || moveY !== 0) {
        const len = Math.sqrt(moveX * moveX + moveY * moveY);
        playerGroup.position.x += (moveX / len) * PLAYER_SPEED;
        playerGroup.position.y += (moveY / len) * PLAYER_SPEED;
    }

    // Câmera segue o player suavemente
    camera.position.x += (playerGroup.position.x - camera.position.x) * 0.08;
    camera.position.y += (playerGroup.position.y - camera.position.y) * 0.08;

    // Mira: player gira em direção ao cursor
    worldMouse.set(mouse.x, mouse.y, 0);
    worldMouse.unproject(camera);
    worldMouse.z = 0;

    const dx = worldMouse.x - playerGroup.position.x;
    const dy = worldMouse.y - playerGroup.position.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
        playerGroup.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
        aimDir.set(dx / len, dy / len, 0);
    }
}

// --- GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);

    if (gameStarted) {
        updateMovement();
        updateBullets();
        updateHPBar();

        if (damageCooldown > 0) damageCooldown--;

        // Pisca player quando está levando dano (invencível)
        playerMesh.visible = damageCooldown === 0 || Math.floor(damageCooldown / 6) % 2 === 0;

        enemies.forEach(frog => {
            const angleToPlayer = Math.atan2(
                playerGroup.position.y - frog.position.y,
                playerGroup.position.x - frog.position.x
            );
            frog.position.x += Math.cos(angleToPlayer) * ENEMY_SPEED;
            frog.position.y += Math.sin(angleToPlayer) * ENEMY_SPEED;
            frog.rotation.z = angleToPlayer - Math.PI / 2;

            if (frog.position.distanceTo(playerGroup.position) < 1.5 && damageCooldown === 0) {
                playerHP -= DAMAGE_PER_HIT;
                damageCooldown = DAMAGE_COOLDOWN_FRAMES;
                if (playerHP <= 0) { playerHP = 0; triggerGameOver(); }
            }
        });
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    const a = window.innerWidth / window.innerHeight;
    camera.left = -frustumSize * a / 2;
    camera.right = frustumSize * a / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Init
for (let i = 0; i < ENEMY_COUNT; i++) createFrog();
animate();
