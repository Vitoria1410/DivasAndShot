import * as THREE from 'three';

// --- CONFIGURATION ---
const ENEMY_COUNT = 15;
const ENEMY_SPEED = 0.04;
const SPAWN_RADIUS = 30; // Closer spawn for top-down
const BULLET_SPEED = 0.5;
const PLAYER_SPEED = 0.15;

// --- STATE ---
let score = 0;
const enemies = [];
const bullets = [];
let gameStarted = false;
const mouse = new THREE.Vector2();
const worldMouse = new THREE.Vector3();

// --- COMPONENTS ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffb6c1); // Soft Pink Sky / Floor

// Orthographic Camera for 2D View
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 30;
const camera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    frustumSize / -2,
    0.1, 1000
);
camera.position.set(0, 0, 10); // Looking down at Z=0 plane

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.sortObjects = true;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Ground (Forest Floor)
const groundGeometry = new THREE.PlaneGeometry(300, 300);
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x9932CC }); // Dark Orchid
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.position.z = -1; // Background layer
scene.add(ground);

// --- PLAYER ---
const playerGroup = new THREE.Group();

// Player body (Scene Queen Circle)
const playerGeo = new THREE.CircleGeometry(1, 32);
const playerMat = new THREE.MeshBasicMaterial({ color: 0xff00ff }); // Hot Pink
const playerMesh = new THREE.Mesh(playerGeo, playerMat);
playerGroup.add(playerMesh);

// Player Gun (Neon Blue rectangle)
const gunGeo = new THREE.PlaneGeometry(0.4, 1.2);
const gunMat = new THREE.MeshBasicMaterial({ color: 0x00ffff }); // Neon Blue
const gunMesh = new THREE.Mesh(gunGeo, gunMat);
gunMesh.position.set(0, 1, 0); // Pointing Up (Y-axis)
playerGroup.add(gunMesh);

playerGroup.position.set(0, 0, 0);
scene.add(playerGroup);

// --- ASSET GENERATION (2D Trees) ---
function createTree(x, y) {
    const group = new THREE.Group();

    const trunkGeo = new THREE.PlaneGeometry(1, 2);
    const trunkMat = new THREE.MeshBasicMaterial({ color: 0x332211 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(0, -1, 0);
    group.add(trunk);

    const leavesGeo = new THREE.CircleGeometry(2, 6);
    const leavesMat = new THREE.MeshBasicMaterial({ color: 0xccff00 }); // Acid Green
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.set(0, 1, 0);
    group.add(leaves);

    group.position.set(x, y, 0);
    scene.add(group);
}

for (let i = 0; i < 60; i++) {
    const x = (Math.random() - 0.5) * 150;
    const y = (Math.random() - 0.5) * 150;
    if (Math.abs(x) > 10 || Math.abs(y) > 10) createTree(x, y);
}

// --- CUTE 2D FROGS (Fofinhos) ---
function createFrog() {
    const frog = new THREE.Group();

    const bodyGeo = new THREE.CircleGeometry(1, 16);
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x77ff77 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    frog.add(body);

    const eyeGeo = new THREE.CircleGeometry(0.3, 16);
    const eyeWhiteGeo = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilGeo = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const eyeL = new THREE.Mesh(eyeGeo, eyeWhiteGeo);
    eyeL.position.set(-0.5, 0.8, 0.1);

    const pupilL = new THREE.Mesh(new THREE.CircleGeometry(0.15, 8), pupilGeo);
    pupilL.position.set(0, 0.1, 0.1);
    eyeL.add(pupilL);
    frog.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, eyeWhiteGeo);
    eyeR.position.set(0.5, 0.8, 0.1);

    const pupilR = new THREE.Mesh(new THREE.CircleGeometry(0.15, 8), pupilGeo);
    pupilR.position.set(0, 0.1, 0.1);
    eyeR.add(pupilR);
    frog.add(eyeR);

    // Spawn around player
    const angle = Math.random() * Math.PI * 2;
    frog.position.x = playerGroup.position.x + Math.cos(angle) * SPAWN_RADIUS;
    frog.position.y = playerGroup.position.y + Math.sin(angle) * SPAWN_RADIUS;
    frog.position.z = 0;

    scene.add(frog);
    enemies.push(frog);
}

// --- PROJECTILE SYSTEM (2D Shots) ---
function shoot() {
    const bulletGeo = new THREE.CircleGeometry(0.2, 8);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0x00ffff }); // Neon Blue
    const bullet = new THREE.Mesh(bulletGeo, bulletMat);

    const gunWorldPos = new THREE.Vector3();
    gunMesh.getWorldPosition(gunWorldPos);
    bullet.position.set(gunWorldPos.x, gunWorldPos.y, 0);

    const direction = new THREE.Vector3(0, 1, 0);
    direction.applyQuaternion(playerGroup.quaternion);

    bullets.push({ mesh: bullet, dir: direction });
    scene.add(bullet);
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.mesh.position.addScaledVector(b.dir, BULLET_SPEED);

        if (b.mesh.position.distanceTo(playerGroup.position) > 50) {
            scene.remove(b.mesh);
            bullets.splice(i, 1);
            continue;
        }

        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const dist = b.mesh.position.distanceTo(enemy.position);
            if (dist < 1.5) {
                scene.remove(enemy);
                enemies.splice(j, 1);
                scene.remove(b.mesh);
                bullets.splice(i, 1);

                score += 100;
                document.getElementById('score-value').innerText = score.toString().padStart(6, '0');
                createFrog(); // Respawn
                break;
            }
        }
    }
}

// --- INTERACTION & CONTROLS ---
const startButton = document.getElementById('start-button');
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

// Mouse Tracking for Aiming
window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('mousedown', (e) => {
    // Only shoot if clicking outside the menu
    if (!gameStarted || e.target.closest('#game-menu')) return;
    shoot();

    gunMesh.position.y -= 0.3;
    setTimeout(() => { gunMesh.position.y += 0.3; }, 50);
});

const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Escape' && gameStarted) {
        menu.style.display = 'flex';
        menu.style.opacity = '1';
        hud.style.display = 'none';
        gameStarted = false;
    }
});
window.addEventListener('keyup', (e) => keys[e.code] = false);

function updateMovement() {
    if (!gameStarted) return;

    let moveX = 0;
    let moveY = 0;

    if (keys['KeyW']) moveY += 1;
    if (keys['KeyS']) moveY -= 1;
    if (keys['KeyA']) moveX -= 1;
    if (keys['KeyD']) moveX += 1;

    if (moveX !== 0 || moveY !== 0) {
        const length = Math.sqrt(moveX * moveX + moveY * moveY);
        moveX /= length;
        moveY /= length;

        playerGroup.position.x += moveX * PLAYER_SPEED;
        playerGroup.position.y += moveY * PLAYER_SPEED;

        // Camera follows player smoothly
        camera.position.x += (playerGroup.position.x - camera.position.x) * 0.1;
        camera.position.y += (playerGroup.position.y - camera.position.y) * 0.1;
    }

    worldMouse.set(mouse.x, mouse.y, 0.5);
    worldMouse.unproject(camera);

    const angle = Math.atan2(worldMouse.y - playerGroup.position.y, worldMouse.x - playerGroup.position.x);
    playerGroup.rotation.z = angle - Math.PI / 2;
}

// --- GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);

    if (gameStarted) {
        updateMovement();
        updateBullets();

        enemies.forEach(frog => {
            const angleToPlayer = Math.atan2(playerGroup.position.y - frog.position.y, playerGroup.position.x - frog.position.x);

            frog.position.x += Math.cos(angleToPlayer) * ENEMY_SPEED;
            frog.position.y += Math.sin(angleToPlayer) * ENEMY_SPEED;

            frog.rotation.z = angleToPlayer - Math.PI / 2;
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
