/**
 * GLOBAL ANIMATION CONTROLS
 * Adjust these to fine-tune the "Whip" and "Grit" levels
 */
const params = {
    cycleDuration: 2000,    // Slower cycle to see the noise move
    minMeshOpacity: 0.2,    // Flower disappears completely when shredded
    
    // WHIP & NOISE PARAMS
    expansionForce: 1,    // Outward push
    shredDrift: 5,       // Local "grainy" jitter
    noiseFrequency: 40,  // The "curliness" of the filaments
    noiseAmplitude: 15.0,  // How violently they whip
    chaosSpeed: 0.005,      // Speed of noise evolution
    
    // RENDERING
    pointSize: 3.4      // Small points = more "abstract/wispy"
};

// 1. Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(40, -60, 1200);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('container').appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

let startTime = Date.now();
let lastTime = startTime;

// Hand Tracking Setup
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
let hands, camera_utils;
let leftDist = 0, rightDist = 0;
let prevLeftDist = 0;
let prevRightDist = 0;
let currentRotation = 0;
let rotationVelocity = 0;
let targetMorph = 0;
let currentMorph = 0;

// Audio setup
const backgroundAudio = new Audio('../background.mp3');
backgroundAudio.loop = true;
backgroundAudio.volume = 0.5; // Quiet background

const pulseAudio = new Audio('../pow.mpeg');
pulseAudio.volume = 0.7;

const morphAudio = new Audio('../swosh.mpeg');
morphAudio.volume = 0.7;

// Sensitivity settings - adjusted for easier max morph triggering
const minDistMorph = 0.05; // Ignore tiny twitches
const maxDistMorph = 0.12; // Reach peak faster (around 60-70% hand stretch)
const minDistRot = 0.02;
const maxDistRot = 0.20;

// Initialize MediaPipe Hands
async function initHands() {
    hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onResults);

    camera_utils = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });

    await camera_utils.start();

    // Start background audio
    backgroundAudio.play().catch(e => console.log('Audio play failed:', e));
}

function onResults(results) {
    // Draw on canvas
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    if (results.multiHandLandmarks && results.multiHandedness) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const handedness = results.multiHandedness[i].label;
            const landmarks = results.multiHandLandmarks[i];
            const color = handedness === 'Left' ? '#0000FF' : '#00FF00'; // Blue for left, Green for right

            // Draw only thumb and index landmarks
            const thumb = landmarks[4];
            const index = landmarks[8];

            canvasCtx.strokeStyle = color;
            canvasCtx.lineWidth = 3;
            canvasCtx.beginPath();
            canvasCtx.moveTo(thumb.x * canvasElement.width, thumb.y * canvasElement.height);
            canvasCtx.lineTo(index.x * canvasElement.width, index.y * canvasElement.height);
            canvasCtx.stroke();

            canvasCtx.fillStyle = '#FF0000';
            canvasCtx.beginPath();
            canvasCtx.arc(thumb.x * canvasElement.width, thumb.y * canvasElement.height, 5, 0, 2 * Math.PI);
            canvasCtx.fill();

            canvasCtx.beginPath();
            canvasCtx.arc(index.x * canvasElement.width, index.y * canvasElement.height, 5, 0, 2 * Math.PI);
            canvasCtx.fill();
        }
    }
    canvasCtx.restore();

    // Calculate distances
    leftDist = 0;
    rightDist = 0;

    if (results.multiHandLandmarks && results.multiHandedness) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const handedness = results.multiHandedness[i].label;
            const landmarks = results.multiHandLandmarks[i];
            
            const thumb = landmarks[4];
            const index = landmarks[8];
            const dist = Math.hypot(thumb.x - index.x, thumb.y - index.y);

            if (handedness === 'Left') {
                leftDist = dist;
            } else if (handedness === 'Right') {
                rightDist = dist;
            }
        }
    }
}

initHands();

// 2. The Merged Generator
function createDahlia(steps = 90, ts = 1200) {
    const positions = [];
    const colors = [];
    const indices = [];
    const rows = steps;
    const cols = ts;


    for (let i = 0; i <= rows; i++) {
        const r = i / rows;
        for (let j = 0; j <= cols; j++) {
            const theta = (j / cols) * (180 * 45);
            const thetaRad = theta * Math.PI / 180;

            // --- THE ORIGINAL MATHEMATICAL FORMULA ---
            const phi = (180 / 1.75) * Math.exp(-theta / (11 * 180));
            const petalCut = 0.6 + Math.abs(Math.asin(Math.sin(9.75 * theta * Math.PI / 180)) + 420 * Math.sin(9.75 * theta * Math.PI / 180)) / 3000;
            const hangDown = 3.5 * Math.pow(r, 2) * Math.pow(0.9 * r - 1, 2) * Math.sin(phi * Math.PI / 180);
            const petalRadius = r * Math.sin(phi * Math.PI / 180) + hangDown * Math.cos(phi * Math.PI / 180) ;

            // Add organic imperfection for natural look
            const organicNoise = 1.0 + (Math.sin(theta * 0.5) * 0.025);
            const factor = 300 * (1 - theta / 20000) * petalCut * organicNoise;
            const pX = factor * petalRadius * Math.sin(thetaRad);
            const pY = -factor *0.4* (r * Math.cos(phi * Math.PI / 180) - hangDown * Math.sin(phi * Math.PI / 180));
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

    // Create random spherical directions and speeds for organic sand dispersion
    const randomDirections = new Float32Array(positions.length);
    const sandSpeeds = new Float32Array(positions.length / 3);

    for (let i = 0; i < positions.length; i += 3) {
        // 1. Create a random unit vector (Direction) - spherical distribution
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);

        // Randomize the direction (X, Y, Z)
        randomDirections[i]     = Math.sin(phi) * Math.cos(theta);
        randomDirections[i + 1] = Math.sin(phi) * Math.sin(theta);
        randomDirections[i + 2] = Math.cos(phi);

        // 2. Assign a speed (Some fall fast, some float)
        sandSpeeds[i / 3] = 0.5 + Math.random() * 1.5;
    }

    geometry.setAttribute('sandDir', new THREE.BufferAttribute(randomDirections, 3));
    geometry.setAttribute('sandSpeed', new THREE.BufferAttribute(sandSpeeds, 1));

    geometry.computeVertexNormals();
    return geometry;
}

const geometry = createDahlia(90, 1200);       // Low-res for Mesh
const geometry1 = createDahlia(800, 800);    // High-res for Points

// 3. Materials - Adjusted for "Glow & Grit"
const meshMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true,
    emissive: 0xffffff,
    emissiveIntensity: 0.15
});

const pointsMaterial = new THREE.PointsMaterial({
    size: params.pointSize,
    vertexColors: true,
    transparent: true,
    blending: THREE.NormalBlending, // Key for glowing overlap
    depthWrite: false
});

const flowerMesh = new THREE.Mesh(geometry, meshMaterial);
const flowerPoints = new THREE.Points(geometry1, pointsMaterial);

const flowerSystem = new THREE.Group();
flowerSystem.add(flowerMesh);
flowerSystem.add(flowerPoints);
flowerSystem.rotation.x = 265 * Math.PI / 180;
scene.add(flowerSystem);

// 4. Lighting
scene.add(new THREE.HemisphereLight(0x40e0d0, 0xff0000, 0.3));

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);

dirLight.position.set(0, 0, 1);

camera.add(dirLight);

scene.add(camera);
let stuckTime = 0

// 5. Physics Engine (Octopus Whip Logic)
function updateOctopusPositions(attr, baseArr, sandArr, factor, time) {
    const pos = attr.array;
    const count = attr.count;
    if(factor < 0.985){
        stuckTime = time
    }
    const t = stuckTime * params.chaosSpeed ;
    const f = params.noiseFrequency;
    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const bx = baseArr[i3];
        const by = baseArr[i3+1];
        const bz = baseArr[i3+2];
        
        const dist = Math.sqrt(bx*bx + bz*bz);
        const radialPower = Math.pow(dist / 220, 2.0);

        // LAYERED NOISE - Fake Perlin for Abstract Bending
        let noiseX = Math.sin(bx * f + t) * Math.cos(bz * f + t);
        let noiseZ = Math.cos(bx * f - t) * Math.sin(bz * f + t);
        
        // Secondary ripples
        noiseX += Math.sin(bx * f * 3.0 + t) * 0.3;
        noiseZ += Math.cos(bz * f * 3.0 + t) * 0.3;

        const expansion = 1.0 + (factor * params.expansionForce * radialPower);

        // Calculate Position
        pos[i3]     = bx * expansion + (noiseX * params.noiseAmplitude * factor * radialPower) + (sandArr[i3] * params.shredDrift * factor);
        pos[i3+1]   = by + (noiseX * noiseZ * 120 * factor * radialPower);
        pos[i3+2]   = bz * expansion + (noiseZ * params.noiseAmplitude * factor * radialPower) + (sandArr[i3+2] * params.shredDrift * factor);
    }
    attr.needsUpdate = true;
}

// 6. Main Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();

    const now = Date.now();
    const dt = (now - lastTime) / 1000.0;
    lastTime = now;

    const totalElapsed = now - startTime;

    // --- 1. SMOOTH MORPH (Right Hand) with max lock ---
    targetMorph = 0.0;
    if (rightDist > minDistMorph) {
        targetMorph = (rightDist - minDistMorph) / (maxDistMorph - minDistMorph);
        targetMorph = Math.min(targetMorph, 1.0);
    }

    // Morph increases smoothly, but locks at max until significantly reduced
    currentMorph += (targetMorph - currentMorph) * 4.0 * dt;
       
    // Play morph sound when morph is active
    if (currentMorph > 0.1) {
        if (morphAudio.paused) {
            morphAudio.currentTime = 0;
            morphAudio.play().catch(e => console.log('Morph audio failed:', e));
        }
    } else {
        morphAudio.pause();
        morphAudio.currentTime = 0;
    }
    prevRightDist = rightDist;

    // --- 2. PULSE ROTATION (Left Hand) with smooth fade ---
    if (leftDist < prevLeftDist && leftDist < 0.08) {
        // Play pulse sound
        pulseAudio.currentTime = 0;
        pulseAudio.play().catch(e => console.log('Pulse audio failed:', e));

        const pulseAmount = (prevLeftDist - leftDist) * 3000.0; // Scale the pulse - stronger when closing
        rotationVelocity += pulseAmount * Math.PI / 180; // Add to velocity
    } else if (leftDist > prevLeftDist) {
        // Opening fingers - immediate smooth stop
        rotationVelocity *= 0.9; // Stronger decay when stopping
    }
    prevLeftDist = leftDist;

    // Apply velocity with decay for smooth motion
    currentRotation += rotationVelocity * dt;
    rotationVelocity *= 0.97; // Decay factor for fade out

    // Slow down rotation when morphing to highlight the morph effect
    if (currentMorph > 0.1) {
        rotationVelocity *= 0.9; // Additional friction when morphing
    }

    flowerSystem.rotation.z = currentRotation;

    // Adjust pulse audio volume based on rotation velocity
    if (!pulseAudio.paused) {
        pulseAudio.volume = Math.max(0.1, Math.min(0.2, rotationVelocity / 3.5));
    }

    // Use hand-controlled morph factor
    const factor = currentMorph;

    // Dynamic Opacity
    meshMaterial.opacity = THREE.MathUtils.lerp(1.0, params.minMeshOpacity, factor);
    pointsMaterial.opacity = THREE.MathUtils.lerp(0.0, 0.9, factor);

    updateOctopusPositions(geometry.attributes.position, geometry.attributes.basePosition.array, geometry.attributes.sandDir.array, factor, totalElapsed);
    updateOctopusPositions(geometry1.attributes.position, geometry1.attributes.basePosition.array, geometry1.attributes.sandDir.array, factor, totalElapsed);

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
