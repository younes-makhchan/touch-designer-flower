import pygame
import cv2
import mediapipe as mp
import numpy as np
import math
from OpenGL.GL import *
from OpenGL.GLU import *

# ---------------- CONFIG ----------------
WIDTH, HEIGHT = 900, 700
ROWS = 40
SCALE = 0.0074
ROTATION_SPEED = 0.5

class Flower:
    def __init__(self):
        self.points, self.colors = self._generate_data()

    def _generate_data(self):
        points = []
        colors = []
        for r_val in np.arange(0, 1.01, 0.025):
            for theta in np.arange(0, 180 * 20, 3.0):
                phi = (180 / 2) * math.exp(-theta / (16 * 180))
                phi_rad = math.radians(phi)
                theta_rad = math.radians(theta)
                petalCut = 0.75 + abs(math.asin(math.sin(math.radians(2.75 * theta))))
                hangDown = 1.3 * math.pow(r_val, 2) * math.pow(1.25 * r_val - 1, 2) * math.sin(phi_rad)
                taper = (1 - theta / 6500)
                common = taper * petalCut * (r_val * math.sin(phi_rad) + hangDown * math.cos(phi_rad))

                pX = 300 * common * math.sin(theta_rad) * SCALE
                pZ = 300 * common * math.cos(theta_rad) * SCALE
                pY = 300 * taper * petalCut * (r_val * math.cos(phi_rad) - hangDown * math.sin(phi_rad)) * SCALE

                points.append([pX, pY, pZ, r_val])

                # Pre-calc Colors
                color_top = np.array([1.0, 0.2, 0.4])
                color_bottom = np.array([0.5, 0.0, 1.0])
                color_side = np.array([0.0, 0.6, 1.0])

                yw, ynw, sw = max(0, pY), max(0, -pY), max(0, abs(pX))
                total = yw + ynw + sw
                mixed = (color_top * yw + color_bottom * ynw + color_side * sw) / (total if total > 0 else 1)
                colors.append(mixed)

        return np.array(points, dtype=np.float32), np.array(colors, dtype=np.float32)

class Renderer:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.OPENGL | pygame.DOUBLEBUF)
        self.clock = pygame.time.Clock()
        self._setup_opengl()

    def _setup_opengl(self):
        glViewport(0, 0, WIDTH, HEIGHT)
        glMatrixMode(GL_PROJECTION)
        glLoadIdentity()
        gluPerspective(45, WIDTH / HEIGHT, 0.1, 100)
        glMatrixMode(GL_MODELVIEW)
        glClearColor(0, 0, 0, 1)
        glEnable(GL_DEPTH_TEST)
        glEnable(GL_BLEND)
        glBlendFunc(GL_SRC_ALPHA, GL_ONE)
        glEnable(GL_POINT_SMOOTH)

    def draw(self, flower, time_elapsed, rotation_angle, morph_factor, texture):
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
        glLoadIdentity()

        # 1. Camera Depth
        glTranslatef(0, -1.0, -15)

        # 2. THE REQUESTED TILT: 20 degrees between XY and XZ planes
        glRotatef(20, 1, 1, 0)

        # 3. BASE ORIENTATION (To see the flower face)
        glRotatef(35, 1, 0, 0)

        # 4. HAND CONTROLLED ROTATION (Now on Z-Axis)
        glRotatef(rotation_angle, 0, 0, 1)

        glPointSize(2.0)
        glBegin(GL_POINTS)

        for i in range(len(flower.points)):
            p = flower.points[i]
            orig_x, orig_y, orig_z, r_val = p

            # Sequential melting based on hand control
            local_morph = max(0, morph_factor - (1.0 - r_val) * 0.7)
            wave = time_elapsed * 0.8

            dx = orig_x + math.sin(orig_y * 1.2 + wave) * 2.5 * local_morph
            dy = orig_y - (r_val * 6.0 * local_morph) + math.cos(orig_x * 1.2 + wave) * local_morph
            dz = orig_z + math.sin(orig_x * 1.2 + wave) * 2.5 * local_morph

            # White glow
            dist = math.sqrt(dx*dx + dy*dy + dz*dz) / 4.0
            white_f = math.pow(max(0, 1.0 - dist), 1.5)

            c = flower.colors[i]
            fr, fg, fb = c * (1 - white_f) + white_f
            alpha = 0.65 * (1.0 - local_morph * 0.3)

            glColor4f(fr, fg, fb, alpha)
            glVertex3f(dx, dy, dz)

        glEnd()

        # Draw camera overlay
        glMatrixMode(GL_PROJECTION)
        glPushMatrix()
        glLoadIdentity()
        glOrtho(0, WIDTH, 0, HEIGHT, -1, 1)
        glMatrixMode(GL_MODELVIEW)
        glPushMatrix()
        glLoadIdentity()
        glDisable(GL_DEPTH_TEST)
        glDisable(GL_LIGHTING)
        glEnable(GL_TEXTURE_2D)
        glBindTexture(GL_TEXTURE_2D, texture)
        glBegin(GL_QUADS)
        glTexCoord2f(0, 0); glVertex2f(10, HEIGHT - 210)
        glTexCoord2f(1, 0); glVertex2f(310, HEIGHT - 210)
        glTexCoord2f(1, 1); glVertex2f(310, HEIGHT - 10)
        glTexCoord2f(0, 1); glVertex2f(10, HEIGHT - 10)
        glEnd()
        glDisable(GL_TEXTURE_2D)
        glEnable(GL_DEPTH_TEST)
        glMatrixMode(GL_PROJECTION)
        glPopMatrix()
        glMatrixMode(GL_MODELVIEW)
        glPopMatrix()

        pygame.display.flip()

class HandTracker:
    def __init__(self):
        self.cap = cv2.VideoCapture(0)
        BaseOptions = mp.tasks.BaseOptions
        HandLandmarker = mp.tasks.vision.HandLandmarker
        HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
        VisionRunningMode = mp.tasks.vision.RunningMode

        options = HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path='hand_landmarker.task'),
            running_mode=VisionRunningMode.IMAGE,
            num_hands=2
        )
        self.landmarker = HandLandmarker.create_from_options(options)
        self.texture = glGenTextures(1)

    def get_hand_data(self):
        ret, frame = self.cap.read()
        if not ret:
            return None, None, None

        frame = cv2.flip(frame, -1)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        results = self.landmarker.detect(mp_image)

        # Draw hand landmarks on frame for visual feedback
        h, w, _ = frame.shape
        if results.hand_landmarks and results.handedness:
            for i, hand_landmarks in enumerate(results.hand_landmarks):
                handedness = results.handedness[i][0].category_name
                color = (0, 255, 0) if handedness == 'Left' else (0, 0, 255)  # Green for left, Red for right

                for landmark in hand_landmarks:
                    x = int(landmark.x * w)
                    y = int(landmark.y * h)
                    cv2.circle(frame, (x, y), 5, color, -1)

        # Prepare texture
        small_frame = cv2.resize(frame, (300, 200))
        small_rgb = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        glBindTexture(GL_TEXTURE_2D, self.texture)
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, 300, 200, 0, GL_RGB, GL_UNSIGNED_BYTE, small_rgb.tobytes())
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR)
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR)

        left_dist = 0
        right_dist = 0

        if results.hand_landmarks and results.handedness:
            for i, hand_landmarks in enumerate(results.hand_landmarks):
                handedness = results.handedness[i][0].category_name
                thumb = hand_landmarks[4]
                index = hand_landmarks[8]
                dist = math.hypot(thumb.x - index.x, thumb.y - index.y)

                if handedness == 'Left':
                    left_dist = dist
                elif handedness == 'Right':
                    right_dist = dist

        return left_dist, right_dist, self.texture

    def close(self):
        self.cap.release()
        self.landmarker.close()

class App:
    def __init__(self):
        self.flower = Flower()
        self.renderer = Renderer()
        self.hand_tracker = HandTracker()
        self.time_elapsed = 0
        self.running = True

        # --- SENSITIVITY SETTINGS ---
        self.min_dist_morph = 0.06   # Threshold for melting
        self.max_dist_morph = 0.28

        self.min_dist_rot = 0.05     # Threshold for rotation
        self.max_dist_rot = 0.30     # Max distance for full spin speed

        self.current_morph = 0.0
        self.current_rotation = 65

    def run(self):
        while self.running:
            dt = self.renderer.clock.tick(60) / 1000.0
            self.time_elapsed += dt

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False

            left_dist, right_dist, texture = self.hand_tracker.get_hand_data()

            # --- 1. SMOOTH MORPH (Left Hand) ---
            target_morph = 0.0
            if left_dist > self.min_dist_morph:
                target_morph = (left_dist - self.min_dist_morph) / (self.max_dist_morph - self.min_dist_morph)
                target_morph = np.clip(target_morph, 0.0, 1.0)

            # Interpolate for "liquid" feel
            self.current_morph += (target_morph - self.current_morph) * 4.0 * dt

            # --- 2. CONTROLLED ROTATION (Right Hand) ---
            target_rot_speed = 0.0
            if right_dist > self.min_dist_rot:
                # Map finger distance to a rotation speed (degrees per second)
                target_rot_speed = (right_dist - self.min_dist_rot) / (self.max_dist_rot - self.min_dist_rot)
                target_rot_speed = np.clip(target_rot_speed, 0.0, 1.0) * 180.0 # Max 180 deg/sec

            # Increment the angle over time for smooth continuous spin
            self.current_rotation += target_rot_speed * dt

            self.renderer.draw(self.flower, self.time_elapsed, self.current_rotation, self.current_morph, texture)

        self.hand_tracker.close()
        pygame.quit()

if __name__ == "__main__":
    app = App()
    app.run()
