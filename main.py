import pygame
import cv2
import mediapipe as mp
import numpy as np
import math
import colorsys
from OpenGL.GL import *
from OpenGL.GLU import *

# ---------------- CONFIG ----------------
WIDTH, HEIGHT = 900, 700
ROWS = 30
COLS = 600  # Higher cols for smoother spiral
SCALE = 4.6  # Match p5.js 260 scale
ROTATION_SPEED = 0.5

# ---------------- INIT ----------------
pygame.init()
screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.OPENGL | pygame.DOUBLEBUF)
clock = pygame.time.Clock()

glViewport(0, 0, WIDTH, HEIGHT)
glMatrixMode(GL_PROJECTION)
glLoadIdentity()
gluPerspective(45, WIDTH / HEIGHT, 0.1, 100)
glMatrixMode(GL_MODELVIEW)
glLoadIdentity()
glTranslatef(0, 0, -12)  # Move camera further back
glClearColor(0, 0, 0, 1)
glEnable(GL_DEPTH_TEST)  # Handle overlapping shapes
glDepthFunc(GL_LEQUAL)
glEnable(GL_BLEND)
glBlendFunc(GL_SRC_ALPHA, GL_ONE)
glEnable(GL_POINT_SMOOTH)
glHint(GL_POINT_SMOOTH_HINT, GL_NICEST)

# ---------------- FLOWER STATE ----------------
global_rotation = 0.0
bloom = 1.0

# No hand tracking, focus on flower

# ---------------- UTILS ----------------
def dist(a, b):
    return math.hypot(a.x - b.x, a.y - b.y)

import math
import numpy as np

# Parameters matching p5.js defaults
# opening = 2.0, vDensity = 8, pAlign = 3.6, curve1 = 2, curve2 = 1.3

def generate_flower_mesh(rows, cols, bloom_val):
    # t_D and r_D from your p5.js script
    t_D = (180 * 15) / cols
    r_D = 1 / rows
    
    # We use a bloom_val to influence the 'opening' variable
    # opening = 2.0 is the p5.js default
    opening = max(0.1, 12.0 - bloom_val * 10) 
    
    v = []
    for r_idx in range(rows + 1):
        layer = []
        r = r_idx # following p5 logic
        for theta in range(cols + 1):
            # Convert math to Radians for Python
            theta_deg = theta * t_D
            phi = (180 / opening) * math.exp(-theta_deg / (8 * 180)) # Density fixed at 8
            
            # Convert phi to radians for trig functions
            phi_rad = math.radians(phi)
            theta_rad = math.radians(theta_deg)
            
            # petalCut math (3.6 is the pAlign value)
            petal_align = 3.6
            p_val = (petal_align * theta_deg % 360) / 180
            petalCut = 1 - 0.5 * math.pow(1.25 * math.pow(1 - p_val, 2) - 0.25, 2)
            
            # Curvature (curve1=2, curve2=1.3)
            hangDown = 2 * math.pow(r * r_D, 2) * math.pow(1.3 * r * r_D - 1, 2) * math.sin(phi_rad)

            # Calculate coordinates (fixed orientation)
            common = petalCut * (r * r_D * math.sin(phi_rad) + hangDown * math.cos(phi_rad))
            pX = common * math.sin(theta_rad)
            pZ = common * math.cos(theta_rad)
            pY = petalCut * (r * r_D * math.cos(phi_rad) - hangDown * math.sin(phi_rad))  # Positive for upward growth
            
            # Apply scaling
            layer.append((pX * SCALE, pY * SCALE, pZ * SCALE))
        v.append(layer)
    return v
# ---------------- MAIN LOOP ----------------
running = True
time_elapsed = 0
while running:
    dt = clock.tick(60) / 1000.0
    time_elapsed += dt

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

    # Fixed bloom for normal open flower
    bloom = 1.0
    global_rotation += ROTATION_SPEED * dt

    # -------- DRAW --------
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
    glPushMatrix()
    
    # Position and Tilt
    glTranslatef(0, -1.0, -12) 
    glRotatef(65, 1, 0, 0)   # Tilted toward camera
    glRotatef(global_rotation, 0, 1, 0) 

    vertices = generate_flower_mesh(ROWS, COLS, bloom)
    r_D = 1.0 / ROWS
    for r in range(ROWS):
        glBegin(GL_QUAD_STRIP)
        for t in range(COLS + 1):
            # 1. DYNAMIC ALPHA: Outer petals (high r) are more transparent 
            # so we can see through to the inner petals.
            alpha = 0.4 + (1.0 - (r * r_D)) * 0.6  # Inner is 1.0, Outer is 0.4
            
            # 2. CONTRASTING COLORS: 
            # Inner petals more purple/magenta, outer petals more deep red/pink
            hue = 0.85 + (r * r_D) * 0.1  # Shifts from 0.85 (purple) to 0.95 (red)
            sat = 0.8
            brightness = 0.4 + (r * r_D) * 0.6 
            rgb = colorsys.hsv_to_rgb(hue, sat, brightness)
            
            # Use glColor4f to include the alpha channel
            glColor4f(rgb[0], rgb[1], rgb[2], alpha)
            
            glVertex3f(*vertices[r][t])
            glVertex3f(*vertices[r+1][t])
        glEnd()

    glPopMatrix()
    pygame.display.flip()

pygame.quit()
