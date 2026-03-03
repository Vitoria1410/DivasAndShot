import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- CONFIGURATION ---
const ENEMY_COUNT = 15;
const ENEMY_SPEED = 0.05;
const SPAWN_RADIUS = 50;

// --- STATE ---
let score = 0;
const enemies = [];
const bullets = [];
let gameStarted = false;

// --- COMPONENTS ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xccff00); // Acid Green Background
scene.fog = new THREE.Fog(0xccff00, 10, 100);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('canvas-container').appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.position.set(5, 10, 5);
scene.add(sunLight);

// Ground
const groundGeometry = new THREE.PlaneGeometry(200, 200);
const groundMaterial = new THREE.MeshPhongMaterial({
    color: 0x33ff00, // Bright Green
    side: THREE.DoubleSide
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// --- ASSET GENERATION (Low Poly Forest) ---
function createTree(x, z) {
    const group = new THREE.Group();

    // Trunk
    const trunkGeo = new THREE.BoxGeometry(0.5, 2, 0.5);
    const trunkMat = new THREE.MeshPhongMaterial({ color: 0x663300 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1;
    group.add(trunk);

    // Leaves (PS2 Low Poly style)
    const leavesGeo = new THREE.ConeGeometry(2, 4, 4);
    const leavesMat = new THREE.MeshPhongMaterial({ color: 0xff00ff }); // PINK TREES!
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.y = 3.5;
    group.add(leaves);

    group.position.set(x, 0, z);
    scene.add(group);
}

for (let i = 0; i < 40; i++) {
    const x = (Math.random() - 0.5) * 150;
    const z = (Math.random() - 0.5) * 150;
    if (Math.abs(x) > 5 || Math.abs(z) > 5) createTree(x, z);
}

// --- WEAPON (Doll Princess Gun) ---
const gunGroup = new THREE.Group();

// Main Body
const gunBodyGeo = new THREE.BoxGeometry(0.3, 0.4, 1.2);
const gunBodyMat = new THREE.MeshPhongMaterial({ color: 0xff69b4 }); // Hot Pink
const gunBody = new THREE.Mesh(gunBodyGeo, gunBodyMat);
gunBody.position.set(0.5, -0.4, -0.8);
gunGroup.add(gunBody);

// Barrel
const gunMuzzleGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.5);
const gunMuzzleMat = new THREE.MeshPhongMaterial({ color: 0x00ffff }); // Neon Blue
const gunMuzzle = new THREE.Mesh(gunMuzzleGeo, gunMuzzleMat);
gunMuzzle.rotation.x = Math.PI / 2;
gunMuzzle.position.set(0.5, -0.4, -1.6);
gunGroup.add(gunMuzzle);

// Handle
const handleGeo = new THREE.BoxGeometry(0.2, 0.5, 0.2);
const handle = new THREE.Mesh(handleGeo, gunBodyMat);
handle.position.set(0.5, -0.7, -0.8);
handle.rotation.x = -0.3;
gunGroup.add(handle);

// Scope/Glow
const scopeGeo = new THREE.BoxGeometry(0.1, 0.15, 0.3);
const scopeMat = new THREE.MeshBasicMaterial({ color: 0xccff00 }); // Acid Green
const scope = new THREE.Mesh(scopeGeo, scopeMat);
scope.position.set(0.5, -0.15, -0.8);
gunGroup.add(scope);

camera.add(gunGroup);
scene.add(camera);

// --- ENEMIES (Horror Frogs) ---
function createFrog() {
    const frog = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(1.5, 1, 1.5);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x113311 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    frog.add(body);

    // Eyes (Glowing)
    const eyeGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(0.4, 0.4, 0.7);
    frog.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(-0.4, 0.4, 0.7);
    frog.add(rightEye);

    const angle = Math.random() * Math.PI * 2;
    frog.position.x = Math.cos(angle) * SPAWN_RADIUS;
    frog.position.z = Math.sin(angle) * SPAWN_RADIUS;
    frog.position.y = 0.5;

    scene.add(frog);
    enemies.push(frog);
}

// --- INTERACTION ---
const startButton = document.getElementById('start-button');
const menu = document.getElementById('game-menu');
const hud = document.getElementById('hud');

startButton.addEventListener('click', () => {
    controls.lock();
});

controls.addEventListener('lock', () => {
    menu.style.opacity = '0';
    setTimeout(() => {
        menu.style.display = 'none';
        hud.style.display = 'block';
        gameStarted = true;
    }, 500);
});

controls.addEventListener('unlock', () => {
    if (gameStarted) {
        menu.style.display = 'flex';
        menu.style.opacity = '1';
        hud.style.display = 'none';
        gameStarted = false;
    }
});

// Shooting
window.addEventListener('mousedown', (e) => {
    if (!gameStarted) return;

    // Simple Raycaster for shooting
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const intersects = raycaster.intersectObjects(enemies, true);

    // Visual feedback (Muzzle flash & Recoil)
    gunMuzzle.material.color.set(0xffffff);
    gunGroup.position.z += 0.2; // Recoil
    setTimeout(() => {
        gunMuzzle.material.color.set(0x00ffff);
        gunGroup.position.z -= 0.2;
    }, 50);

    if (intersects.length > 0) {
        const hitObject = intersects[0].object.parent; // The Group
        const index = enemies.indexOf(hitObject);
        if (index > -1) {
            scene.remove(hitObject);
            enemies.splice(index, 1);
            score += 100;
            document.getElementById('score-value').innerText = score.toString().padStart(6, '0');
            createFrog(); // Respawn
        }
    }
});

// Movement
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

        // Update Enemies
        enemies.forEach(frog => {
            const direction = new THREE.Vector3();
            direction.subVectors(camera.position, frog.position).normalize();
            frog.position.addScaledVector(direction, ENEMY_SPEED);
            frog.lookAt(camera.position.x, 0.5, camera.position.z);

            // "Jump" animation
            frog.position.y = 0.5 + Math.abs(Math.sin(Date.now() * 0.01)) * 0.5;
        });

        // Weapon Sway
        gunGroup.position.y = Math.sin(Date.now() * 0.005) * 0.02;
        gunGroup.position.x = Math.cos(Date.now() * 0.005) * 0.01;
    }

    renderer.render(scene, camera);
}

// Resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Init
for (let i = 0; i < ENEMY_COUNT; i++) {
    createFrog();
}
animate();
