// 1. Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // Pure black background

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
// Set initial Camera position to match that "tilted" look you liked
// (Looking slightly from the right and below)
camera.position.set(40, -60, 150);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio); // Sharpness on high-res screens
document.getElementById('container').appendChild(renderer.domElement);

// --- MOUSE CONTROLS (OrbitControls) ---
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Adds that smooth "weight" to the movement
controls.dampingFactor = 0.05;
controls.enableZoom = true;
controls.autoRotate = false;   // Set to true if you want it to spin when idle

// 2. The Dahlia Mesh Generator (Continuous Surface)
function createDahlia() {
    const positions = [];
    const colors = [];

    const tempColor = new THREE.Color();

    // Convert HSB to RGB helper
    function hsbToRgb(h, s, b) {
        // Normalize HSB values (p5.js uses 0-360 for H, 0-100 for S/B)
        const hNorm = h / 360;
        const sNorm = s / 100;
        const bNorm = b / 100;

        tempColor.setHSL(hNorm, sNorm, bNorm);
        return [tempColor.r, tempColor.g, tempColor.b];
    }

    const indices = [];
    const rows = 40;  // r resolution
    const cols = 800; // theta resolution

    // 1. Generate Vertices & Colors
    for (let i = 0; i <= rows; i++) {
        const r = i / rows;
        for (let j = 0; j <= cols; j++) {
            // theta in degrees to match the p5.js logic
            const theta = (j / cols) * (180 * 30);
            const thetaRad = theta * Math.PI / 180;

            // --- THE CORE ALGORITHM ---
            const phi = (180 / 1.75) * Math.exp(-theta / (11 * 180));
            // petalCut determines the "jagged" edges and separation of petals
            const petalCut = 0.6 + Math.abs(Math.asin(Math.sin(4.75 * theta * Math.PI / 180)) + 420 * Math.sin(4.75 * theta * Math.PI / 180)) / 2000;
            const hangDown = 2.3 * Math.pow(r, 2) * Math.pow(0.9 * r - 1, 2) * Math.sin(phi * Math.PI / 180);

            const petalRadius = r * Math.sin(phi * Math.PI / 180) + hangDown * Math.cos(phi * Math.PI / 180);

            // Coordinates
            const factor = 300 * (1 - theta / 20000) * petalCut;
            const pX = factor * petalRadius * Math.sin(thetaRad);
            const pY = -factor * (r * Math.cos(phi * Math.PI / 180) - hangDown * Math.sin(phi * Math.PI / 180));
            const pZ = factor * petalRadius * Math.cos(thetaRad);

            positions.push(pX, pY, pZ);

            // --- PALETTE FROM IMAGE ---
            // Center (Green/Brown) -> Middle (Pink/Red) -> Tips (Cyan/White)
            let h, s, b;
            if (r < 0.2) {
                h = 20 + (r * 100); // Brownish Green
                s = 80; b = 40;
            } else if (r < 0.7) {
                h = 330; // Pink
                s = 70 + (r * 20); b = 80;
            } else {
                h = 190 + (r * 20); // Cyan/Light Blue
                s = 40; b = 95;
            }

            const rgb = hsbToRgb(h, s, b);
            colors.push(rgb[0], rgb[1], rgb[2]);
        }
    }

    // 2. Generate Indices (This turns points into a Mesh)
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const a = i * (cols + 1) + j;
            const b = i * (cols + 1) + j + 1;
            const c = (i + 1) * (cols + 1) + j + 1;
            const d = (i + 1) * (cols + 1) + j;

            // Connect 4 points to make two triangles
            indices.push(a, b, d);
            indices.push(b, c, d);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); // Crucial for lighting the smooth surface
    geometry.center();

    return geometry;
}

// Helper for smooth interpolation
function smoothStep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}

// 3. Create Mesh (Continuous Surface)
const geometry = createDahlia();

// MeshStandardMaterial for smooth surface appearance
const material = new THREE.MeshStandardMaterial({
    vertexColors: true,    // Use the custom colors we calculated
    side: THREE.DoubleSide,
    flatShading: false,    // Smooth shading
    roughness: 0.4,
    metalness: 0.1
});

const flowerSystem = new THREE.Mesh(geometry, material);

// Apply the specific tilt from your reference image
flowerSystem.rotation.x = -Math.PI / 4; // Tilt toward viewer
flowerSystem.rotation.z = Math.PI / 6;  // Slight twist

scene.add(flowerSystem);

// 4. Enhanced Lighting for Flower Beauty
const ambientLight = new THREE.AmbientLight(0x404040, 0.6); // Slightly brighter base
scene.add(ambientLight);

// Main directional light (Soft white)
const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
mainLight.position.set(30, 100, 50);
mainLight.castShadow = true;
scene.add(mainLight);

// Warm accent light from below
const warmLight = new THREE.PointLight(0xffddaa, 0.8, 200);
warmLight.position.set(0, -50, 30);
scene.add(warmLight);

// Cool rim light for definition
const rimLight = new THREE.PointLight(0xaaccff, 0.6, 150);
rimLight.position.set(-40, 20, -30);
scene.add(rimLight);

// 5. Animation Loop
function animate() {
    requestAnimationFrame(animate);

    // REQUIRED: Update controls every frame for damping to work
    controls.update();

    // Note: Flower stays stationary - we now rotate the CAMERA around the flower using the mouse.

    renderer.render(scene, camera);
}

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
