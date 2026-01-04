
const params = {
    cycleDuration: 2000,   
    minMeshOpacity: 0.15,   
    
    expansionForce: 0.5,    
    shredDrift: 8,       
    noiseFrequency: 0.1,  
    noiseAmplitude: 90.0,  
    chaosSpeed: 0.002,      
    
    pointSize: 3      
};
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
let morphPeaked = false;
let showSpinText = false;
let spinTextTimer = 0;

const backgroundAudio = new Audio('./assets/audio/background.mp3');
backgroundAudio.loop = true;
backgroundAudio.volume = 0.5;

const pulseAudio = new Audio('./assets/audio/pow.mpeg');
pulseAudio.volume = 0.7;

const morphAudio = new Audio('./assets/audio/swosh.mpeg');
morphAudio.volume = 0.7;

const minDistMorph = 0.05;
const maxDistMorph = 0.12;
const minDistRot = 0.02;
const maxDistRot = 0.20;

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
        width: 1280,
        height: 720
    });

    canvasElement.width = 1280;
    canvasElement.height = 720;

    await camera_utils.start();

    backgroundAudio.play().catch(e => console.log('Audio play failed:', e));
}

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    if (results.multiHandLandmarks && results.multiHandedness) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const handedness = results.multiHandedness[i].label;
            const landmarks = results.multiHandLandmarks[i];
            const color = handedness === 'Left' ? '#39d3faff' : '#cff7f0ff';

            const thumb = landmarks[4];
            const index = landmarks[8];

            canvasCtx.strokeStyle = color;
            canvasCtx.lineWidth = 15;
            canvasCtx.beginPath();
            canvasCtx.moveTo(thumb.x * canvasElement.width, thumb.y * canvasElement.height);
            canvasCtx.lineTo(index.x * canvasElement.width, index.y * canvasElement.height);
            canvasCtx.stroke();

            const midX = (thumb.x + index.x) / 2 * canvasElement.width;
            const midY = (thumb.y + index.y) / 2 * canvasElement.height;

            canvasCtx.font = 'bold 64px Arial';
            canvasCtx.textAlign = 'left';
            canvasCtx.textBaseline = 'middle';

            if (handedness === 'Right') {
                canvasCtx.fillStyle = '#d4e7d4ff';
                canvasCtx.strokeStyle = '#000000';
                canvasCtx.lineWidth = 2;
                canvasCtx.strokeText('Particle', midX + 20, midY - 20);
                canvasCtx.fillText('Particle', midX + 20, midY - 20);
            } else if (handedness === 'Left' && showSpinText) {
                canvasCtx.fillStyle = '#a5dbedff';
                canvasCtx.strokeStyle = '#ffffff';
                canvasCtx.lineWidth = 2;
                canvasCtx.strokeText('Spin', midX + 20, midY - 20);
                canvasCtx.fillText('Spin', midX + 20, midY - 20);
            }
        }
    }
    canvasCtx.restore();

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

            // --- THE FLOWER STRUCTURE ---
            const phi = (180 / 1.75) * Math.exp(-theta / (11 * 180));
            const petalCut = 0.6 + Math.abs(Math.asin(Math.sin(9.75 * theta * Math.PI / 180)) + 420 * Math.sin(9.75 * theta * Math.PI / 180)) / 3000;
            const hangDown = 3.5 * Math.pow(r, 2) * Math.pow(0.9 * r - 1, 2) * Math.sin(phi * Math.PI / 180);
            const petalRadius = r * Math.sin(phi * Math.PI / 180) + hangDown * Math.cos(phi * Math.PI / 180) ;

            // --- ADD IMPERFECTION FOR NATURAL LOOK ---
            const organicNoise = 1.0 + (Math.sin(theta * 0.5) * 0.025);
            const factor = 300 * (1 - theta / 20000) * petalCut * organicNoise;
            const pX = factor * petalRadius * Math.sin(thetaRad);
            const pY = -factor *0.4* (r * Math.cos(phi * Math.PI / 180) - hangDown * Math.sin(phi * Math.PI / 180));
            const pZ = factor * petalRadius * Math.cos(thetaRad);
            positions.push(pX, pY, pZ);

            const vColor = new THREE.Color();

            const colorCore = new THREE.Color(0x0a3d1a);
            const colorHot = new THREE.Color(0xff4d6d);
            const colorWarm = new THREE.Color(0xffb703);
            const colorCool = new THREE.Color(0x8ecae6);
            const colorWhite = new THREE.Color(0xffffff);

            if (r < 0.12) {
                vColor.copy(colorCore);
                vColor.lerp(colorHot, r * 5);
            } else {
                const huePicker = Math.sin(thetaRad * 0.1 + r * 2);

                if (huePicker > 0.3) {
                    vColor.copy(colorHot);
                } else if (huePicker > -0.3) {
                    vColor.lerpColors(colorHot, colorWarm, (huePicker + 0.3) / 0.6);
                } else {
                    vColor.lerpColors(colorWarm, colorCool, Math.abs(huePicker));
                }

                const tipLightness = Math.pow(r, 1.5);
                vColor.lerp(colorWhite, tipLightness * 0.7);
            }

            const noise = (Math.random() - 0.5) * 0.15;
            vColor.r = Math.max(0, Math.min(1, vColor.r + noise));
            vColor.g = Math.max(0, Math.min(1, vColor.g + noise));
            vColor.b = Math.max(0, Math.min(1, vColor.b + noise));

            colors.push(vColor.r, vColor.g, vColor.b);
        }
    }

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
    geometry.setAttribute('basePosition', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const randomDirections = new Float32Array(positions.length);
    const sandSpeeds = new Float32Array(positions.length / 3);

    for (let i = 0; i < positions.length; i += 3) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);

        randomDirections[i]     = Math.sin(phi) * Math.cos(theta);
        randomDirections[i + 1] = Math.sin(phi) * Math.sin(theta);
        randomDirections[i + 2] = Math.cos(phi);

        sandSpeeds[i / 3] = 0.5 + Math.random() * 1.5;
    }

    geometry.setAttribute('sandDir', new THREE.BufferAttribute(randomDirections, 3));
    geometry.setAttribute('sandSpeed', new THREE.BufferAttribute(sandSpeeds, 1));

    geometry.computeVertexNormals();
    return geometry;
}

const geometry = createDahlia(90, 1200);
const geometry1 = createDahlia(800, 800);

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
    blending: THREE.NormalBlending,
    depthWrite: false
});

const flowerMesh = new THREE.Mesh(geometry, meshMaterial);
const flowerPoints = new THREE.Points(geometry1, pointsMaterial);

const flowerSystem = new THREE.Group();
flowerSystem.add(flowerMesh);
flowerSystem.add(flowerPoints);
flowerSystem.rotation.x = 250 * Math.PI / 180;
scene.add(flowerSystem);

scene.add(new THREE.HemisphereLight(0x40e0d0, 0xff0000, 0.45));

const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);

dirLight.position.set(0, 0, 1);

camera.add(dirLight);

scene.add(camera);
let stuckTime = 0

function updateOctopusPositions(attr, baseArr, sandArr, factor, time) {
    const pos = attr.array;
    const count = attr.count;
    if(factor < 0.85){
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

        let noiseX = Math.sin(bx * f + t) * Math.cos(bz * f + t);
        let noiseZ = Math.cos(bx * f - t) * Math.sin(bz * f + t);
        
        noiseX += Math.sin(bx * f * 3.0 + t) * 0.3;
        noiseZ += Math.cos(bz * f * 3.0 + t) * 0.3;

        const expansion = 1.0 + (factor * params.expansionForce * radialPower);

        pos[i3]     = bx * expansion + (noiseX * params.noiseAmplitude * factor * radialPower) + (sandArr[i3] * params.shredDrift * factor);
        pos[i3+1]   = by + (noiseX * noiseZ * 120 * factor * radialPower);
        pos[i3+2]   = bz * expansion + (noiseZ * params.noiseAmplitude * factor * radialPower) + (sandArr[i3+2] * params.shredDrift * factor);
    }
    attr.needsUpdate = true;
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    const now = Date.now();
    const dt = (now - lastTime) / 1000.0;
    lastTime = now;

    const totalElapsed = now - startTime;

    targetMorph = 0.0;
    if (rightDist > minDistMorph) {
        targetMorph = (rightDist - minDistMorph) / (maxDistMorph - minDistMorph);
        targetMorph = Math.min(targetMorph, 1.0);
    }

    currentMorph += (targetMorph - currentMorph) * 4.0 * dt;

    if (currentMorph >= 0.85 && !morphPeaked && targetMorph > 0.8) {
        morphPeaked = true;
    }

    if (currentMorph > 0.1) {
        if (!morphPeaked) {
            morphAudio.volume = Math.max(morphAudio.volume, currentMorph * 0.7);
            if (morphAudio.paused) {
                morphAudio.currentTime = 0;
                morphAudio.play().catch(e => console.log('Morph audio failed:', e));
            }
        } else {
            morphAudio.volume += (0 - morphAudio.volume) * 0.3 * dt;
            morphAudio.volume = Math.max(0, Math.min(1, morphAudio.volume));
            if (morphAudio.volume < 0.01) {
                morphAudio.pause();
                morphAudio.volume = 0;
                morphPeaked = false;
            }
        }
    } else {
        morphAudio.pause();
        morphAudio.currentTime = 0;
        morphAudio.volume = 0;
        morphPeaked = false;
    }
    prevRightDist = rightDist;

    if (leftDist < prevLeftDist && leftDist < 0.08) {
        pulseAudio.currentTime = 0;
        pulseAudio.play().catch(e => console.log('Pulse audio failed:', e));

        const pulseAmount = Math.abs(prevLeftDist - leftDist) * 5000.0;
        rotationVelocity += pulseAmount * Math.PI / 180;

        showSpinText = true;
        spinTextTimer = 0;
    } else if (leftDist > prevLeftDist) {
        showSpinText = false;
        rotationVelocity *= 0.95;
    }
    prevLeftDist = leftDist;

    currentRotation += rotationVelocity * dt;
    rotationVelocity *= 0.98;

    if (currentMorph > 0.1) {
        rotationVelocity *= 0.95;
    }

    flowerSystem.rotation.z = currentRotation;

    if (!pulseAudio.paused) {
        pulseAudio.volume = Math.max(0.1, Math.min(0.2, rotationVelocity / 3.5));
    }

    const factor = currentMorph;

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
