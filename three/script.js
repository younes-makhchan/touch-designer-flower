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
    const rows = 100;  // Increased for smoothness
    const cols = 1200;

    for (let i = 0; i <= rows; i++) {
        const r = i / rows;
        for (let j = 0; j <= cols; j++) {
            const theta = (j / cols) * (180 * 30);
            const thetaRad = theta * Math.PI / 180;

            // --- THE ORIGINAL MATHEMATICAL FORMULA ---
            const phi = (180 / 1.75) * Math.exp(-theta / (11 * 180));
            const petalCut = 0.6 + Math.abs(Math.asin(Math.sin(4.75 * theta * Math.PI / 180)) + 420 * Math.sin(4.75 * theta * Math.PI / 180)) / 2000;
            const hangDown = 2.3 * Math.pow(r, 2) * Math.pow(0.9 * r - 1, 2) * Math.sin(phi * Math.PI / 180);
            const petalRadius = r * Math.sin(phi * Math.PI / 180) + hangDown * Math.cos(phi * Math.PI / 180);

            // Add organic imperfection for natural look
            const organicNoise = 1.0 + (Math.sin(theta * 0.5) * 0.025);
            const factor = 300 * (1 - theta / 20000) * petalCut * organicNoise;
            const pX = factor * petalRadius * Math.sin(thetaRad);
            const pY = -factor * (r * Math.cos(phi * Math.PI / 180) - hangDown * Math.sin(phi * Math.PI / 180));
            const pZ = factor * petalRadius * Math.cos(thetaRad);

            positions.push(pX, pY, pZ);

            // --- SPECIFIC COLOR MAP ---
            const vColor = new THREE.Color();

            // Determine "Center" vs "Outer" based on radius
            if (r < 0.15) {
                vColor.setHex(0x02612d); // Sage Green (softer than Forest Green)
            } else if (r < 0.25) {
                vColor.setHex(0xb31c04); // Dusty Rose/Deep Petal Red (softer than pure red)
            } else {
                // Outer petals logic based on position
                const isRight = pX > 0;
                const isTop = pY > 0;

                if (isRight && !isTop) {
                    // Right Center: Light Blue to White
                    vColor.lerpColors(new THREE.Color(0x19ffe0), new THREE.Color(0xcaeefc), r * 0.8);
                } else {
                    // Top, Bottom, and Left: Sky Blue with White highlights
                    vColor.lerpColors(new THREE.Color(0x14bbfc), new THREE.Color(0xcaeefc), r * 0.8);
                }
            }
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
    roughness: 0.0,       // High roughness = soft matte look (no metal shine)
    metalness: 0.0,       // 0 metalness for organic feel
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.2, // Very low glow for gentle effect
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
// Soft Ambient for base visibility
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

// Gentle Key Light (White)
const topLight = new THREE.PointLight(0xffffff, 1, 250);
topLight.position.set(20, 50, 100);
scene.add(topLight);

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
