"""Étude de silhouette fidèle à la référence : trois bouquets, branches et fleurs en volume.

Blender --background --factory-startup --python scripts/sakura-study.py -- [dossier-sortie]
Modèle artistique indépendant ; pas encore un sprite intégré au jeu.
"""
import bpy
import math
import os
import random
import sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
out = os.path.abspath(args[0] if args else 'screenshots/sakura-study')
os.makedirs(out, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 1100
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'Medium High Contrast'
scene.view_settings.exposure = -.2
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.72, .79, 1, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .38
# Fond bleu nuit visible par la caméra, sans teinter les lumières de la scène.
nodes, links = scene.world.node_tree.nodes, scene.world.node_tree.links
background = nodes.new('ShaderNodeBackground')
background.inputs['Color'].default_value = (.013, .020, .039, 1)
ray = nodes.new('ShaderNodeLightPath')
mix = nodes.new('ShaderNodeMixShader')
links.new(ray.outputs['Is Camera Ray'], mix.inputs[0])
links.new(nodes['Background'].outputs[0], mix.inputs[1])
links.new(background.outputs[0], mix.inputs[2])
links.new(mix.outputs[0], nodes['World Output'].inputs[0])

materials = {}
def material(hex_color):
    if hex_color not in materials:
        rgb = [int(hex_color[i:i+2], 16)/255 for i in (1, 3, 5)]
        linear = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
        m = bpy.data.materials.new(hex_color)
        m.diffuse_color = (*linear, 1)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = (*linear, 1)
        bsdf.inputs['Roughness'].default_value = .78
        materials[hex_color] = m
    return materials[hex_color]

def box(name, loc, dim, color, bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dim
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material(color))
    if bevel:
        mod = obj.modifiers.new('Arêtes délicates', 'BEVEL')
        mod.width = min(bevel, min(dim)*.14)
        mod.segments = 2
        obj.modifiers.new('Normales', 'WEIGHTED_NORMAL')
    return obj

def branch(a, b, width):
    a, b = Vector(a), Vector(b)
    obj = box('Branche', (a+b)/2, (width, width, (b-a).length), '#956038')
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()

# Terre et pelouse, comme le socle de l'illustration.
box('Terre', (0, 0, -.17), (3.10, 3.10, .32), '#855637', .018)
box('Pelouse', (0, 0, .025), (3.10, 3.10, .13), '#8fc74d', .018)
rng = random.Random(17)
patches = []
for i in range(90):
    x, y = rng.uniform(-1.46, 1.46), rng.uniform(-1.46, 1.46)
    if any(abs(x-a) < .18 and abs(y-b) < .18 for a,b in patches):
        continue
    patches.append((x,y))
    size = rng.choice([.07, .1, .14])
    box('Nuance de gazon', (x, y, .094), (size, size, .002),
        rng.choice(['#99cb54', '#88bd46', '#a3cd5b']), 0)
for i in range(14):
    t = -1.4 + i*.215
    box('Motte latérale', (t, -1.552, -.075), (.12, .006, .10),
        rng.choice(['#99663d', '#a57446', '#80ae43']), 0)
    box('Motte latérale', (1.552, t, -.075), (.006, .12, .10),
        rng.choice(['#99663d', '#a57446', '#80ae43']), 0)

# Fourche lisible : couronne haute et deux bras à des hauteurs différentes.
box('Tronc principal', (0, .04, 1.49), (.38, .38, 2.88), '#956038')
box('Écorce claire', (-.12, -.153, .96), (.09, .012, 1.76), '#a66d40', .002)
box('Écorce sombre', (.193, .10, 1.35), (.012, .08, 2.25), '#80502e', .002)
branch((-.02, .04, 1.03), (-.85, -.60, 1.65), .23)
branch((-.85, -.60, 1.65), (-.94, -.66, 2.20), .21)
branch((.07, .06, 1.24), (.89, .62, 1.94), .25)
branch((.89, .62, 1.94), (.99, .67, 2.40), .20)
box('Racine', (.15, .13, .13), (.25, .22, .15), '#8c5a36')

def flower(cx, cy, cz, scale, face):
    # Cinq petits cubes en relief ; chaque pétale reçoit ses propres ombres.
    for u, v, color in [(-1, 0, '#ffe6ed'), (1, 0, '#ffe8ef'),
                         (0, 1, '#ffedf1'), (0, -1, '#ffd8e6'), (0, 0, '#ffd579')]:
        s = .112*scale
        depth = .065*scale
        if face == 'front':
            loc, dim = (cx+u*s, cy, cz+v*s), (s*.96, depth, s*.96)
        elif face == 'right':
            loc, dim = (cx, cy+u*s, cz+v*s), (depth, s*.96, s*.96)
        else:
            loc, dim = (cx+u*s, cy+v*s, cz), (s*.96, s*.96, depth)
        box('Cœur doré' if u == v == 0 else 'Pétale en relief', loc, dim, color, .004)

def bouquet(name, center, scale):
    cx, cy, cz = center
    # Des lobes cubiques imbriqués, une base irrégulière et un sommet étagé.
    lobes = [
        (0, 0, .47, .96, .96, .76, '#f395bb'),
        (-.51, -.03, .38, .43, .67, .57, '#f394b9'),
        (.50, .06, .34, .47, .65, .60, '#f28eb7'),
        (.03, -.49, .33, .67, .46, .60, '#f79cc2'),
        (-.08, .49, .42, .67, .43, .59, '#ed87b0'),
        (-.30, -.37, .10, .34, .34, .34, '#ee8bb4'),
        (.38, -.33, .05, .34, .37, .35, '#f497be'),
        (-.36, .34, .12, .32, .36, .34, '#e880aa'),
        (.32, .37, .10, .38, .36, .38, '#ec87af'),
        (.02, .03, .99, .65, .67, .35, '#f8a7ca'),
        (.08, .06, 1.23, .29, .30, .14, '#ffb5d4'),
        (-.43, .31, .73, .28, .28, .24, '#f9a3c6'),
        (.40, -.24, .70, .28, .30, .27, '#fba8cd'),
    ]
    for x, y, z, w, d, h, color in lobes:
        box(name, (cx+x*scale, cy+y*scale, cz+z*scale),
            (w*scale, d*scale, h*scale), color, .009)
    for x, y, z, face, factor in [
        (.02, -.735, .38, 'front', 1),
        (.755, .04, .38, 'right', 1),
        (.05, -.324, 1.00, 'front', .88),
        (-.49, -.377, .41, 'front', .88),
        (.36, -.27, .85, 'top', .78),
    ]:
        flower(cx+x*scale, cy+y*scale, cz+z*scale, scale*factor, face)

# Disposition de l'image : petit bouquet bas à gauche, moyen à droite, grand au sommet.
bouquet('Bouquet gauche', (-.94, -.66, 1.58), .96)
bouquet('Bouquet droit', (.99, .67, 1.86), 1.04)
bouquet('Couronne haute', (-.10, .10, 2.83), 1.11)

for x, y in [(-1.16, .70), (.85, 1.15), (-.8, -1.15), (.50, -.80)]:
    for dx, dy, height in [(0, 0, .24), (.14, .05, .16), (-.09, .15, .31)]:
        box('Brin cubique', (x+dx, y+dy, .09+height/2), (.12, .12, height), '#82b840')
for x, y in [(-1.19,-.65), (-.5,-1.15), (.15,-1.0), (1.19,-.9),
             (.7,-.45), (1.15,.15), (-.65,.7), (-1.25,.12)]:
    petal = box('Pétale au sol', (x,y,.117), (.15,.12,.035), '#ffb2d0', .005)
    petal.rotation_euler.z = rng.uniform(-.4, .4)
for x, y, z in [(-1.55,-.36,2.9), (1.48,.54,3.23),
                 (-1.5,-.8,1.30), (1.47,.23,1.38)]:
    petal = box('Pétale suspendu', (x,y,z), (.13,.035,.13), '#ffacd0', .012)
    petal.rotation_euler = (.15, .5, -.3)

def point_at(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

for name, loc, power, size, color in [
    ('Lumière de gauche', (-3,-4,7), 480, 4.5, (1,.94,.9)),
    ('Débouchage', (4,-1,5), 95, 5, (.9,.94,1)),
    ('Liseré', (0,4,6), 180, 3, (1,.87,.91)),
]:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.size, data.color = power, size, color
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = loc
    point_at(obj, (0,0,2))
camera_data = bpy.data.cameras.new('Caméra de présentation')
camera = bpy.data.objects.new('Caméra', camera_data)
scene.collection.objects.link(camera)
camera.location = (7,-9,9.2)
point_at(camera, (0,0,1.8))
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 6.0
scene.camera = camera
bpy.context.view_layer.update()
bounds = [world_to_camera_view(scene, camera, obj.matrix_world @ Vector(corner))
          for obj in scene.objects if obj.type == 'MESH' for corner in obj.bound_box]
cx = (min(p.x for p in bounds)+max(p.x for p in bounds))/2
cy = (min(p.y for p in bounds)+max(p.y for p in bounds))/2
camera.location += camera.rotation_euler.to_quaternion() @ Vector(((cx-.5)*6, (cy-.5)*6, 0))
scene.render.filepath = os.path.join(out, 'sakura.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,'sakura.blend'))
bpy.ops.render.render(write_still=True)
print('SAKURA_STUDY_OK', flush=True)
