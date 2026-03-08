import * as THREE from 'three';

// --- CONFIGURATION ---
const ENEMY_COUNT = 15;
let ENEMY_SPEED = 0.04;
let PATROL_SPEED = 0.01;
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
let extraDamage = 0;

// Novos inimigos: Aranha
const SPIDER_COUNT = 5;
const WEB_SPEED = 0.25;
const WEB_DAMAGE = 15;
const SPIDER_DETECTION_RADIUS = 25;
const SPIDER_FIRE_RATE = 120; // frames entre tiros

// Novos inimigos: Pop Diva (Shiny Butterfly)
const POP_DIVA_COUNT = 3;
const POP_DIVA_SPEED = 0.08;
const POP_DIVA_HP = 20;
const POP_DIVA_DETECTION_RADIUS = 30;

// --- STATE ---
let score = 0;
let divaCoins = 0;
let playerHP = PLAYER_MAX_HP;
let damageCooldown = 0;
let isGameOver = false;
let inventoryOpen = false;
let shopOpen = false;
let stylePoints = 0;
let styleRank = 'D';
const STYLE_MAX = 5000;
const STYLE_DECAY = 0.5; // Reduzido para ficar mais fixo
const RANK_THRESHOLDS = { 'S': 4000, 'A': 2500, 'B': 1000, 'C': 300, 'D': 0 };
const RANK_MULTIPLIERS = { 'S': 2.5, 'A': 1.8, 'B': 1.4, 'C': 1.2, 'D': 1.0 };

// Neon Chips State
let hasTripleShot = false;
let hasPierce = false;

// Round State
let currentRound = 1;
let enemiesKilledInRound = 0;
let roundTarget = 10;
let isTransitioningRound = false;

// Animation State
let playerState = 'idle'; // 'idle' or 'walk'
let playerDirection = 'front'; // 'front', 'back', 'side'
let playerFrames = 1; // As imagens são frames únicos verticais (aprox 170x430)
const ANIM_SPEED = 0.15;

const treeColliders = [];
const enemies = []; // { mesh, state, patrolDir, patrolTimer, type }
const bullets = [];
const webs = [];
const ghosts = []; // { mesh, timer }
const powerups = []; // { mesh, type, timer }
let gameStarted = false;

// Juicy Feedback State
let shakeIntensity = 0;
let shakeTimer = 0;

// Overclock State
let overclockTimer = 0;
const OVERCLOCK_DURATION = 600; // 10s em 60fps

// Dash State
let canDash = true;
let isDashing = false;
let dashCooldown = 0;
let dashGhostTimer = 0;
const DASH_COOLDOWN_MAX = 60;
const DASH_SPEED = 0.5;
const DASH_DURATION = 15;

const mouse = new THREE.Vector2();
const worldMouse = new THREE.Vector3();
let aimDir = new THREE.Vector3(0, 1, 0);

// Weapon state
const HOTBAR = ['SWORD', 'GUN', null, null, null, null];
let currentWeaponIndex = 0; // 0 to 5
let canSlash = true;
let swordMesh;

const keys = {};
let lastDirectionKey = 'KeyS'; // Para rastrear a última pose horizontal
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyW' || e.code === 'KeyS') lastDirectionKey = e.code;

    // Trigger Dash
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        startDash();
    }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

let isAttacking = false;
let attackTimer = null;

// --- SOUND SYSTEM (Procedural Y2K) ---
class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playShoot() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playHit() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(10, this.ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    playDeath() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1, this.ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    }

    playBuy() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.setValueAtTime(800, this.ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }
}
const sounds = new SoundManager();

let lastShootTime = 0;
const FIRE_RATE_BASE = 250; // ms

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

// Frog Textures
const frogIdleTex = textureLoader.load('frogidle.png');
const frogAttackTex = textureLoader.load('frog.png');
[frogIdleTex, frogAttackTex].forEach(t => t.magFilter = t.minFilter = THREE.NearestFilter);

// Pop Diva GIF Texture
const popDivaTex = textureLoader.load('_(=^‥^)ノ☆.gif');
popDivaTex.magFilter = popDivaTex.minFilter = THREE.NearestFilter;

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
    ground.material.color.setHex(0xffffff); // Restaura brilho total
    ground.material.needsUpdate = true;

    // Força a renderização do material novo trocando a textura completamente em tempo de execução
    ground.material = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff });
}

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_LIMIT * 2 + 10, MAP_LIMIT * 2 + 10),
    // Cor cinza escura para baixar o brilho/contraste do mapa
    new THREE.MeshBasicMaterial({ map: createForestTexture(), color: 0xffffff })
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

        // Colisor esférico na base do tronco
        treeColliders.push({ x: x, y: y, radius: size * 0.08 });
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
    group.position.set(x, y, -y * 0.01);
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

// --- PEDRAS E GRAMAS ---
const envElements = [
    { file: 'pedra1.png', count: 60, size: 2.0 },
    { file: 'pedra2.png', count: 60, size: 2.0 },
    { file: 'grama1.png', count: 120, size: 1.5 },
    { file: 'grama2.png', count: 120, size: 1.5 }
];

envElements.forEach(item => {
    textureLoader.load(item.file, (tex) => {
        for (let i = 0; i < item.count; i++) {
            const rx = (Math.random() - 0.5) * 240;
            const ry = (Math.random() - 0.5) * 240;
            if (Math.abs(rx) > 15 || Math.abs(ry) > 15) { // Longe do spawn
                const rs = item.size + (Math.random() * 0.5);
                const mesh = new THREE.Mesh(
                    new THREE.PlaneGeometry(rs * 1.2, rs),
                    new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, depthWrite: false })
                );
                mesh.position.set(rx, ry, -ry * 0.01 + 0.001);
                scene.add(mesh);
            }
        }
    });
});

// --- PLAYER ---
const playerGroup = new THREE.Group();

const playerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, alphaTest: 0.1 });
const playerVisual = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 5.3), playerMat);
playerVisual.position.set(0, 1.8, 0.1);
playerGroup.add(playerVisual);

const playerTextures = {
    'front': textureLoader.load('walkfront.png.png'),
    'back': textureLoader.load('backwalk.png.png'),
    'side': textureLoader.load('sidewalk.png.png'),
    'aim': textureLoader.load('gunaim.png'),
    'attack': textureLoader.load('attack.png'),
    'idle': textureLoader.load('idle.png'),
    'idleback': textureLoader.load('idleback.png')
};

// Geometrias dinâmicas para ajustar corretamente a distorção de cada PNG
const geometries = {
    'front': new THREE.PlaneGeometry(2.2, 5.3),
    'back': new THREE.PlaneGeometry(2.2, 5.3),
    'side': new THREE.PlaneGeometry(2.1, 5.3),
    'aim': new THREE.PlaneGeometry(3.2, 5.3),
    'attack': new THREE.PlaneGeometry(6.2, 5.3),
    'idle': new THREE.PlaneGeometry(7.95, 5.3),
    'idleback': new THREE.PlaneGeometry(2.33, 5.3)
};

Object.values(playerTextures).forEach(tex => {
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.repeat.set(1 / playerFrames, 1);
});

playerMat.map = playerTextures['front'];
playerMat.needsUpdate = true;

// Grupo da Mira invisível (só para lógica do tiro)
const aimGroup = new THREE.Group();
const gunMesh = new THREE.Mesh(); // Forma e material removidos a pedido do usuário
gunMesh.position.set(0, 1.1, 0.1);
aimGroup.add(gunMesh);

// Espada invisível 
swordMesh = new THREE.Group();
aimGroup.add(swordMesh);

playerGroup.add(aimGroup);

// HP Bar
const HP_BAR_WIDTH = 2.4;
const hpBarBg = new THREE.Mesh(
    new THREE.PlaneGeometry(HP_BAR_WIDTH + 0.1, 0.38),
    new THREE.MeshBasicMaterial({ color: 0x111111 })
);
hpBarBg.position.set(0, 4.2, 0.5); // Movido para o alto da cabeça
playerGroup.add(hpBarBg);

const hpMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
const hpBar = new THREE.Mesh(new THREE.PlaneGeometry(HP_BAR_WIDTH, 0.28), hpMat);
hpBar.position.set(0, 4.2, 0.51);
playerGroup.add(hpBar);

playerGroup.position.set(0, 0, 0);
scene.add(playerGroup);

function updateHPBar() {
    const ratio = Math.max(0, playerHP / PLAYER_MAX_HP);
    hpBar.scale.x = ratio;
    hpBar.position.x = -(HP_BAR_WIDTH * (1 - ratio)) / 2;
    hpMat.color.set(playerHP > 50 ? 0xff00ff : playerHP > 25 ? 0xffff00 :
        (Math.floor(Date.now() / 200) % 2 === 0 ? 0xff2200 : 0xff0000));

    const showHP = playerHP < PLAYER_MAX_HP;
    hpBar.visible = showHP;
    hpBarBg.visible = showHP;
}

function updateHUD() {
    document.getElementById('score-value').innerText = score.toString().padStart(6, '0');
    document.getElementById('coins-value').innerText = divaCoins.toString().padStart(3, '0');
    document.getElementById('shop-coins-value').innerText = divaCoins;
}

// --- ENEMIES ---
function createFrog() {
    const frog = new THREE.Group();

    const frogMat = new THREE.MeshBasicMaterial({ map: frogIdleTex, transparent: true, alphaTest: 0.1 });
    const frogVisual = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), frogMat);
    frogVisual.position.y = 1.0;
    frog.add(frogVisual);

    // Barra de Vida do Sapo (reposicionada acima do sprite)
    const enemyHpBg = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.15),
        new THREE.MeshBasicMaterial({ color: 0x111111 })
    );
    enemyHpBg.position.set(0, 2.4, 0.2);
    frog.add(enemyHpBg);

    const enemyHpBar = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.1),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    enemyHpBar.position.set(0, 2.4, 0.21);
    frog.add(enemyHpBar);

    const angle = Math.random() * Math.PI * 2;
    const fx = playerGroup.position.x + Math.cos(angle) * SPAWN_RADIUS;
    const fy = playerGroup.position.y + Math.sin(angle) * SPAWN_RADIUS;
    frog.position.set(fx, fy, -fy * 0.001); // Depth sorting

    scene.add(frog);
    enemies.push({
        mesh: frog,
        visual: frogVisual,
        mat: frogMat,
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

function createPopDiva() {
    const diva = new THREE.Group();
    const divaMat = new THREE.MeshBasicMaterial({ map: popDivaTex, transparent: true, alphaTest: 0.1 });
    const divaVisual = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 3.5), divaMat);
    divaVisual.position.y = 1.0;
    diva.add(divaVisual);

    // Aura Neon
    const aura = new THREE.Mesh(
        new THREE.CircleGeometry(1.2, 16),
        new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 })
    );
    diva.add(aura);

    // HP Bar
    const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.1), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    hpBg.position.set(0, 1.3, 0.2);
    diva.add(hpBg);
    const hpBar = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.06), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
    hpBar.position.set(0, 1.3, 0.21);
    diva.add(hpBar);

    const angle = Math.random() * Math.PI * 2;
    const fx = playerGroup.position.x + Math.cos(angle) * SPAWN_RADIUS;
    const fy = playerGroup.position.y + Math.sin(angle) * SPAWN_RADIUS;
    diva.position.set(fx, fy, -fy * 0.001);

    scene.add(diva);
    enemies.push({
        mesh: diva,
        hpBar: hpBar,
        hp: POP_DIVA_HP,
        type: 'pop',
        state: 'patrol',
        patrolDir: Math.random() * Math.PI * 2,
        patrolTimer: Math.floor(Math.random() * 60) + 20
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
function equipSlot(index) {
    currentWeaponIndex = Math.max(0, Math.min(index, 5));

    // Atualiza Interface (Hotbar)
    for (let i = 0; i < 6; i++) {
        const slotEl = document.getElementById(`slot-${i + 1}`);
        if (slotEl) {
            if (i === currentWeaponIndex) slotEl.classList.add('active');
            else slotEl.classList.remove('active');
        }
    }
}

function updateEnemyHP(enemy, damage) {
    enemy.hp -= (damage + extraDamage);
    const maxHp = enemy.type === 'frog' ? ENEMY_MAX_HP : (enemy.type === 'spider' ? ENEMY_MAX_HP * 0.8 : POP_DIVA_HP);
    const ratio = Math.max(0, enemy.hp / maxHp);
    enemy.hpBar.scale.x = ratio;
    enemy.hpBar.position.x = -((enemy.type === 'pop' ? 1.2 : 1.6) * (1 - ratio)) / 2;
    enemy.hpBar.material.color.set(ratio > 0.5 ? 0x00ff00 : ratio > 0.25 ? 0xffff00 : 0xff0000);

    if (enemy.hp > 0) sounds.playHit();
    return enemy.hp <= 0;
}

function onEnemyKilled(enemy) {
    sounds.playDeath();
    scene.remove(enemy.mesh);
    const type = enemy.type;

    let reward = 100;
    let coins = 10;
    let styleBonus = 150;

    const multiplier = RANK_MULTIPLIERS[styleRank] || 1.0;

    if (type === 'frog') {
        reward = 100; coins = Math.floor(15 * multiplier); styleBonus = 150; createFrog();
    } else if (type === 'spider') {
        reward = 150; coins = Math.floor(25 * multiplier); styleBonus = 250; createSpider();
    } else if (type === 'pop') {
        reward = 300; coins = Math.floor(50 * multiplier); styleBonus = 800; createPopDiva();
    }

    score += reward;
    divaCoins += coins;
    enemiesKilledInRound++;

    if (!isTransitioningRound && enemiesKilledInRound >= roundTarget) {
        nextRound();
    } else if (!isTransitioningRound) {
        updateRoundFeed(`ROUND ${currentRound}: ${enemiesKilledInRound}/${roundTarget} MORTOS`);
    }

    addStyle(styleBonus);
    updateHUD();

    // Spawn Overclock 10% chance
    if (Math.random() < 0.15) {
        spawnOverclock(enemy.mesh.position);
    }
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
                if (updateEnemyHP(enemies[j], SWORD_DAMAGE)) {
                    onEnemyKilled(enemies[j]);
                    enemies.splice(j, 1);
                }
            }
        }

        setTimeout(() => {
            swordMesh.rotation.z = 0;
            canSlash = true;
        }, 150);
    }, 50);
}

function triggerAttackAnimation() {
    isAttacking = true;
    if (attackTimer) clearTimeout(attackTimer);
    attackTimer = setTimeout(() => {
        isAttacking = false;
    }, 300); // Mostra a imagem de ataque por 300ms
}

// --- TIRO ---
function shoot() {
    triggerAttackAnimation();

    const currentWeapon = HOTBAR[currentWeaponIndex];
    if (currentWeapon === 'SWORD') {
        slash();
        return;
    } else if (currentWeapon === 'GUN') {
        const now = Date.now();
        const fireRate = overclockTimer > 0 ? FIRE_RATE_BASE / 2 : FIRE_RATE_BASE;

        if (now - lastShootTime < fireRate) return;
        lastShootTime = now;

        sounds.playShoot();
        triggerShake(0.15, 5); // Pequeno shake no tiro

        const bulletColor = overclockTimer > 0 ? 0xff00ff : 0x00ffff;
        const bulletScale = overclockTimer > 0 ? 1.5 : 1.0;

        const count = hasTripleShot ? 3 : 1;
        for (let i = 0; i < count; i++) {
            const bullet = new THREE.Mesh(
                new THREE.CircleGeometry(0.18 * bulletScale, 8),
                new THREE.MeshBasicMaterial({ color: bulletColor })
            );
            bullet.position.set(playerGroup.position.x, playerGroup.position.y + 1.2, 1.0);

            let bulletDir = aimDir.clone();
            if (hasTripleShot) {
                // Espalha as balas: -0.2, 0, 0.2 radianos de offset
                const angle = Math.atan2(aimDir.y, aimDir.x);
                const offset = (i - 1) * 0.25;
                bulletDir.x = Math.cos(angle + offset);
                bulletDir.y = Math.sin(angle + offset);
            }

            bullets.push({ mesh: bullet, dir: bulletDir });
            scene.add(bullet);
        }

        // Neon Sparks
        createSparks(new THREE.Vector3(playerGroup.position.x, playerGroup.position.y + 1.2, 1.0));

        // Cooldown/Recuo visual da arma
        gunMesh.position.y -= 0.3;
        setTimeout(() => { gunMesh.position.y += 0.3; }, 60);
    }
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];

        if (b.isSpark) {
            b.mesh.position.addScaledVector(b.dir, b.speed);
            b.timer--;
            b.mesh.material.opacity = b.timer / 40;
            if (b.timer <= 0) {
                scene.remove(b.mesh); bullets.splice(i, 1);
            }
            continue;
        }

        b.mesh.position.addScaledVector(b.dir, BULLET_SPEED);

        // Ricochet Logic Removida

        if (b.mesh.position.distanceTo(playerGroup.position) > 28) {
            scene.remove(b.mesh); bullets.splice(i, 1); continue;
        }

        for (let j = enemies.length - 1; j >= 0; j--) {
            if (b.mesh.position.distanceTo(enemies[j].mesh.position) < 1.5) {
                const isDead = updateEnemyHP(enemies[j], GUN_DAMAGE);

                // Lógica de Neon Chips: Pierce
                if (!hasPierce) {
                    scene.remove(b.mesh);
                    bullets.splice(i, 1);
                } else {
                    // Pierce: Bullet continues but maybe reduce damage? or just keep going
                }

                if (isDead) {
                    onEnemyKilled(enemies[j]);
                    enemies.splice(j, 1);
                }
                break;
            }
        }
    }
}

function addStyle(points) {
    stylePoints = Math.min(STYLE_MAX, stylePoints + points);
    updateStyleUI();
}

function updateStyle() {
    if (stylePoints > 0) {
        stylePoints = Math.max(0, stylePoints - STYLE_DECAY);
        updateStyleUI();
    }
}

function updateStyleUI() {
    let newRank = 'D';
    if (stylePoints >= RANK_THRESHOLDS['S']) newRank = 'S';
    else if (stylePoints >= RANK_THRESHOLDS['A']) newRank = 'A';
    else if (stylePoints >= RANK_THRESHOLDS['B']) newRank = 'B';
    else if (stylePoints >= RANK_THRESHOLDS['C']) newRank = 'C';

    const rankEl = document.querySelector('.style-rank');
    if (newRank !== styleRank) {
        styleRank = newRank;
        rankEl.innerText = styleRank;
        rankEl.className = 'style-rank rank-' + styleRank;
        rankEl.style.animation = 'none';
        rankEl.offsetHeight; // trigger reflow
        rankEl.style.animation = 'rankUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

        // Efeito visual Rank S
        if (styleRank === 'S') document.body.classList.add('rank-S-active');
        else document.body.classList.remove('rank-S-active');
    }

    const fill = document.getElementById('style-bar-fill');
    fill.style.width = (stylePoints / STYLE_MAX * 100) + '%';
}

function updateWebs() {
    for (let i = webs.length - 1; i >= 0; i--) {
        const w = webs[i];
        w.mesh.position.addScaledVector(w.dir, WEB_SPEED);

        // Colisão da teia com o Player
        if (w.mesh.position.distanceTo(playerGroup.position) < 1.2) {
            if (damageCooldown === 0 && !isDashing) { // Imunidade no dash
                playerHP -= WEB_DAMAGE;
                damageCooldown = DAMAGE_COOLDOWN_FRAMES;
                triggerShake(0.4, 20); // Shake no dano

                // Style Penalty: Resets style or drops points significantly
                stylePoints = Math.max(0, stylePoints - 1500);
                updateStyleUI();

                if (playerHP <= 0) { playerHP = 0; triggerGameOver(); }
            }
            scene.remove(w.mesh); webs.splice(i, 1);
            continue;
        }

        if (w.mesh.position.distanceTo(playerGroup.position) > 28) {
            scene.remove(w.mesh); webs.splice(i, 1);
        }
    }
}

// --- JUICY FEEDBACK & PARTÍCULAS ---
function triggerShake(intensity, duration = 15) {
    shakeIntensity = intensity;
    shakeTimer = duration;
}

function createSparks(pos, count = 8) {
    for (let i = 0; i < count; i++) {
        const spark = new THREE.Mesh(
            new THREE.PlaneGeometry(0.12, 0.45),
            new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 1 })
        );
        spark.position.copy(pos);
        spark.position.z = 1.0;

        const angle = Math.random() * Math.PI * 2;
        const force = 0.1 + Math.random() * 0.2;
        const dir = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);

        bullets.push({ // Reutilizando a lógica de bullets pra partícula simples
            mesh: spark,
            dir: dir,
            speed: force,
            isSpark: true,
            timer: 20 + Math.random() * 20
        });
        scene.add(spark);
    }
}

// --- DASH & GHOST EFFECT ---
function startDash() {
    if (!canDash || isDashing || !gameStarted) return;

    canDash = false;
    isDashing = true;
    dashCooldown = DASH_COOLDOWN_MAX;

    setTimeout(() => {
        isDashing = false;
    }, DASH_DURATION * 16); // Estimado pra frames
}

function spawnGhost() {
    const ghostGeo = playerVisual.geometry.clone();
    const ghostMat = playerMat.clone();
    ghostMat.transparent = true;
    ghostMat.opacity = 0.4;
    ghostMat.color.set(0xff00ff); // Pink Neon

    if (ghostMat.map) {
        ghostMat.map = ghostMat.map.clone();
        ghostMat.map.needsUpdate = true;
    }
    const ghost = new THREE.Mesh(ghostGeo, ghostMat);
    ghost.position.copy(playerGroup.position);
    ghost.position.y += 1.8; // Align with playerVisual
    ghost.scale.copy(playerVisual.scale);
    ghost.rotation.copy(playerGroup.rotation);

    scene.add(ghost);
    ghosts.push({ mesh: ghost, timer: 15 });
}

// --- OVERCLOCK POWERUP ---
function spawnOverclock(pos) {
    const group = new THREE.Group();
    const icon = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.6, 0),
        new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true })
    );
    group.add(icon);

    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.8, 1.0, 32),
        new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    group.add(ring);

    group.position.copy(pos);
    group.position.z = 0.5;
    scene.add(group);

    powerups.push({ mesh: group, type: 'OVERCLOCK' });
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
    stylePoints = 0;
    updateStyleUI();
    document.getElementById('score-value').innerText = '000000';
    document.getElementById('inventory').style.display = 'none';
    updateHPBar();
    playerGroup.position.set(0, 0, 0);
    camera.position.set(0, 0, 10);
    for (let i = 0; i < ENEMY_COUNT; i++) createFrog();
    for (let i = 0; i < SPIDER_COUNT; i++) createSpider();
    for (let i = 0; i < POP_DIVA_COUNT; i++) createPopDiva();
    updateHUD();
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
    const transitionScreen = document.getElementById('transition-screen');

    menu.style.opacity = '0';
    setTimeout(() => {
        menu.style.display = 'none';

        // Inicia Transição do GIF
        transitionScreen.style.display = 'flex';
        setTimeout(() => { transitionScreen.style.opacity = '1'; }, 50);

        // Duração da animação do GIF (ex: 3 segundos)
        setTimeout(() => {
            transitionScreen.style.opacity = '0';
            setTimeout(() => {
                transitionScreen.style.display = 'none';
                document.getElementById('hud').style.display = 'flex';
                gameStarted = true;
                equipSlot(0);
                if (sounds.ctx.state === 'suspended') sounds.ctx.resume();
            }, 1000); // Espera o Fade-Out
        }, 3000); // Tempo do GIF
    }, 500);
});

// --- SHOP LOGIC ---
const shop = document.getElementById('shop');
document.getElementById('shop-open-button').addEventListener('click', () => {
    shop.style.display = 'flex';
    document.getElementById('shop-coins-value').innerText = divaCoins;
    shopOpen = true; // Update state
});

document.getElementById('shop-close-button').addEventListener('click', () => {
    shop.style.display = 'none';
    shopOpen = false; // Update state
});

document.getElementById('buy-hp').querySelector('.buy-btn').addEventListener('click', () => {
    if (divaCoins >= 200) {
        divaCoins -= 200;
        playerHP = Math.min(PLAYER_MAX_HP, playerHP + 30);
        updateHPBar();
        updateHUD();
        sounds.playBuy();
    }
});

document.getElementById('buy-dmg').querySelector('.buy-btn').addEventListener('click', () => {
    if (divaCoins >= 1000) {
        divaCoins -= 1000;
        extraDamage += 10;
        updateHUD();
        sounds.playBuy();
    }
});

document.getElementById('buy-speed').querySelector('.buy-btn').addEventListener('click', () => {
    if (divaCoins >= 500) {
        divaCoins -= 500;
        // temporário seria mais complexo, vamos fazer permanente pequeno
        // ou aumentar a velocidade do player
        // window.PLAYER_SPEED += 0.02; // não funciona assim pq é const
        // Mas podemos mudar a lógica de movimento
        sounds.playBuy();
        updateHUD();
    }
});

document.getElementById('chip-tripleshot').querySelector('.buy-btn').addEventListener('click', () => {
    if (divaCoins >= 1800 && !hasTripleShot) {
        divaCoins -= 1800;
        hasTripleShot = true;
        updateHUD();
        sounds.playBuy();
        document.getElementById('chip-tripleshot').style.opacity = '0.5';
        document.getElementById('chip-tripleshot').querySelector('.buy-btn').innerText = 'OWNED';
    }
});

document.getElementById('chip-pierce').querySelector('.buy-btn').addEventListener('click', () => {
    if (divaCoins >= 2000 && !hasPierce) {
        divaCoins -= 2000;
        hasPierce = true;
        updateHUD();
        sounds.playBuy();
        document.getElementById('chip-pierce').style.opacity = '0.5';
        document.getElementById('chip-pierce').querySelector('.buy-btn').innerText = 'OWNED';
    }
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
    if (e.deltaY > 0) {
        equipSlot((currentWeaponIndex + 1) % 6);
    } else {
        equipSlot((currentWeaponIndex - 1 + 6) % 6);
    }
});

window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && gameStarted && !inventoryOpen) {
        document.getElementById('game-menu').style.display = 'flex';
        document.getElementById('game-menu').style.opacity = '1';
        document.getElementById('hud').style.display = 'none';
        gameStarted = false;
        shopOpen = false;
        inventoryOpen = false;
    }
    if ((e.code === 'KeyI' || e.code === 'Tab') && gameStarted && !shopOpen) {
        e.preventDefault();
        toggleInventory();
    }

    // Suporte aos numerais 1 a 6 do teclado para Seleção de Itens da Hotbar
    if (e.code >= 'Digit1' && e.code <= 'Digit6' && gameStarted) {
        const slot = parseInt(e.code.replace('Digit', '')) - 1;
        equipSlot(slot);
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
        const speed = isDashing ? DASH_SPEED : PLAYER_SPEED;
        nextX += (mx / len) * speed;
        nextY += (my / len) * speed;

        playerState = 'walk';

        if (isDashing) {
            dashGhostTimer--;
            if (dashGhostTimer <= 0) {
                spawnGhost();
                dashGhostTimer = 3;
            }
        }

        // Prioridade lateral na animação se houver movimento Horizontal
        if (mx !== 0) {
            playerDirection = 'side';
            // O PNG nativo olha para esquerda: scale 1 = Esquerda, scale -1 = Direita.
            playerVisual.scale.x = mx < 0 ? 1 : -1;
        } else if (my > 0) {
            playerDirection = 'back';
            playerVisual.scale.x = 1; // Reseta espelhamento
        } else {
            playerDirection = 'front';
            playerVisual.scale.x = 1; // Reseta espelhamento
        }

        playerVisual.position.x = playerVisual.scale.x === 1 ? -0.3 : 0.3;
    } else {
        playerState = 'idle';
    }

    let currentSpriteName = 'front';
    const weapon = HOTBAR[currentWeaponIndex];

    if (playerState === 'idle') {
        currentSpriteName = lastDirectionKey === 'KeyW' ? 'idleback' : 'idle';
    } else {
        currentSpriteName = playerDirection;
    }

    if (isAttacking && weapon === 'SWORD') {
        currentSpriteName = 'attack';
    } else if (isAttacking && weapon === 'GUN') {
        currentSpriteName = 'aim';
    }

    // Troca de Textura e Geometria apropriada para não esticar
    if (playerMat.map !== playerTextures[currentSpriteName]) {
        playerMat.map = playerTextures[currentSpriteName];
        if (geometries[currentSpriteName]) {
            playerVisual.geometry = geometries[currentSpriteName];
        }
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
            nextX += (dx / dist) * overlap * 1.5;
            nextY += (dy / dist) * overlap * 1.5;
        }
    }

    // Limita o jogador dentro do mapa
    playerGroup.position.x = THREE.MathUtils.clamp(nextX, -MAP_LIMIT, MAP_LIMIT);
    playerGroup.position.y = THREE.MathUtils.clamp(nextY, -MAP_LIMIT, MAP_LIMIT);

    // Depth Sorting pelo eixo Y da personagem
    playerGroup.position.z = -playerGroup.position.y * 0.01 + 0.005;

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

        const weapon = HOTBAR[currentWeaponIndex];
        if (weapon && isAttacking) {
            if (weapon === 'GUN') {
                // gunaim.png mira para a direita nativamente
                playerVisual.scale.x = dx < 0 ? -1 : 1;
                playerVisual.position.x = dx < 0 ? -0.4 : 0.4;
            } else {
                // attack.png mira para a esquerda nativamente
                playerVisual.scale.x = dx < 0 ? 1 : -1;
                playerVisual.position.x = playerVisual.scale.x === 1 ? -0.6 : 0.6;
            }
        }
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
        updateStyle(); // Decaimento de estilo

        // Handle Timers
        if (dashCooldown > 0) dashCooldown--;
        if (dashCooldown === 0) canDash = true;

        if (overclockTimer > 0) {
            overclockTimer--;
        }

        if (damageCooldown > 0) damageCooldown--;
        playerVisual.visible = damageCooldown === 0 || Math.floor(damageCooldown / 6) % 2 === 0;

        // Update Shake
        if (shakeTimer > 0) {
            shakeTimer--;
            const sx = (Math.random() - 0.5) * shakeIntensity;
            const sy = (Math.random() - 0.5) * shakeIntensity;
            camera.position.x += sx;
            camera.position.y += sy;
            shakeIntensity *= 0.9;
        }

        // Fading Ghosts
        for (let i = ghosts.length - 1; i >= 0; i--) {
            ghosts[i].timer--;
            ghosts[i].mesh.material.opacity = ghosts[i].timer / 15;
            if (ghosts[i].timer <= 0) {
                scene.remove(ghosts[i].mesh); ghosts.splice(i, 1);
            }
        }

        // Powerups Animation & Collision
        for (let i = powerups.length - 1; i >= 0; i--) {
            const p = powerups[i];
            p.mesh.rotation.y += 0.05;
            p.mesh.position.y += Math.sin(Date.now() * 0.005) * 0.005;

            if (p.mesh.position.distanceTo(playerGroup.position) < 2.0) {
                if (p.type === 'OVERCLOCK') {
                    overclockTimer = OVERCLOCK_DURATION;
                    sounds.playBuy();
                }
                scene.remove(p.mesh); powerups.splice(i, 1);
            }
        }
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

                    // Flip sprite baseado na direção do player
                    enemy.visual.scale.x = dx > 0 ? -1 : 1;
                    mesh.rotation.z = 0; // Mantém estático

                    // Altera para PNG de ataque ao estar em Chase
                    if (enemy.mat.map !== frogAttackTex) enemy.mat.map = frogAttackTex;

                    if (dist < 1.5 && damageCooldown === 0 && !isDashing) {
                        playerHP -= DAMAGE_PER_HIT;
                        damageCooldown = DAMAGE_COOLDOWN_FRAMES;
                        stylePoints = Math.max(0, stylePoints - 1000); // Penalidade no estilo
                        updateStyleUI();
                        triggerShake(0.5, 25);
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

                    // Flip sprite baseado na direção da patrulha
                    enemy.visual.scale.x = Math.cos(enemy.patrolDir) > 0 ? -1 : 1;
                    mesh.rotation.z = 0;

                    // Altera para PNG Idle ao patrulhar
                    if (enemy.mat.map !== frogIdleTex) enemy.mat.map = frogIdleTex;
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
            } else if (enemy.type === 'pop') {
                const time = Date.now() * 0.005;
                if (dist < POP_DIVA_DETECTION_RADIUS) {
                    const angle = Math.atan2(dy, dx);
                    // Movimento em Zig-Zag
                    mesh.position.x += Math.cos(angle) * POP_DIVA_SPEED + Math.cos(time) * 0.05;
                    mesh.position.y += Math.sin(angle) * POP_DIVA_SPEED + Math.sin(time) * 0.05;
                    mesh.rotation.z = time * 0.5;

                    if (dist < 1.0 && damageCooldown === 0) {
                        playerHP -= 20;
                        damageCooldown = DAMAGE_COOLDOWN_FRAMES;
                        if (sounds) sounds.playDeath(); // Som de dano
                        if (playerHP <= 0) { playerHP = 0; triggerGameOver(); }
                    }
                } else {
                    mesh.position.x += Math.cos(time) * 0.02;
                    mesh.position.y += Math.sin(time) * 0.02;
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
// Difficulty scaling was here but moving to rounds logic

function updateRoundFeed(msg) {
    document.getElementById('round-feed').innerText = ">> " + msg;
}

function announceRound(round) {
    const el = document.getElementById('round-announcer');
    el.innerText = "ROUND " + round;
    el.style.display = 'block';
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'announceScale 1.5s cubic-bezier(0.19, 1, 0.22, 1) forwards';
}

function nextRound() {
    isTransitioningRound = true;
    currentRound++;
    enemiesKilledInRound = 0;
    roundTarget = 10 + (currentRound * 5);

    let msg = "";
    if (currentRound === 2) msg = "ARANHAS DETECTADAS!";
    else if (currentRound === 3) msg = "NÍVEL POP DIVA ATIVADO!";
    else msg = "DIFICULDADE AUMENTADA!";

    updateRoundFeed(`ROUND ${currentRound} INICIANDO EM 5 SEC... ${msg}`);

    setTimeout(() => {
        announceRound(currentRound);
        isTransitioningRound = false;
        spawnInitialRoundEnemies();
    }, 5000);
}

function spawnInitialRoundEnemies() {
    // Limpar o que sobrou (opcional, ou apenas adicionar)
    if (currentRound === 1) {
        for (let i = 0; i < 18; i++) createFrog(); // Mais sapos no início
    } else if (currentRound === 2) {
        for (let i = 0; i < 10; i++) createFrog();
        for (let i = 0; i < 6; i++) createSpider();
    } else {
        for (let i = 0; i < 8; i++) createFrog();
        for (let i = 0; i < 6; i++) createSpider();
        for (let i = 0; i < 3; i++) createPopDiva();
    }
}

// Init
spawnInitialRoundEnemies();
updateRoundFeed("ROUND 1: ELIMINE 10 SAPOS");
animate();
