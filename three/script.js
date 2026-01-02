/**
 * GLOBAL ANIMATION CONTROLS
 * Adjust these to fine-tune the "Whip" and "Grit" levels
 */
const params = {
    cycleDuration: 4000,    // Slower cycle to see the noise move
    minMeshOpacity: 0.2,    // Flower disappears completely when shredded
    
    // WHIP & NOISE PARAMS
    expansionForce: 0.4,    // Outward push
    shredDrift: 1.0,       // Local "grainy" jitter
    noiseFrequency: 0.5,  // The "curliness" of the filaments
    noiseAmplitude: 100.0,  // How violently they whip
    chaosSpeed: 0.002,      // Speed of noise evolution
    
    // RENDERING
    pointSize: 2.4          // Small points = more "abstract/wispy"
};

// 1. Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(40, -60, 700);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('container').appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

let startTime = Date.now();

// 2. The Merged Generator
function createDahlia(steps = 34, ts = 360) {
    const positions = [];
    const colors = [];
    const indices = [];
    const sandDirs = [];

    const rSteps = steps;
    const thetaSteps = ts;

    const colorCore = new THREE.Color(0x0a3d1a);
    const colorHot = new THREE.Color(0xff4d6d);
    const colorWarm = new THREE.Color(0xffb703);
    const colorCool = new THREE.Color(0x8ecae6);
    const colorWhite = new THREE.Color(0xffffff);

    for (let i = 0; i <= rSteps; i++) {
        const r = i / rSteps;
        for (let j = 0; j <= thetaSteps; j++) {
            const theta = (j / thetaSteps) * (180 * 30);
            const thetaRad = theta * Math.PI / 180;

            const phi = (180 / 1.75) * Math.exp(-theta / (11 * 180));
            const petalCut = 0.6 + Math.abs(Math.asin(Math.sin(4.75 * theta * Math.PI / 180)) + 420 * Math.sin(4.75 * theta * Math.PI / 180)) / 2000;
            const hangDown = 2.3 * Math.pow(r, 2) * Math.pow(0.9 * r - 1, 2) * Math.sin(phi * Math.PI / 180);
            const petalRadius = r * Math.sin(phi * Math.PI / 180) + hangDown * Math.cos(phi * Math.PI / 180);

            const factor = 300 * (1 - theta / 20000) * petalCut;
            const pX = factor * petalRadius * Math.sin(thetaRad);
            const pY = -factor * (r * Math.cos(phi * Math.PI / 180) - hangDown * Math.sin(phi * Math.PI / 180));
            const pZ = factor * petalRadius * Math.cos(thetaRad);

            positions.push(pX, pY, pZ);

            const vColor = new THREE.Color();
            if (r < 0.12) {
                vColor.copy(colorCore).lerp(colorHot, r * 5);
            } else {
                const huePicker = Math.sin(thetaRad * 0.1 + r * 2);
                if (huePicker > 0.3) vColor.copy(colorHot);
                else if (huePicker > -0.3) vColor.lerpColors(colorHot, colorWarm, (huePicker + 0.3) / 0.6);
                else vColor.lerpColors(colorWarm, colorCool, Math.abs(huePicker));
                vColor.lerp(colorWhite, Math.pow(r, 1.5) * 0.7);
            }
            colors.push(vColor.r, vColor.g, vColor.b);

            const mag = Math.sqrt(pX*pX + pY*pY + pZ*pZ) || 1;
            sandDirs.push(pX/mag + (Math.random()-0.5), pY/mag + (Math.random()-0.5), pZ/mag + (Math.random()-0.5));
        }
    }

    for (let i = 0; i < rSteps; i++) {
        for (let j = 0; j < thetaSteps; j++) {
            const a = i * (thetaSteps + 1) + j;
            const b = i * (thetaSteps + 1) + j + 1;
            const c = (i + 1) * (thetaSteps + 1) + j + 1;
            const d = (i + 1) * (thetaSteps + 1) + j;
            indices.push(a, b, d, b, c, d);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('basePosition', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('sandDir', new THREE.Float32BufferAttribute(sandDirs, 3));
    geo.computeVertexNormals();
    return geo;
}

const geometry = createDahlia(34, 360);       // Low-res for Mesh
const geometry1 = createDahlia(500, 800);    // High-res for Points

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
scene.add(new THREE.HemisphereLight(0x40e0d0, 0xff0000, 0.5));

const dirLight = new THREE.DirectionalLight(0xffffff, 1);

dirLight.position.set(0, 0, 1);

camera.add(dirLight);

scene.add(camera);

// 5. Physics Engine (Octopus Whip Logic)
function updateOctopusPositions(attr, baseArr, sandArr, factor, time) {
    const pos = attr.array;
    const count = attr.count;
    const t = time * params.chaosSpeed;
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

    const totalElapsed = Date.now() - startTime;
    const progress = (totalElapsed % params.cycleDuration) / params.cycleDuration;
    const factor = Math.pow((Math.sin(progress * Math.PI * 2 - Math.PI / 2) + 1) / 2, 1.2);

    // Dynamic Opacity
    meshMaterial.opacity = THREE.MathUtils.lerp(1.0, params.minMeshOpacity, factor);
    pointsMaterial.opacity = THREE.MathUtils.lerp(0.0, 1.0, factor);

    const fixedTime = progress * params.cycleDuration;

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