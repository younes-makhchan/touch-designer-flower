# Touch Designer Flower

A interactive 3D flower visualization using Three.js and MediaPipe Hand Tracking. Control the flower with hand gestures: morph (right hand open/close) and spin (left hand squeeze). Full-screen webcam overlay for immersive experience, optimized for recording.

## Features
- **Hand Tracking**: Uses MediaPipe to detect thumb-index distance for gestures.
- **Morph Effect**: Open right hand to "shred" and whip the flower petals with noise and expansion.
- **Spin Pulse**: Squeeze left hand to rotate the flower with momentum.
- **Audio Feedback**: Background music, morph swish, and pulse sounds.
- **Visual Overlays**: "Particle" label on right hand, "Spin" flash on left during pulse.
- **High-Res Video**: Full-screen HD webcam (1280x720) behind 3D scene for recording.

## Demo
https://user-images.githubusercontent.com/74161217/531730370-45c1f903-89b6-47e0-842b-9f7ca7d11e70.mp4

A short video demo showing hand gestures controlling the interactive flower visualization.

## Project Structure
```
touch-designer-flower/
├── README.md                 
├── .gitignore
├── assets/
│   ├── audio/
│   │   ├── background.mp3   
│   │   ├── swosh.mpeg       
│   │   └── pow.mpeg         
│── index.html           # Entry point with Three.js and MediaPipe scripts
│── script.js            # Core logic: scene, hand tracking, animations
│── style.css            
```

## Setup & Run
1. **Prerequisites**:
   - Modern browser (Chrome recommended for MediaPipe).
   - Webcam access.

2. **Run**:
   - Open `index.html` in browser.
   - Allow webcam permission.
   - Position hands in frame; right for morph, left for spin.

3. **Controls**:
   - **Right Hand**: Open fingers to morph (petals whip/expand); close to relax.
   - **Left Hand**: Squeeze fist to pulse-spin the flower; release to stop.
   - **Mouse**: Orbit/zoom the 3D view with OrbitControls.

## Customization
- **Params in script.js**: Tweak `expansionForce`, `noiseAmplitude`, thresholds like `minDistMorph = 0.05`.
- **Audio**: Replace MP3/MPEG files in assets/audio.
- **Visuals**: Modify colors in createDahlia(), or opacity in animate().

## Troubleshooting
- **Low FPS**: Reduce resolution in script.js (width/height) or modelComplexity in hands.setOptions().
- **No Hand Detection**: Check webcam, lighting; ensure maxNumHands: 2.
- **Audio Issues**: Ensure files load; catch errors logged to console.

## Tech Stack
- **Three.js**: 3D rendering and controls.
- **MediaPipe Hands**: Real-time hand landmark detection.
- **HTML5 Canvas**: Video overlay and 2D drawing.
- **Web Audio API**: Sound effects.

## License
MIT - Feel free to use/modify.

For issues or contributions, open a GitHub issue.
