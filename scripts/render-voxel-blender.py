"""Rendus locaux reproductibles, Blender 4.4+. Aucune extension ni service distant.

blender --background --factory-startup --python scripts/render-voxel-blender.py -- [source.json] [sortie] [nom-optionnel]
Les modèles proviennent de scripts/export-voxel-models.mjs. Les PNG ont une ancre commune.
"""
import bpy
import json
import math
import os
import sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
source = args[0] if args else 'art-source/voxel-models.json'
out = os.path.abspath(args[1] if len(args) > 1 else 'screenshots/blender-frames')
only = args[2] if len(args) > 2 else None
os.makedirs(out, exist_ok=True)
models = json.load(open(source, encoding='utf-8'))['models']
W, H, SCALE = 384, 512, 4
ANCHOR = (192, 416)
Z_CORRECTION = math.sqrt(2 / 3)

# Cette scène vierge est un processus séparé ; elle ne touche pas aux fichiers Blender ouverts.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.cycles.device = 'CPU'
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'Medium High Contrast'
scene.world.color = (0.35, 0.35, 0.35)
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.72, 0.80, 1.0, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.55

def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

camera_data = bpy.data.cameras.new('Isométrique 2 pour 1')
camera = bpy.data.objects.new('Caméra', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera.location = (6, -6, math.sqrt(24))
point_at(camera, (0, 0, 0))
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 4
bpy.context.view_layer.update()
p0 = world_to_camera_view(scene, camera, Vector((0, 0, 0)))
p1 = world_to_camera_view(scene, camera, Vector((1, 0, 0)))
camera_data.ortho_scale *= (p1.x - p0.x) * W / (32 * SCALE)
bpy.context.view_layer.update()
up = camera.rotation_euler.to_quaternion() @ Vector((0, 1, 0))
p0 = world_to_camera_view(scene, camera, Vector((0, 0, 0)))
pup = world_to_camera_view(scene, camera, up)
offset = (p0.y - (1 - ANCHOR[1] / H)) / (pup.y - p0.y)
camera.location += up * offset
bpy.context.view_layer.update()

def projected(v):
    p = world_to_camera_view(scene, camera, Vector(v))
    return (p.x * W, (1 - p.y) * H)

origin = projected((0, 0, 0))
x_axis = projected((1, 0, 0))
z_axis = projected((0, 0, Z_CORRECTION))
assert abs(origin[0] - ANCHOR[0]) < .01 and abs(origin[1] - ANCHOR[1]) < .01
assert abs(x_axis[0] - origin[0] - 32*SCALE) < .01
assert abs(x_axis[1] - origin[1] - 16*SCALE) < .01
assert abs(z_axis[1] - origin[1] + 32*SCALE) < .01

for name, location, energy, size, color in [
    ('Lumière douce',(-3, -4, 7),550,4,(1.0,.92,.83)),
    ('Reflet de face',(4,3,5),180,5,(.82,.90,1.0)),
]:
    light_data = bpy.data.lights.new(name, 'AREA')
    light_data.energy, light_data.size, light_data.color = energy, size, color
    light = bpy.data.objects.new(name, light_data)
    scene.collection.objects.link(light)
    light.location = location
    point_at(light, (0.5, 0.5, .7))

materials = {}
def material(color):
    if color in materials:
        return materials[color]
    rgb = [int(color[i:i+2],16)/255 for i in (1,3,5)]
    linear = [v/12.92 if v < .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m = bpy.data.materials.new(color)
    m.diffuse_color = (*linear, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*linear, 1)
    bsdf.inputs['Roughness'].default_value = .72
    materials[color] = m
    return m

def block(name, location, dimensions, color, collection, bevel=True):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(material(color))
    if bevel:
        mod = obj.modifiers.new('Arêtes douces', 'BEVEL')
        mod.width = min(.009, min(dimensions) * .12)
        mod.segments = 2
        normal = obj.modifiers.new('Normales des faces', 'WEIGHTED_NORMAL')
        normal.keep_sharp = True
    return obj

def decal(spec, dc, collection, i, layer):
    x,y,z,w,d,h = [spec[k] for k in ('x','y','z','w','d','h')]
    u0,v0,u1,v1 = [dc[k] for k in ('u0','v0','u1','v1')]
    uc,vc,du,dv = (u0+u1)/2,(v0+v1)/2,u1-u0,v1-v0
    # Les motifs se superposent dans l'ordre du Canvas : éviter des faces coplanaires en 3D.
    face, e = dc['face'], .001 + layer * .0004
    if face == 'py':
        loc, dim = (x+uc*w,y+d+e,z+vc*h),(du*w,.002,dv*h)
    elif face == 'ny':
        loc, dim = (x+(1-uc)*w,y-e,z+vc*h),(du*w,.002,dv*h)
    elif face == 'px':
        loc, dim = (x+w+e,y+(1-uc)*d,z+vc*h),(.002,du*d,dv*h)
    elif face == 'nx':
        loc, dim = (x-e,y+uc*d,z+vc*h),(.002,du*d,dv*h)
    else:
        loc, dim = (x+uc*w,y+(1-vc)*d,z+h+e),(du*w,dv*d,.002)
    block(f'Détail {i}',loc,dim,dc['color'],collection,False)

for name, model in models.items():
    if only and name != only:
        continue
    for collection in list(bpy.data.collections):
        if collection.name.startswith('Modèle '):
            for obj in list(collection.objects):
                bpy.data.objects.remove(obj, do_unlink=True)
            bpy.data.collections.remove(collection)
    collection = bpy.data.collections.new(f'Modèle {name}')
    scene.collection.children.link(collection)
    for i, spec in enumerate(model['boxes']):
        x,y,z,w,d,h = [spec[k] for k in ('x','y','z','w','d','h')]
        block(f'Volume {i}',(x+w/2,y+d/2,z+h/2),(w,d,h),spec['color'],collection)
        for j, dc in enumerate(spec.get('decals', [])):
            decal(spec, dc, collection, f'{i}-{j}', j)
    # Rotation identique à rotatePoint(), autour du centre de l'empreinte.
    root = bpy.data.objects.new('Pivot',None)
    collection.objects.link(root)
    root.location = (model['pivot']/2, model['pivot']/2, 0)
    for obj in list(collection.objects):
        if obj != root:
            obj.location.x -= root.location.x
            obj.location.y -= root.location.y
            obj.parent = root
    root.rotation_euler.z = -model['rotation'] * math.pi/2
    projection = bpy.data.objects.new('Projection Phaser', None)
    collection.objects.link(projection)
    root.parent = projection
    projection.scale = (1, -1, Z_CORRECTION)
    scene.render.filepath = os.path.join(out, name+'.png')
    bpy.ops.render.render(write_still=True)
    if name in ('avatar-py-idle','oak-0','sakura-0'):
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,name+'.blend'))
    print(f'VOXEL_RENDER_OK {name}',flush=True)

json.dump({'width':W,'height':H,'scale':SCALE,'anchorX':ANCHOR[0],'anchorY':ANCHOR[1]},open(os.path.join(out,'frames.json'),'w'),indent=2)
