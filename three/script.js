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

// --- MORPHING VARIABLES ---
let startTime = Date.now();
const cycleDuration = 3000; // 3 seconds total (1.5s out, 1.5s back)

// --- CLUSTER DISPERSION CONTROLS ---
const dispersionStrength =500.0; // How far clusters can move (higher = more spread)
const escapeProbability = 0.4; // % of points in escape clusters that actually escape (0.0-1.0)
const activeProbability = 0.3; // % of points in active clusters that are active (0.0-1.0)
// Passive clusters always stay contained

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
    const rows = 300;  // Increased for smoothness
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

    // Store original positions and create sand dispersion seeds
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    // Store original positions for the morph back
    geometry.setAttribute('basePosition', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // Create outward direction vectors based on position from center (radial burst)
    const outwardDirs = new Float32Array(positions.length);
    const sandSpeeds = new Float32Array(positions.length / 3);

    // Create clustered behavior - some groups escape, others stay contained
    for (let i = 0; i < positions.length; i += 3) {
        // 1. Calculate Outward Vector (Position - Center)
        let vx = positions[i];
        let vy = positions[i+1];
        let vz = positions[i+2];

        let mag = Math.sqrt(vx*vx + vy*vy + vz*vz);

        // Create cluster behavior based on position
        const clusterSeed = (i / 3) % 7; // 7 different cluster types
        const isEscapeClusterType = clusterSeed < 2; // Only 2 out of 7 clusters try to escape
        const isActiveClusterType = clusterSeed < 4; // 4 out of 7 clusters are more active

        // Within each cluster type, only some points actually behave that way
        let behavesAsEscape = false;
        let behavesAsActive = false;
        let behavesAsPassive = true; // Default

        if (isEscapeClusterType && Math.random() < escapeProbability) {
            behavesAsEscape = true;
            behavesAsActive = false;
            behavesAsPassive = false;
        } else if (isActiveClusterType && Math.random() < activeProbability) {
            behavesAsEscape = false;
            behavesAsActive = true;
            behavesAsPassive = false;
        }
        // Otherwise stays as passive (behavesAsPassive = true)

        // Normalize for outward direction with individual point behavior
        if (mag > 0.001) { // Avoid division by zero
            const baseDirX = vx / mag;
            const baseDirY = vy / mag;
            const baseDirZ = vz / mag;

            if (behavesAsEscape) {
                // Individual escape points: move much further outward with high randomness
                outwardDirs[i]     = baseDirX + (Math.random() - 0.5) * 2.0;
                outwardDirs[i + 1] = baseDirY + (Math.random() - 0.5) * 2.0;
                outwardDirs[i + 2] = baseDirZ + (Math.random() - 0.5) * 2.0;
            } else if (behavesAsActive) {
                // Individual active points: moderate movement
                outwardDirs[i]     = baseDirX + (Math.random() - 0.5) * 1.0;
                outwardDirs[i + 1] = baseDirY + (Math.random() - 0.5) * 1.0;
                outwardDirs[i + 2] = baseDirZ + (Math.random() - 0.5) * 1.0;
            } else {
                // Passive points: stay more contained (most points)
                outwardDirs[i]     = baseDirX * 0.5 + (Math.random() - 0.5) * 0.2;
                outwardDirs[i + 1] = baseDirY * 0.5 + (Math.random() - 0.5) * 0.2;
                outwardDirs[i + 2] = baseDirZ * 0.5 + (Math.random() - 0.5) * 0.2;
            }
        } else {
            // Center points get random outward direction
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            outwardDirs[i]     = Math.sin(phi) * Math.cos(theta);
            outwardDirs[i + 1] = Math.sin(phi) * Math.sin(theta);
            outwardDirs[i + 2] = Math.cos(phi);
        }

        // Speed based on individual point behavior
        if (behavesAsEscape) {
            sandSpeeds[i / 3] = 1.8 + Math.random() * 0.4; // Very fast escape points
        } else if (behavesAsActive) {
            sandSpeeds[i / 3] = 1.2 + Math.random() * 0.3; // Moderate speed
        } else {
            sandSpeeds[i / 3] = 0.6 + Math.random() * 0.2; // Slow passive points
        }
    }

    geometry.setAttribute('sandDir', new THREE.BufferAttribute(outwardDirs, 3));
    geometry.setAttribute('sandSpeed', new THREE.BufferAttribute(sandSpeeds, 1));

    geometry.computeVertexNormals();
    return geometry;
}

// Helper for smooth interpolation
function smoothStep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}

// 3. Create Dual Objects: Mesh + Points for seamless transitions
const geometry = createDahlia();

// 1. Create the Solid Mesh (for when it's a flower)
const meshMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1.0,
    roughness: 0.7,
    metalness: 0.0,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.2
});

// Update the shader to keep the soft glow on the colors
meshMaterial.onBeforeCompile = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    `vec3 totalEmissiveRadiance = emissive;`,
    `vec3 totalEmissiveRadiance = emissive * vColor;`
  );
};

const flowerMesh = new THREE.Mesh(geometry, meshMaterial);

// 2. Create the Sand Points (for when it's blowing away)
const pointsMaterial = new THREE.PointsMaterial({
    size: 2,                // Increased size for visibility
    vertexColors: true,       // CRITICAL: This enables the flower colors
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true     // Points get smaller as they move away from camera
});

const flowerPoints = new THREE.Points(geometry, pointsMaterial);

// Group them so they move/rotate together
const flowerSystem = new THREE.Group();
flowerSystem.add(flowerMesh);
flowerSystem.add(flowerPoints);

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

    const elapsedTime = Date.now() - startTime;

    // --- 3-SECOND MORPH LOGIC ---
    // Oscillates between 0 and 1 every 6 seconds
    const rawFactor = (Math.sin((elapsedTime / cycleDuration) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    const morphFactor = Math.pow(rawFactor, 1.2); // Snappier morph

    // --- SEAMLESS MESH/POINTS TRANSITION ---
    if (morphFactor < 0.01) {
        // Back to solid Mesh
        flowerMesh.visible = true;
        flowerPoints.visible = false;
        flowerMesh.material.opacity = 1.0;
    } else {
        // Morphing into Points
        flowerMesh.visible = true;
        flowerPoints.visible = true;

        // Cross-fade: Mesh disappears as Points take over
        flowerMesh.material.opacity = Math.max(0.5, 1.0 - morphFactor * 2.0);
        flowerPoints.material.opacity = Math.min(1.0, morphFactor * 2.0);
    }

    // --- ORGANIC SAND DISPERSION ANIMATION ---
    const posAttr = geometry.attributes.position;
    const basePos = geometry.attributes.basePosition.array;
    const sandDirs = geometry.attributes.sandDir.array;   // Our new random directions
    const sandSpeeds = geometry.attributes.sandSpeed.array; // Individual grain speeds

    for (let i = 0; i < posAttr.count; i++) {
        const i3 = i * 3;

        // Timing: Add a slight delay based on height (Y) to make it "crumble" from top to bottom
        const heightDelay = (basePos[i3 + 1] + 200) / 400;
        const individualMorph = Math.max(0, (morphFactor * sandSpeeds[i]) - (heightDelay * 0.4));

        // Calculate radial distance from center for extreme distance-based scaling
        const radialDistance = Math.sqrt(basePos[i3]**2 + basePos[i3+2]**2) / 300; // Normalized 0-1
        const radialScale = Math.max(0.1, radialDistance * 10.0); // Inner points barely move (0.1x), outer points move 10x far!

        // Gentle outward flow like water dispersing from a sphere
        const flowSpeed = individualMorph * 0.5; // Much gentler movement
        const flowDist = flowSpeed * 8.0 * radialScale; // Radial scaling: outer points travel farther

        // Smooth radial movement outward
        const moveX = sandDirs[i3]   * flowDist;
        const moveY = sandDirs[i3 + 1] * flowDist * 0.3; // Reduced vertical movement
        const moveZ = sandDirs[i3 + 2] * flowDist;

        // Very gentle gravity, like particles slowly settling
        const gravity = individualMorph * individualMorph * -15.0;

        // Subtle, flowing swirl like gentle currents
        const swirlAngle = elapsedTime * 0.003 + i * 0.05; // Much slower, gentler rotation
        const swirlStrength = individualMorph * 3.0; // Much weaker swirl

        const swirlX = Math.cos(swirlAngle) * swirlStrength;
        const swirlZ = Math.sin(swirlAngle) * swirlStrength;

        // Create illusion of smooth disappearance by blending with original position
        const blendFactor = 1.0 - (individualMorph * 0.7); // Keep some connection to original shape
        const finalX = basePos[i3] * blendFactor + (basePos[i3] + moveX + swirlX) * (1.0 - blendFactor);
        const finalY = basePos[i3 + 1] * blendFactor + (basePos[i3 + 1] + moveY + gravity) * (1.0 - blendFactor);
        const finalZ = basePos[i3 + 2] * blendFactor + (basePos[i3 + 2] + moveZ + swirlZ) * (1.0 - blendFactor);

        posAttr.array[i3]     = finalX;
        posAttr.array[i3 + 1] = finalY;
        posAttr.array[i3 + 2] = finalZ;
    }

    posAttr.needsUpdate = true;

    // Update flower transform display
    const pos = flowerSystem.position;
    const rot = flowerSystem.rotation;
    infoDiv.innerHTML = `
<b>Flower Transform:</b><br>
Position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})<br>
Rotation: (${(rot.x * 180/Math.PI).toFixed(1)}°, ${(rot.y * 180/Math.PI).toFixed(1)}°, ${(rot.z * 180/Math.PI).toFixed(1)}°)<br>
Rotation (rad): (${rot.x.toFixed(2)}, ${rot.y.toFixed(2)}, ${rot.z.toFixed(2)})<br>
<b>Morph Factor: ${morphFactor.toFixed(2)}</b>
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
