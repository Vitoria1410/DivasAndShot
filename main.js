import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- CONFIGURATION ---
const ENEMY_COUNT = 15;
const ENEMY_SPEED = 0.04;
const SPAWN_RADIUS = 60;
const BULLET_SPEED = 1.5;

// --- STATE ---
let score = 0;
const enemies = [];
const bullets = [];
let gameStarted = false;

// --- COMPONENTS ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffb6c1); // Soft Pink Sky
scene.fog = new THREE.Fog(0xffb6c1, 20, 150);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('canvas-container').appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.position.set(10, 20, 10);
scene.add(sunLight);

// Ground (Forest Floor)
const groundGeometry = new THREE.PlaneGeometry(300, 300);
const groundMaterial = new THREE.MeshPhongMaterial({
    color: 0x224422, // Dark Moss Green
    side: THREE.DoubleSide
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// --- CASTLE IN THE BACKGROUND ---
function createCastle() {
    const castleGroup = new THREE.Group();

    const wallGeo = new THREE.BoxGeometry(20, 15, 5);
    const wallMat = new THREE.MeshPhongMaterial({ color: 0x444466 });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    castleGroup.add(wall);

    // Towers
    const towerGeo = new THREE.CylinderGeometry(3, 3, 25, 6);
    const tower1 = new THREE.Mesh(towerGeo, wallMat);
    tower1.position.set(-10, 5, 0);
    castleGroup.add(tower1);

    const tower2 = tower1.clone();
    tower2.position.set(10, 5, 0);
    castleGroup.add(tower2);

    // Spires
    const spireGeo = new THREE.ConeGeometry(3.5, 8, 6);
    const spireMat = new THREE.MeshPhongMaterial({ color: 0xff00ff }); // PINK SPIRES!
    const spire1 = new THREE.Mesh(spireGeo, spireMat);
    spire1.position.set(-10, 21, 0);
    castleGroup.add(spire1);

    const spire2 = spire1.clone();
    spire2.position.set(10, 21, 0);
    castleGroup.add(spire2);

    castleGroup.position.set(0, 0, -120);
    scene.add(castleGroup);
}
createCastle();

// --- ASSET GENERATION (Pixel Forest) ---
function createTree(x, z) {
    const group = new THREE.Group();

    const trunkGeo = new THREE.BoxGeometry(0.8, 4, 0.8);
    const trunkMat = new THREE.MeshPhongMaterial({ color: 0x332211 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2;
    group.add(trunk);

    // Pixel/Low-poly Leaves
    const leavesGeo = new THREE.BoxGeometry(4, 4, 4);
    const leavesMat = new THREE.MeshPhongMaterial({ color: 0xff00ff }); // Magenta Leaves
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.y = 5;
    group.add(leaves);

    const leaves2 = leaves.clone();
    leaves2.scale.set(0.7, 0.7, 0.7);
    leaves2.position.y = 7;
    group.add(leaves2);

    group.position.set(x, 0, z);
    scene.add(group);
}

for (let i = 0; i < 60; i++) {
    const x = (Math.random() - 0.5) * 200;
    const z = (Math.random() - 0.5) * 200;
    if (Math.abs(x) > 10 || Math.abs(z) > 10) createTree(x, z);
}

// --- WEAPON (Doll Princess Gun) ---
const gunGroup = new THREE.Group();
const gunBodyGeo = new THREE.BoxGeometry(0.3, 0.4, 1.2);
const gunBodyMat = new THREE.MeshPhongMaterial({ color: 0xff69b4 }); // Hot Pink
const gunBody = new THREE.Mesh(gunBodyGeo, gunBodyMat);
gunBody.position.set(0.5, -0.4, -0.8);
gunGroup.add(gunBody);

const gunMuzzleGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6);
const gunMuzzleMat = new THREE.MeshPhongMaterial({ color: 0x00ffff }); // Neon Blue
const gunMuzzle = new THREE.Mesh(gunMuzzleGeo, gunMuzzleMat);
gunMuzzle.rotation.x = Math.PI / 2;
gunMuzzle.position.set(0.5, -0.4, -1.6);
gunGroup.add(gunMuzzle);

camera.add(gunGroup);
scene.add(camera);

// --- CUTE 3D FROGS (Fofinhos) ---
function createFrog() {
    const frog = new THREE.Group();

    // Body (Round & Cute)
    const bodyGeo = new THREE.SphereGeometry(1, 12, 12);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x77ff77 }); // Bright Cute Green
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    frog.add(body);

    // Large "Fofo" Eyes
    const eyeWhiteGeo = new THREE.SphereGeometry(0.4, 12, 12);
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const leftEye = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    leftEye.position.set(0.5, 0.7, 0.6);
    frog.add(leftEye);

    const rightEye = leftEye.clone();
    rightEye.position.set(-0.5, 0.7, 0.6);
    frog.add(rightEye);

    // Pupils (Big & Black)
    const pupilGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(0.5, 0.75, 0.95);
    frog.add(leftPupil);

    const rightPupil = leftPupil.clone();
    rightPupil.position.set(-0.5, 0.75, 0.95);
    frog.add(rightPupil);

    const angle = Math.random() * Math.PI * 2;
    frog.position.x = Math.cos(angle) * SPAWN_RADIUS;
    frog.position.z = Math.sin(angle) * SPAWN_RADIUS;
    frog.position.y = 0.8;

    scene.add(frog);
    enemies.push(frog);
}

// --- PROJECTILE SYSTEM (Visible Shots) ---
function shoot() {
    const bulletGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0x00ffff }); // Neon Blue Glow
    const bullet = new THREE.Mesh(bulletGeo, bulletMat);

    // Position bullet at muzzle
    const muzzlePos = new THREE.Vector3();
    gunMuzzle.getWorldPosition(muzzlePos);
    bullet.position.copy(muzzlePos);

    // Direction from camera
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    bullets.push({ mesh: bullet, dir: direction });
    scene.add(bullet);
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.mesh.position.addScaledVector(b.dir, BULLET_SPEED);

        // Remove if too far
        if (b.mesh.position.distanceTo(camera.position) > 200) {
            scene.remove(b.mesh);
            bullets.splice(i, 1);
            continue;
        }

        // Collision check
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (b.mesh.position.distanceTo(enemy.position) < 1.5) {
                // Hit!
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

// --- INTERACTION ---
const startButton = document.getElementById('start-button');
const menu = document.getElementById('game-menu');
const hud = document.getElementById('hud');

startButton.addEventListener('click', () => controls.lock());

controls.addEventListener('lock', () => {
    menu.style.opacity = '0';
    setTimeout(() => { menu.style.display = 'none'; hud.style.display = 'flex'; gameStarted = true; }, 500);
});

controls.addEventListener('unlock', () => {
    if (gameStarted) { menu.style.display = 'flex'; menu.style.opacity = '1'; hud.style.display = 'none'; gameStarted = false; }
});

window.addEventListener('mousedown', (e) => {
    if (!gameStarted) return;
    shoot();

    // Weapon FX
    gunMuzzle.material.color.set(0xffffff);
    gunGroup.position.z += 0.2;
    setTimeout(() => { gunMuzzle.material.color.set(0x00ffff); gunGroup.position.z -= 0.2; }, 50);
});

const keys = {};
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

function updateMovement() {
    if (!gameStarted) return;
    const speed = 0.15;
    if (keys['KeyW']) controls.moveForward(speed);
    if (keys['KeyS']) controls.moveForward(-speed);
    if (keys['KeyA']) controls.moveRight(-speed);
    if (keys['KeyD']) controls.moveRight(speed);
}

// --- GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);

    if (gameStarted) {
        updateMovement();
        updateBullets();

        enemies.forEach(frog => {
            const direction = new THREE.Vector3();
            direction.subVectors(camera.position, frog.position).normalize();
            frog.position.addScaledVector(direction, ENEMY_SPEED);
            frog.lookAt(camera.position.x, 0.8, camera.position.z);
            frog.position.y = 0.8 + Math.abs(Math.sin(Date.now() * 0.005)) * 0.5; // Jump
        });

        gunGroup.position.y = -0.4 + Math.sin(Date.now() * 0.005) * 0.02;
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Init
for (let i = 0; i < ENEMY_COUNT; i++) createFrog();
animate();
