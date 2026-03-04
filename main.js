import * as THREE from 'three';

// --- CONFIGURATION ---
const ENEMY_COUNT = 15;
const ENEMY_SPEED = 0.04;
const PATROL_SPEED = 0.01;
const DETECTION_RADIUS = 18;   // unidades do mundo (~200px)
const SPAWN_RADIUS = 40;
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
let inventoryOpen = false;
const enemies = []; // { mesh, state, patrolDir, patrolTimer }
const bullets = [];
let gameStarted = false;
const mouse = new THREE.Vector2();
const worldMouse = new THREE.Vector3();
let aimDir = new THREE.Vector3(0, 1, 0);

const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// --- SCENE ---
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0d2210, 50, 140);

const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 30;
const camera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2, frustumSize * aspect / 2,
    frustumSize / 2, frustumSize / -2, 0.1, 1000
);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('canvas-container').appendChild(renderer.domElement);
renderer.domElement.style.cursor = 'crosshair';

// --- GROUND TEXTURE (Floresta Pixel Art) ---
function createForestTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Base verde escuro
    ctx.fillStyle = '#1c3a1c';
    ctx.fillRect(0, 0, size, size);

    // Variação de grama (blocos pixelados)
    const bs = 8;
    for (let y = 0; y < size; y += bs) {
        for (let x = 0; x < size; x += bs) {
            if (Math.random() < 0.5) {
                const colors = ['#163016', '#1e401e', '#224422', '#1a3a1a', '#1f4520'];
                ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                ctx.fillRect(x, y, bs, bs);
            }
        }
    }
    // Manchas de terra/musgo
    for (let i = 0; i < 120; i++) {
        const gx = Math.floor(Math.random() * (size / bs)) * bs;
        const gy = Math.floor(Math.random() * (size / bs)) * bs;
        ctx.fillStyle = Math.random() < 0.5 ? '#0d1a0d' : '#152815';
        ctx.fillRect(gx, gy, bs * 2, bs);
    }
    // Grama mais clara (detalhes)
    for (let i = 0; i < 200; i++) {
        const gx = Math.floor(Math.random() * (size / bs)) * bs;
        const gy = Math.floor(Math.random() * (size / bs)) * bs;
        ctx.fillStyle = Math.random() < 0.5 ? '#2d5a2d' : '#326632';
        ctx.fillRect(gx, gy, bs, bs / 2);
    }
    // Flores neon (fadinhas da floresta)
    for (let i = 0; i < 80; i++) {
        const gx = Math.floor(Math.random() * (size / bs)) * bs;
        const gy = Math.floor(Math.random() * (size / bs)) * bs;
        const fc = ['#ff00ff', '#cc00ff', '#ff66ff', '#00ffcc', '#ff00aa'];
        ctx.fillStyle = fc[Math.floor(Math.random() * fc.length)];
        ctx.fillRect(gx, gy, bs / 2, bs / 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.repeat.set(30, 30);
    return tex;
}

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshBasicMaterial({ map: createForestTexture() })
);
ground.position.z = -1;
scene.add(ground);

// --- SISTEMA DE PARTÍCULAS (Faíscas Neon) ---
const PARTICLE_COUNT = 500;
let particlePositions;
let particleSpeeds;

function createParticles() {
    particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    particleSpeeds = new Float32Array(PARTICLE_COUNT);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particlePositions[i * 3] = (Math.random() - 0.5) * 250;
        particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 250;
        particlePositions[i * 3 + 2] = 0.4;
        particleSpeeds[i] = 0.01 + Math.random() * 0.025;
        if (Math.random() < 0.5) {
            colors[i * 3] = 1; colors[i * 3 + 1] = 0; colors[i * 3 + 2] = 1; // magenta
        } else {
            colors[i * 3] = 0; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 1; // cyan
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
        size: 0.18, vertexColors: true,
        transparent: true, opacity: 0.55, depthWrite: false
    }));
    scene.add(pts);
    return pts;
}

const particleSystem = createParticles();

function updateParticles() {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particlePositions[i * 3 + 1] += particleSpeeds[i];
        particlePositions[i * 3] += Math.sin(Date.now() * 0.001 + i) * 0.006;
        if (particlePositions[i * 3 + 1] > 130) {
            particlePositions[i * 3 + 1] = -100;
            particlePositions[i * 3] = (Math.random() - 0.5) * 250;
        }
    }
    particleSystem.geometry.attributes.position.needsUpdate = true;
}

// --- ÁRVORES COM SPRITE PNG (em Bosques) ---
const textureLoader = new THREE.TextureLoader();
let treeTexture = null;

function createTree(x, y) {
    const group = new THREE.Group();
    if (treeTexture) {
        const size = 40 + Math.random() * 15;
        const treeMat = new THREE.MeshBasicMaterial({
            map: treeTexture, transparent: true, alphaTest: 0.1, depthWrite: false
        });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 1.15), treeMat);
        plane.position.z = 0.5;
        group.add(plane);
    } else {
        const s = 1.8 + Math.random() * 1;
        const topColors = [0x1a4a1a, 0x1e5a1e, 0x224422];
        group.add(new THREE.Mesh(
            new THREE.CircleGeometry(s, 6),
            new THREE.MeshBasicMaterial({ color: topColors[Math.floor(Math.random() * topColors.length)] })
        ));
    }
    group.position.set(x, y, 0);
    scene.add(group);
}

// Cria grupos/bosques de árvores
function createGrove(cx, cy) {
    const count = 2 + Math.floor(Math.random() * 3); // 2 a 4 por bosque
    for (let i = 0; i < count; i++) {
        const ox = (Math.random() - 0.5) * 25;
        const oy = (Math.random() - 0.5) * 25;
        createTree(cx + ox, cy + oy);
    }
}

function initTrees() {
    for (let i = 0; i < 60; i++) { // 60 bosques = ~150 árvores no total
        const cx = (Math.random() - 0.5) * 240;
        const cy = (Math.random() - 0.5) * 240;
        if (Math.abs(cx) > 18 || Math.abs(cy) > 18) createGrove(cx, cy);
    }
}

textureLoader.load(
    'tree.png',
    (tex) => { treeTexture = tex; initTrees(); },
    undefined,
    () => { initTrees(); }
);

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

const gunMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 1.2),
    new THREE.MeshBasicMaterial({ color: 0x00ffff })
);
gunMesh.position.set(0, 1.1, 0.1);
playerGroup.add(gunMesh);

// HP Bar
const HP_BAR_WIDTH = 2.4;
const hpBarBg = new THREE.Mesh(
    new THREE.PlaneGeometry(HP_BAR_WIDTH + 0.1, 0.38),
    new THREE.MeshBasicMaterial({ color: 0x111111 })
);
hpBarBg.position.set(0, 1.85, 0.2);
playerGroup.add(hpBarBg);

const hpMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
const hpBar = new THREE.Mesh(new THREE.PlaneGeometry(HP_BAR_WIDTH, 0.28), hpMat);
hpBar.position.set(0, 1.85, 0.3);
playerGroup.add(hpBar);

playerGroup.position.set(0, 0, 0);
scene.add(playerGroup);

function updateHPBar() {
    const ratio = Math.max(0, playerHP / PLAYER_MAX_HP);
    hpBar.scale.x = ratio;
    hpBar.position.x = -(HP_BAR_WIDTH * (1 - ratio)) / 2;
    hpMat.color.set(playerHP > 50 ? 0xff00ff : playerHP > 25 ? 0xffff00 :
        (Math.floor(Date.now() / 200) % 2 === 0 ? 0xff2200 : 0xff0000));
}

// --- SAPOS (com IA de Patrulha / Perseguição) ---
function createFrog() {
    const frog = new THREE.Group();

    frog.add(new THREE.Mesh(
        new THREE.CircleGeometry(1, 16),
        new THREE.MeshBasicMaterial({ color: 0x44dd44 })
    ));

    [[(-0.45), 0.7], [0.45, 0.7]].forEach(([ex, ey]) => {
        const eye = new THREE.Mesh(
            new THREE.CircleGeometry(0.28, 12),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        eye.position.set(ex, ey, 0.1);
        const pupil = new THREE.Mesh(
            new THREE.CircleGeometry(0.13, 8),
            new THREE.MeshBasicMaterial({ color: 0x000000 })
        );
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
    enemies.push({
        mesh: frog,
        state: 'patrol',
        patrolDir: Math.random() * Math.PI * 2,
        patrolTimer: Math.floor(Math.random() * 120) + 60
    });
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
            if (b.mesh.position.distanceTo(enemies[j].mesh.position) < 1.5) {
                scene.remove(enemies[j].mesh); enemies.splice(j, 1);
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
    isGameOver = true; gameStarted = false;
    document.getElementById('hud').style.display = 'none';
    document.getElementById('game-over').style.display = 'flex';
}

function resetGame() {
    [...enemies].forEach(e => scene.remove(e.mesh));
    [...bullets].forEach(b => scene.remove(b.mesh));
    enemies.length = 0; bullets.length = 0;
    score = 0; playerHP = PLAYER_MAX_HP; damageCooldown = 0; isGameOver = false; inventoryOpen = false;
    document.getElementById('score-value').innerText = '000000';
    document.getElementById('inventory').style.display = 'none';
    updateHPBar();
    playerGroup.position.set(0, 0, 0);
    camera.position.set(0, 0, 10);
    for (let i = 0; i < ENEMY_COUNT; i++) createFrog();
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('game-menu').style.display = 'flex';
    document.getElementById('game-menu').style.opacity = '1';
}

// --- INVENTÁRIO ---
function toggleInventory() {
    inventoryOpen = !inventoryOpen;
    document.getElementById('inventory').style.display = inventoryOpen ? 'flex' : 'none';
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
    if (!gameStarted || inventoryOpen) return;
    if (e.target.closest('#game-menu') || e.target.closest('#game-over')) return;
    shoot();
    gunMesh.position.y -= 0.2;
    setTimeout(() => { gunMesh.position.y += 0.2; }, 60);
});

window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && gameStarted && !inventoryOpen) {
        document.getElementById('game-menu').style.display = 'flex';
        document.getElementById('game-menu').style.opacity = '1';
        document.getElementById('hud').style.display = 'none';
        gameStarted = false;
    }
    if ((e.code === 'KeyI' || e.code === 'Tab') && gameStarted) {
        e.preventDefault();
        toggleInventory();
    }
});

// --- MOVIMENTO WASD + Mira no Mouse ---
function updateMovement() {
    if (!gameStarted || inventoryOpen) return;

    let mx = 0, my = 0;
    if (keys['KeyW']) my += 1;
    if (keys['KeyS']) my -= 1;
    if (keys['KeyA']) mx -= 1;
    if (keys['KeyD']) mx += 1;

    if (mx !== 0 || my !== 0) {
        const len = Math.sqrt(mx * mx + my * my);
        playerGroup.position.x += (mx / len) * PLAYER_SPEED;
        playerGroup.position.y += (my / len) * PLAYER_SPEED;
    }

    camera.position.x += (playerGroup.position.x - camera.position.x) * 0.08;
    camera.position.y += (playerGroup.position.y - camera.position.y) * 0.08;

    worldMouse.set(mouse.x, mouse.y, 0).unproject(camera);
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
        updateParticles();

        if (damageCooldown > 0) damageCooldown--;
        playerMesh.visible = damageCooldown === 0 || Math.floor(damageCooldown / 6) % 2 === 0;

        // IA dos Sapos: Patrulha <-> Perseguição
        enemies.forEach(enemy => {
            const frog = enemy.mesh;
            const dx = playerGroup.position.x - frog.position.x;
            const dy = playerGroup.position.y - frog.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < DETECTION_RADIUS) {
                // MODO PERSEGUIÇÃO
                enemy.state = 'chase';
                const angle = Math.atan2(dy, dx);
                frog.position.x += Math.cos(angle) * ENEMY_SPEED;
                frog.position.y += Math.sin(angle) * ENEMY_SPEED;
                frog.rotation.z = angle - Math.PI / 2;

                // Dano ao player
                if (dist < 1.5 && damageCooldown === 0) {
                    playerHP -= DAMAGE_PER_HIT;
                    damageCooldown = DAMAGE_COOLDOWN_FRAMES;
                    if (playerHP <= 0) { playerHP = 0; triggerGameOver(); }
                }
            } else {
                // MODO PATRULHA (movimento aleatório lento)
                enemy.state = 'patrol';
                enemy.patrolTimer--;
                if (enemy.patrolTimer <= 0) {
                    enemy.patrolDir = Math.random() * Math.PI * 2;
                    enemy.patrolTimer = Math.floor(Math.random() * 150) + 60;
                }
                frog.position.x += Math.cos(enemy.patrolDir) * PATROL_SPEED;
                frog.position.y += Math.sin(enemy.patrolDir) * PATROL_SPEED;
                // Sacudida leve (sapo descansando)
                frog.rotation.z = Math.sin(Date.now() * 0.002 + enemy.patrolDir) * 0.3;
            }
        });
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    const a = window.innerWidth / window.innerHeight;
    camera.left = -frustumSize * a / 2; camera.right = frustumSize * a / 2;
    camera.top = frustumSize / 2; camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Init
for (let i = 0; i < ENEMY_COUNT; i++) createFrog();
animate();
