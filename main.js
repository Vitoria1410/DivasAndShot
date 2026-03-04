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
const MAP_LIMIT = 95; // metade do mapa jogável (unidades)
const ENEMY_MAX_HP = 50;
const SWORD_DAMAGE = 25;
const SWORD_RANGE = 4.5;
const GUN_DAMAGE = 15;

// Novos inimigos: Aranha
const SPIDER_COUNT = 5;
const WEB_SPEED = 0.25;
const WEB_DAMAGE = 15;
const SPIDER_DETECTION_RADIUS = 25;
const SPIDER_FIRE_RATE = 120; // frames entre tiros

// --- STATE ---
let score = 0;
let playerHP = PLAYER_MAX_HP;
let damageCooldown = 0;
let isGameOver = false;
let inventoryOpen = false;

// Animation State
let playerState = 'idle'; // 'idle' or 'walk'
let playerDirection = 'front'; // 'front', 'back', 'side'
let playerFrames = 4; // Ajuste para o número real de frames no seu png
let animTimer = 0;
let currentFrame = 0;
const ANIM_SPEED = 0.15;

const treeColliders = [];
const enemies = []; // { mesh, state, patrolDir, patrolTimer, type }
const bullets = [];
const webs = [];
let gameStarted = false;
const mouse = new THREE.Vector2();
const worldMouse = new THREE.Vector3();
let aimDir = new THREE.Vector3(0, 1, 0);

// Weapon state
const WEAPONS = ['GUN', 'SWORD'];
let currentWeaponIndex = 0;
let canSlash = true;
let swordMesh;

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

// TextureLoader compartilhado
const textureLoader = new THREE.TextureLoader();

// --- GROUND TEXTURE (PNG ou Procedural como fallback) ---
function createForestTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1c3a1c';
    ctx.fillRect(0, 0, size, size);
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
    for (let i = 0; i < 80; i++) {
        const gx = Math.floor(Math.random() * (size / bs)) * bs;
        const gy = Math.floor(Math.random() * (size / bs)) * bs;
        const fc = ['#ff00ff', '#cc00ff', '#00ffcc'];
        ctx.fillStyle = fc[Math.floor(Math.random() * fc.length)];
        ctx.fillRect(gx, gy, bs / 2, bs / 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.repeat.set(30, 30);
    return tex;
}

function applyGroundTexture(tex) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.repeat.set(20, 20);
    ground.material.map = tex;
    ground.material.color.setHex(0xaaaaaa); // Escurece o mapa multiplicando por cinza escuro
    ground.material.needsUpdate = true;
}

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_LIMIT * 2 + 10, MAP_LIMIT * 2 + 10),
    // Cor cinza escura para baixar o brilho/contraste do mapa
    new THREE.MeshBasicMaterial({ map: createForestTexture(), color: 0x777777 })
);
ground.position.z = -1;
scene.add(ground);

// --- BORDAS DO MAPA ---
const borderThickness = 10;
const borderMat = new THREE.MeshBasicMaterial({ color: 0x0a0014, transparent: true, opacity: 0.8 });
// Top
const borderTop = new THREE.Mesh(new THREE.PlaneGeometry(MAP_LIMIT * 2 + borderThickness * 2, borderThickness), borderMat);
borderTop.position.set(0, MAP_LIMIT + borderThickness / 2, 0.1);
scene.add(borderTop);
// Bottom
const borderBottom = new THREE.Mesh(new THREE.PlaneGeometry(MAP_LIMIT * 2 + borderThickness * 2, borderThickness), borderMat);
borderBottom.position.set(0, -MAP_LIMIT - borderThickness / 2, 0.1);
scene.add(borderBottom);
// Left
const borderLeft = new THREE.Mesh(new THREE.PlaneGeometry(borderThickness, MAP_LIMIT * 2), borderMat);
borderLeft.position.set(-MAP_LIMIT - borderThickness / 2, 0, 0.1);
scene.add(borderLeft);
// Right
const borderRight = new THREE.Mesh(new THREE.PlaneGeometry(borderThickness, MAP_LIMIT * 2), borderMat);
borderRight.position.set(MAP_LIMIT + borderThickness / 2, 0, 0.1);
scene.add(borderRight);

// Tenta carregar ground.jpg; se existir, substitui o procedural
textureLoader.load(
    'ground.jpg',
    (tex) => applyGroundTexture(tex),
    undefined,
    () => { /* usa textura procedural mesmo */ }
);

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
        particlePositions[i * 3 + 2] = 3.0; // Bem acima das árvores
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
let treeTexture = null;

function createTree(x, y) {
    const group = new THREE.Group();
    if (treeTexture) {
        const size = 22 + Math.random() * 10; // 22 a 32 unidades
        const treeMat = new THREE.MeshBasicMaterial({
            map: treeTexture, transparent: true, alphaTest: 0.1, depthWrite: false
        });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 1.15), treeMat);
        // Eleva a arte para a raiz (base do tronco) ficar no Y = 0 do grupo
        plane.position.set(0, size * 0.4, 0.5);
        group.add(plane);

        // Colisor esférico reduzido e mais centralizado no tronco da árvore
        treeColliders.push({ x: x, y: y + size * 0.06, radius: size * 0.06 });
    } else {
        const s = 1.8 + Math.random() * 1;
        const topColors = [0x1a4a1a, 0x1e5a1e, 0x224422];
        group.add(new THREE.Mesh(
            new THREE.CircleGeometry(s, 6),
            new THREE.MeshBasicMaterial({ color: topColors[Math.floor(Math.random() * topColors.length)] })
        ));
        treeColliders.push({ x: x, y: y, radius: s });
    }
    // Determina o Z baseado no Y (Depth Sorting - árvores na frente sobrepõem as de trás)
    group.position.set(x, y, -y * 0.001);
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

// Visual da Personagem
const playerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, alphaTest: 0.1 });
const playerVisual = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), playerMat);
playerVisual.position.set(0, 0.8, 0.2);
playerGroup.add(playerVisual);

const playerTextures = {
    'front': textureLoader.load('walkfront.png.png'),
    'back': textureLoader.load('backwalk.png.png'),
    'side': textureLoader.load('sidewalk.png.png')
};

Object.values(playerTextures).forEach(tex => {
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.repeat.set(1 / playerFrames, 1);
});

playerMat.map = playerTextures['front'];
playerMat.needsUpdate = true;

// Grupo da Mira (só a arma gira!)
const aimGroup = new THREE.Group();
const gunMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 1.2),
    new THREE.MeshBasicMaterial({ color: 0x00ffff })
);
// Posição original da arma antes do offset
gunMesh.position.set(0, 1.1, 0.1);
aimGroup.add(gunMesh);

// Espada (invisível no começo)
swordMesh = new THREE.Group();
const swordBlade = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 2.5),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
);
swordBlade.position.set(0, 1.2, 0);
swordMesh.add(swordBlade);
const swordHandle = new THREE.Mesh(
    new THREE.PlaneGeometry(0.2, 0.6),
    new THREE.MeshBasicMaterial({ color: 0x555555 })
);
swordHandle.position.set(0, 0, 0);
swordMesh.add(swordHandle);
swordMesh.visible = false;
aimGroup.add(swordMesh);

playerGroup.add(aimGroup);

// HP Bar
const HP_BAR_WIDTH = 2.4;
const hpBarBg = new THREE.Mesh(
    new THREE.PlaneGeometry(HP_BAR_WIDTH + 0.1, 0.38),
    new THREE.MeshBasicMaterial({ color: 0x111111 })
);
hpBarBg.position.set(0, 3.0, 0.5); // Movido para cima da cabeça do PNG
playerGroup.add(hpBarBg);

const hpMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
const hpBar = new THREE.Mesh(new THREE.PlaneGeometry(HP_BAR_WIDTH, 0.28), hpMat);
hpBar.position.set(0, 3.0, 0.51);
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

    // Barra de Vida do Sapo
    const enemyHpBg = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.15),
        new THREE.MeshBasicMaterial({ color: 0x111111 })
    );
    enemyHpBg.position.set(0, 1.4, 0.2);
    frog.add(enemyHpBg);

    const enemyHpBar = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.1),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    enemyHpBar.position.set(0, 1.4, 0.21);
    frog.add(enemyHpBar);

    const angle = Math.random() * Math.PI * 2;
    const fx = playerGroup.position.x + Math.cos(angle) * SPAWN_RADIUS;
    const fy = playerGroup.position.y + Math.sin(angle) * SPAWN_RADIUS;
    frog.position.set(fx, fy, -fy * 0.001); // Depth sorting

    scene.add(frog);
    enemies.push({
        mesh: frog,
        hpBar: enemyHpBar,
        hp: ENEMY_MAX_HP,
        type: 'frog',
        state: 'patrol',
        patrolDir: Math.random() * Math.PI * 2,
        patrolTimer: Math.floor(Math.random() * 120) + 60
    });
}

function createSpider() {
    const spider = new THREE.Group();
    // Corpo
    const body = new THREE.Mesh(
        new THREE.CircleGeometry(0.8, 8),
        new THREE.MeshBasicMaterial({ color: 0x222222 })
    );
    spider.add(body);
    // Pernas (simplificadas)
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const leg = new THREE.Mesh(
            new THREE.PlaneGeometry(1.2, 0.1),
            new THREE.MeshBasicMaterial({ color: 0x444444 })
        );
        leg.position.set(Math.cos(angle) * 0.6, Math.sin(angle) * 0.6, -0.1);
        leg.rotation.z = angle;
        spider.add(leg);
    }
    // Olhos vermelhos
    [[-0.2, 0.3], [0.2, 0.3]].forEach(([ex, ey]) => {
        const eye = new THREE.Mesh(
            new THREE.CircleGeometry(0.12, 6),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        eye.position.set(ex, ey, 0.1);
        spider.add(eye);
    });

    // Barra de Vida
    const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.12), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    hpBg.position.set(0, 1.2, 0.2);
    spider.add(hpBg);
    const hpBar = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.08), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    hpBar.position.set(0, 1.2, 0.21);
    spider.add(hpBar);

    const angle = Math.random() * Math.PI * 2;
    const fx = playerGroup.position.x + Math.cos(angle) * SPAWN_RADIUS;
    const fy = playerGroup.position.y + Math.sin(angle) * SPAWN_RADIUS;
    spider.position.set(fx, fy, -fy * 0.001);

    scene.add(spider);
    enemies.push({
        mesh: spider,
        hpBar: hpBar,
        hp: ENEMY_MAX_HP * 0.8, // aranhas têm menos vida que sapos
        type: 'spider',
        state: 'patrol',
        shootTimer: Math.floor(Math.random() * SPIDER_FIRE_RATE),
        patrolDir: Math.random() * Math.PI * 2,
        patrolTimer: Math.floor(Math.random() * 100) + 40
    });
}

function shootWeb(fromPosition) {
    const web = new THREE.Mesh(
        new THREE.CircleGeometry(0.4, 6),
        new THREE.MeshBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.8 })
    );
    web.position.copy(fromPosition);
    web.position.z = 0.5;

    const dx = playerGroup.position.x - fromPosition.x;
    const dy = playerGroup.position.y - fromPosition.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    webs.push({
        mesh: web,
        dir: new THREE.Vector3(dx / len, dy / len, 0)
    });
    scene.add(web);
}

// --- ARMAS & MECÂNICAS ---
function switchWeapon(direction) {
    if (direction > 0) currentWeaponIndex = (currentWeaponIndex + 1) % WEAPONS.length;
    else currentWeaponIndex = (currentWeaponIndex - 1 + WEAPONS.length) % WEAPONS.length;

    const currentWeapon = WEAPONS[currentWeaponIndex];
    document.getElementById('weapon-name').innerText = currentWeapon;

    gunMesh.visible = (currentWeapon === 'GUN');
    swordMesh.visible = (currentWeapon === 'SWORD');
}

function updateEnemyHP(enemy, damage) {
    enemy.hp -= damage;
    const ratio = Math.max(0, enemy.hp / ENEMY_MAX_HP);
    enemy.hpBar.scale.x = ratio;
    enemy.hpBar.position.x = -(1.6 * (1 - ratio)) / 2;
    enemy.hpBar.material.color.set(ratio > 0.5 ? 0x00ff00 : ratio > 0.25 ? 0xffff00 : 0xff0000);
    return enemy.hp <= 0;
}

function slash() {
    if (!canSlash) return;
    canSlash = false;

    // Efeito visual de swing
    swordMesh.rotation.z = -1.5;
    setTimeout(() => {
        swordMesh.rotation.z = 1.5;

        // Área de hit na frente do player
        const hitZone = new THREE.Vector3().copy(playerGroup.position).addScaledVector(aimDir, 2.5);

        for (let j = enemies.length - 1; j >= 0; j--) {
            if (enemies[j].mesh.position.distanceTo(hitZone) < 3.5) {
                const type = enemies[j].type;
                if (updateEnemyHP(enemies[j], SWORD_DAMAGE)) {
                    scene.remove(enemies[j].mesh); enemies.splice(j, 1);
                    score += 150; // Bônus por matar de perto
                    document.getElementById('score-value').innerText = score.toString().padStart(6, '0');
                    if (type === 'frog') createFrog(); else createSpider();
                }
            }
        }

        setTimeout(() => {
            swordMesh.rotation.z = 0;
            canSlash = true;
        }, 150);
    }, 50);
}

// --- TIRO ---
function shoot() {
    if (WEAPONS[currentWeaponIndex] === 'SWORD') {
        slash();
        return;
    }
    const bullet = new THREE.Mesh(
        new THREE.CircleGeometry(0.18, 8),
        new THREE.MeshBasicMaterial({ color: 0x00ffff })
    );
    bullet.position.set(playerGroup.position.x, playerGroup.position.y, 1.0); // Z alto pra passar sobre coisas
    bullets.push({ mesh: bullet, dir: aimDir.clone() });
    scene.add(bullet);

    // Cooldown/Recuo visual da arma
    gunMesh.position.y -= 0.3;
    setTimeout(() => { gunMesh.position.y += 0.3; }, 60);
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
                const isDead = updateEnemyHP(enemies[j], GUN_DAMAGE);
                scene.remove(b.mesh); bullets.splice(i, 1);

                if (isDead) {
                    const type = enemies[j].type;
                    scene.remove(enemies[j].mesh); enemies.splice(j, 1);
                    score += 100;
                    document.getElementById('score-value').innerText = score.toString().padStart(6, '0');
                    if (type === 'frog') createFrog(); else createSpider();
                }
                break;
            }
        }
    }
}

function updateWebs() {
    for (let i = webs.length - 1; i >= 0; i--) {
        const w = webs[i];
        w.mesh.position.addScaledVector(w.dir, WEB_SPEED);

        // Colisão da teia com o Player
        if (w.mesh.position.distanceTo(playerGroup.position) < 1.2) {
            if (damageCooldown === 0) {
                playerHP -= WEB_DAMAGE;
                damageCooldown = DAMAGE_COOLDOWN_FRAMES;
                if (playerHP <= 0) { playerHP = 0; triggerGameOver(); }
            }
            scene.remove(w.mesh); webs.splice(i, 1);
            continue;
        }

        if (w.mesh.position.distanceTo(playerGroup.position) > 50) {
            scene.remove(w.mesh); webs.splice(i, 1);
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
    [...webs].forEach(w => scene.remove(w.mesh));
    enemies.length = 0; bullets.length = 0; webs.length = 0;
    score = 0; playerHP = PLAYER_MAX_HP; damageCooldown = 0; isGameOver = false; inventoryOpen = false;
    document.getElementById('score-value').innerText = '000000';
    document.getElementById('inventory').style.display = 'none';
    updateHPBar();
    playerGroup.position.set(0, 0, 0);
    camera.position.set(0, 0, 10);
    for (let i = 0; i < ENEMY_COUNT; i++) createFrog();
    for (let i = 0; i < SPIDER_COUNT; i++) createSpider();
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
});

window.addEventListener('wheel', (e) => {
    if (!gameStarted || inventoryOpen) return;
    switchWeapon(e.deltaY);
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

    let nextX = playerGroup.position.x;
    let nextY = playerGroup.position.y;

    if (mx !== 0 || my !== 0) {
        const len = Math.sqrt(mx * mx + my * my);
        nextX += (mx / len) * PLAYER_SPEED;
        nextY += (my / len) * PLAYER_SPEED;

        playerState = 'walk';

        // Prioridade lateral na animação se houver movimento Horizontal
        if (mx !== 0) {
            playerDirection = 'side';
            playerVisual.scale.x = mx < 0 ? -1 : 1;
        } else if (my > 0) {
            playerDirection = 'back';
        } else {
            playerDirection = 'front';
        }
    } else {
        playerState = 'idle';
    }

    // Troca de textura
    if (playerMat.map !== playerTextures[playerDirection]) {
        playerMat.map = playerTextures[playerDirection];
    }

    // --- SISTEMA DE COLISÃO / ANTI-GRAVITY ---
    // Resolução de colisão com as árvores (círculos)
    const playerRadius = 0.8;
    for (const tree of treeColliders) {
        const dx = nextX - tree.x;
        const dy = nextY - tree.y;
        const distSq = dx * dx + dy * dy;
        const minRadiusSq = (playerRadius + tree.radius) * (playerRadius + tree.radius);

        // Se entrou na raiz da árvore, afasta suavemente
        if (distSq < minRadiusSq && distSq > 0) {
            const dist = Math.sqrt(distSq);
            const overlap = (playerRadius + tree.radius) - dist;
            nextX += (dx / dist) * overlap;
            nextY += (dy / dist) * overlap;
        }
    }

    // Limita o jogador dentro do mapa
    playerGroup.position.x = THREE.MathUtils.clamp(nextX, -MAP_LIMIT, MAP_LIMIT);
    playerGroup.position.y = THREE.MathUtils.clamp(nextY, -MAP_LIMIT, MAP_LIMIT);

    // Depth Sorting pelo eixo Y da personagem
    playerGroup.position.z = -playerGroup.position.y * 0.001;

    camera.position.x += (playerGroup.position.x - camera.position.x) * 0.08;
    camera.position.y += (playerGroup.position.y - camera.position.y) * 0.08;

    worldMouse.set(mouse.x, mouse.y, 0).unproject(camera);
    worldMouse.z = 0;

    const dx = worldMouse.x - playerGroup.position.x;
    const dy = worldMouse.y - playerGroup.position.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
        // Gira apenas a arma para o mouse
        aimGroup.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
        aimDir.set(dx / len, dy / len, 0);

        // Vira a sprite da personagem para o lado que está atirando/mirando
        playerVisual.scale.x = dx < 0 ? -1 : 1;
    }
}

// --- GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);

    if (gameStarted) {
        updateMovement();
        updateBullets();
        updateWebs();
        updateHPBar();
        updateParticles();

        // Animação da Personagem
        if (playerState === 'walk') {
            animTimer += ANIM_SPEED;
            currentFrame = Math.floor(animTimer) % playerFrames;
        } else {
            currentFrame = 0; // Frame de parada
        }

        if (playerMat.map) {
            playerMat.map.offset.x = currentFrame / playerFrames;
        }

        if (damageCooldown > 0) damageCooldown--;
        playerVisual.visible = damageCooldown === 0 || Math.floor(damageCooldown / 6) % 2 === 0;

        // IA dos Inimigos
        enemies.forEach(enemy => {
            const mesh = enemy.mesh;
            const dx = playerGroup.position.x - mesh.position.x;
            const dy = playerGroup.position.y - mesh.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (enemy.type === 'frog') {
                if (dist < DETECTION_RADIUS) {
                    enemy.state = 'chase';
                    const angle = Math.atan2(dy, dx);
                    mesh.position.x += Math.cos(angle) * ENEMY_SPEED;
                    mesh.position.y += Math.sin(angle) * ENEMY_SPEED;
                    mesh.rotation.z = angle - Math.PI / 2;
                    if (dist < 1.5 && damageCooldown === 0) {
                        playerHP -= DAMAGE_PER_HIT;
                        damageCooldown = DAMAGE_COOLDOWN_FRAMES;
                        if (playerHP <= 0) { playerHP = 0; triggerGameOver(); }
                    }
                } else {
                    enemy.state = 'patrol';
                    enemy.patrolTimer--;
                    if (enemy.patrolTimer <= 0) {
                        enemy.patrolDir = Math.random() * Math.PI * 2;
                        enemy.patrolTimer = Math.floor(Math.random() * 150) + 60;
                    }
                    mesh.position.x += Math.cos(enemy.patrolDir) * PATROL_SPEED;
                    mesh.position.y += Math.sin(enemy.patrolDir) * PATROL_SPEED;
                    mesh.rotation.z = Math.sin(Date.now() * 0.002 + enemy.patrolDir) * 0.3;
                }
            } else if (enemy.type === 'spider') {
                if (dist < SPIDER_DETECTION_RADIUS) {
                    const angle = Math.atan2(dy, dx);
                    if (dist > 16) {
                        mesh.position.x += Math.cos(angle) * ENEMY_SPEED * 0.5;
                        mesh.position.y += Math.sin(angle) * ENEMY_SPEED * 0.5;
                    } else if (dist < 10) {
                        mesh.position.x -= Math.cos(angle) * ENEMY_SPEED * 0.8;
                        mesh.position.y -= Math.sin(angle) * ENEMY_SPEED * 0.8;
                    }
                    mesh.rotation.z = angle - Math.PI / 2;

                    enemy.shootTimer--;
                    if (enemy.shootTimer <= 0) {
                        shootWeb(mesh.position);
                        enemy.shootTimer = SPIDER_FIRE_RATE + Math.random() * 40;
                    }
                } else {
                    enemy.patrolTimer--;
                    if (enemy.patrolTimer <= 0) {
                        enemy.patrolDir = Math.random() * Math.PI * 2;
                        enemy.patrolTimer = 150;
                    }
                    mesh.position.x += Math.cos(enemy.patrolDir) * PATROL_SPEED * 0.4;
                    mesh.position.y += Math.sin(enemy.patrolDir) * PATROL_SPEED * 0.4;
                    mesh.rotation.z = Math.sin(Date.now() * 0.001) * 0.3;
                }
            }
            mesh.position.z = -mesh.position.y * 0.001;
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
for (let i = 0; i < SPIDER_COUNT; i++) createSpider();
animate();
