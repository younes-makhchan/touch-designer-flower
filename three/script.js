// 1. Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // Pure black background

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
// Set initial Camera position to match that "tilted" look you liked
// (Looking slightly from the right and below)
camera.position.set(40, -60, 700);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio); // Sharpness on high-res screens
document.getElementById('container').appendChild(renderer.domElement);

// Create UI for displaying flower transform values
const infoDiv = document.createElement('div');
infoDiv.style.position = 'absolute';
infoDiv.style.top = '10px';
infoDiv.style.left = '10px';
infoDiv.style.color = 'white';
infoDiv.style.fontFamily = 'monospace';
infoDiv.style.fontSize = '12px';
infoDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
infoDiv.style.padding = '10px';
infoDiv.style.borderRadius = '5px';
infoDiv.style.zIndex = '1000';
document.body.appendChild(infoDiv);

// Instructions div
const instructionsDiv = document.createElement('div');
instructionsDiv.style.position = 'absolute';
instructionsDiv.style.bottom = '10px';
instructionsDiv.style.left = '10px';
instructionsDiv.style.color = 'white';
instructionsDiv.style.fontFamily = 'monospace';
instructionsDiv.style.fontSize = '12px';
instructionsDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
instructionsDiv.style.padding = '10px';
instructionsDiv.style.borderRadius = '5px';
instructionsDiv.style.zIndex = '1000';
instructionsDiv.innerHTML = `
<b>Flower Controls:</b><br>
WASD: Move flower (X/Z)<br>
QE: Move up/down (Y)<br>
Arrow Keys: Rotate flower<br>
IJKL: Rotate around other axes<br>
Space: Reset position/rotation<br>
`;
document.body.appendChild(instructionsDiv);

// --- MOUSE CONTROLS (OrbitControls) ---
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Adds that smooth "weight" to the movement
controls.dampingFactor = 0.05;
controls.enableZoom = true;
controls.autoRotate = false;   // Set to true if you want it to spin when idle

// 2. The Correct Shape Generator (Mathematical Continuous Surface)
function createDahlia() {
    const positions = [];
    const colors = [];
    const indices = [];
    const rows = 90;  // Increased for smoothness
    const cols = 1200;

    for (let i = 0; i <= rows; i++) {
        const r = i / rows;
        for (let j = 0; j <= cols; j++) {
            const theta = (j / cols) * (180 * 45);
            const thetaRad = theta * Math.PI / 180;

            // --- THE ORIGINAL MATHEMATICAL FORMULA ---
            const phi = (180 / 1.75) * Math.exp(-theta / (30 * 180));
            const petalCut = 0.6 + Math.abs(Math.asin(Math.sin(4.75 * theta * Math.PI / 180)) + 420 * Math.sin(4.75 * theta * Math.PI / 180)) / 3000;
            const hangDown = 3.5 * Math.pow(r, 2) * Math.pow(0.9 * r - 1, 2) * Math.sin(phi * Math.PI / 180);
            const petalRadius = r * Math.sin(phi * Math.PI / 180) + hangDown * Math.cos(phi * Math.PI / 180) ;

            // Add organic imperfection for natural look
            const organicNoise = 1.0 + (Math.sin(theta * 0.5) * 0.025);
            const factor = 300 * (1 - theta / 20000) * petalCut * organicNoise;
            const pX = factor * petalRadius * Math.sin(thetaRad);
            const pY = -factor * (r * Math.cos(phi * Math.PI / 180) - hangDown * Math.sin(phi * Math.PI / 180));
            const pZ = factor * petalRadius * Math.cos(thetaRad);

            positions.push(pX, pY, pZ);

            // --- SPIRAL-BASED COLOR ALGORITHM (True to Nature) ---
            const vColor = new THREE.Color();

            // Define the key colors from the reference images
            const colorCore = new THREE.Color(0x0a3d1a);   // Deep Green (tight center)
            const colorHot = new THREE.Color(0xff4d6d);    // Vibrant Pink/Red
            const colorWarm = new THREE.Color(0xffb703);   // Orange/Yellow
            const colorCool = new THREE.Color(0x8ecae6);   // Sky Blue
            const colorWhite = new THREE.Color(0xffffff);  // White tips

            if (r < 0.12) {
                // Green center (tight biological core)
                vColor.copy(colorCore);
                // Quick transition to red as we leave the center
                vColor.lerp(colorHot, r * 5);
            } else {
                // Spiral-based hue shift (follows logarithmic growth)
                // Using sine waves to oscillate between Pink, Orange, and Blue
                const huePicker = Math.sin(thetaRad * 0.1 + r * 2);

                if (huePicker > 0.3) {
                    vColor.copy(colorHot);
                } else if (huePicker > -0.3) {
                    vColor.lerpColors(colorHot, colorWarm, (huePicker + 0.3) / 0.6);
                } else {
                    vColor.lerpColors(colorWarm, colorCool, Math.abs(huePicker));
                }

                // Radial gradient (Fade to white/light at petal tips)
                // The image shows very light edges. We increase lightness as 'r' increases.
                const tipLightness = Math.pow(r, 1.5);
                vColor.lerp(colorWhite, tipLightness * 0.7);
            }

            // Add "Pointillism" Noise (The grainy texture in the image)
            const noise = (Math.random() - 0.5) * 0.15;
            vColor.r = Math.max(0, Math.min(1, vColor.r + noise));
            vColor.g = Math.max(0, Math.min(1, vColor.g + noise));
            vColor.b = Math.max(0, Math.min(1, vColor.b + noise));

            colors.push(vColor.r, vColor.g, vColor.b);
        }
    }

    // Generate Mesh Indices
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const a = i * (cols + 1) + j;
            const b = i * (cols + 1) + j + 1;
            const c = (i + 1) * (cols + 1) + j + 1;
            const d = (i + 1) * (cols + 1) + j;
            indices.push(a, b, d, b, c, d);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
}

// Helper for smooth interpolation
function smoothStep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}

// 3. Create Mathematical Dahlia with Organic Material
const geometry = createDahlia();
const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true,    // Enable transparency for soft edges
    opacity: 0.85,        // Slightly see-through
    roughness: -0.2,       // High roughness = soft matte look (no metal shine)
    metalness: 0.0,       // 0 metalness for organic feel
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.2 // Very low glow for gentle effect
});

// Update the shader to keep the soft glow on the colors
material.onBeforeCompile = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    `vec3 totalEmissiveRadiance = emissive;`,
    `vec3 totalEmissiveRadiance = emissive * vColor;`
  );
};

const flowerSystem = new THREE.Mesh(geometry, material);

// Apply the specific tilt from your reference image
flowerSystem.rotation.x = 265  * Math.PI / 180 ; // Tilt toward viewer
flowerSystem.rotation.z = 2* Math.PI / 180 ;  // Slight twist
flowerSystem.rotation.y =180* Math.PI / 180 ;  // Slight twist

// --- KEYBOARD CONTROLS for Flower Manipulation ---
const moveSpeed = 5;
const rotateSpeed = 0.05;

document.addEventListener('keydown', (event) => {
    switch(event.code) {
        // Position controls (WASD + QE)
        case 'KeyW': // Forward (negative Z)
            flowerSystem.position.z -= moveSpeed;
            break;
        case 'KeyS': // Backward (positive Z)
            flowerSystem.position.z += moveSpeed;
            break;
        case 'KeyA': // Left (negative X)
            flowerSystem.position.x -= moveSpeed;
            break;
        case 'KeyD': // Right (positive X)
            flowerSystem.position.x += moveSpeed;
            break;
        case 'KeyQ': // Up (positive Y)
            flowerSystem.position.y += moveSpeed;
            break;
        case 'KeyE': // Down (negative Y)
            flowerSystem.position.y -= moveSpeed;
            break;

        // Rotation controls (Arrow Keys)
        case 'ArrowUp': // Rotate forward (negative X)
            flowerSystem.rotation.x -= rotateSpeed;
            break;
        case 'ArrowDown': // Rotate backward (positive X)
            flowerSystem.rotation.x += rotateSpeed;
            break;
        case 'ArrowLeft': // Rotate left (negative Y)
            flowerSystem.rotation.y -= rotateSpeed;
            break;
        case 'ArrowRight': // Rotate right (positive Y)
            flowerSystem.rotation.y += rotateSpeed;
            break;

        // Additional rotation axes (IJKL)
        case 'KeyI': // Rotate up around Z
            flowerSystem.rotation.z += rotateSpeed;
            break;
        case 'KeyK': // Rotate down around Z
            flowerSystem.rotation.z -= rotateSpeed;
            break;
        case 'KeyJ': // Rotate left around X
            flowerSystem.rotation.x -= rotateSpeed;
            break;
        case 'KeyL': // Rotate right around X
            flowerSystem.rotation.x += rotateSpeed;
            break;

        // Reset (Space)
        case 'Space':
            flowerSystem.position.set(0, 0, 0);
            flowerSystem.rotation.set(-Math.PI / 4, 0, Math.PI / 6);
            event.preventDefault(); // Prevent page scroll
            break;
    }
});

scene.add(flowerSystem);

// 4. Gentle Lighting Setup
// 1. Hemisphere Light: Provides a sky/ground color gradient.
// This ensures that even the "back" parts have a subtle blue or green tint.
const hemiLight = new THREE.HemisphereLight(0x40e0d0, 0xff0000, 0.5); // Cyan sky, Red ground
scene.add(hemiLight);

// 2. Main Directional Light: Follows the camera so the front is always lit
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(0, 0, 1); // Pointing directly at the scene from the camera
camera.add(dirLight); // Adding it to the camera makes the light move with your view
scene.add(camera);

// 5. Animation Loop
function animate() {
    requestAnimationFrame(animate);

    // REQUIRED: Update controls every frame for damping to work
    controls.update();

    // Update flower transform display
    const pos = flowerSystem.position;
    const rot = flowerSystem.rotation;
    infoDiv.innerHTML = `
<b>Flower Transform:</b><br>
Position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})<br>
Rotation: (${(rot.x * 180/Math.PI).toFixed(1)}°, ${(rot.y * 180/Math.PI).toFixed(1)}°, ${(rot.z * 180/Math.PI).toFixed(1)}°)<br>
Rotation (rad): (${rot.x.toFixed(2)}, ${rot.y.toFixed(2)}, ${rot.z.toFixed(2)})
`;

    renderer.render(scene, camera);
}

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
