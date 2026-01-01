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

// 2. The Dahlia Particle Generator (Exact p5.js Algorithm)
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

    // Exact p5.js dahlia algorithm - fixed implementation
    for(let r = 0; r <= 1; r += 0.03){
        for(let theta = 0; theta <= 180*30; theta += 1.5){
            const phi = (180/1.75)*Math.exp(-theta/(11*180));
            const petalCut = 0.6 + Math.abs(Math.asin(Math.sin(4.75*theta * Math.PI/180)) + 420*Math.sin(4.75*theta * Math.PI/180))/2000;
            const hangDown = 2.3*Math.pow(r, 2)*Math.pow(0.9*r-1, 2)*Math.sin(phi * Math.PI/180);

            // The condition for valid petals
            const petalRadius = r * Math.sin(phi * Math.PI/180) + hangDown * Math.cos(phi * Math.PI/180);
            if(petalCut * petalRadius > 0){
                const thetaRad = theta * Math.PI/180; // Convert to radians

                const pX = 300 * (1-theta/20000) * petalCut * petalRadius * Math.sin(thetaRad);
                const pY = -300 * (1-theta/20000) * petalCut * (r * Math.cos(phi * Math.PI/180) - hangDown * Math.sin(phi * Math.PI/180));
                const pZ = 300 * (1-theta/20000) * petalCut * petalRadius * Math.cos(thetaRad);

                // Keep original p5.js coordinates (p5.js uses different coordinate system)
                positions.push(pX, pY, pZ);

                // Single brown color - using the main center color (r=0): H=20, S=80, B=60
                const rgb = hsbToRgb(20, 80, 60); // Main brown color

                colors.push(rgb[0], rgb[1], rgb[2]);
            }
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.center();

    return geometry;
}

// Helper for smooth interpolation
function smoothStep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}

// 3. Create Points (Not Mesh!) - This creates the "sand/glitter" texture
const geometry = createDahlia();

// PointsMaterial is the secret to the "Screenshot 1" look
const material = new THREE.PointsMaterial({
    size: 0.6,             // Size of each "grain" of sand
    vertexColors: true,    // Use the custom colors we calculated
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true  // Particles get smaller when further away
});

const flowerSystem = new THREE.Points(geometry, material);

// Apply the specific tilt from your reference image
flowerSystem.rotation.x = -Math.PI / 4; // Tilt toward viewer
flowerSystem.rotation.z = Math.PI / 6;  // Slight twist

scene.add(flowerSystem);

// 4. Lighting (Crucial for the "Deep" look)
const ambientLight = new THREE.AmbientLight(0x404040, 0.5); // Soft base
scene.add(ambientLight);

// Main highlight light (White/Cool)
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(50, 100, 50);
scene.add(dirLight);

// Colored rim light (Warm) to accent the green/pink
const pointLight = new THREE.PointLight(0xffaa00, 1.0, 300);
pointLight.position.set(-50, -50, 50);
scene.add(pointLight);

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
