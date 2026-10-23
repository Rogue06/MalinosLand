"""À exécuter après ouverture de sakura.blend, depuis Blender ou son MCP.

Exporte quatre vues transparentes dans //../blender-frames/sakura-study-N.png.
Ne sauvegarde pas les transformations dans le modèle de présentation.
"""
import bpy
import math
from mathutils import Vector

scene = bpy.context.scene
for obj in list(scene.objects):
    if obj.name.startswith(('Terre', 'Pelouse', 'Nuance de gazon', 'Motte latérale',
                            'Brin cubique', 'Pétale au sol')):
        bpy.data.objects.remove(obj, do_unlink=True)

root = bpy.data.objects.new('Pivot jeu', None)
scene.collection.objects.link(root)
for obj in list(scene.objects):
    if obj.type == 'MESH':
        obj.parent = root
# Le modèle dessiné dans Blender regarde -Y ; le jeu regarde +Y.
# La réduction donne un arbre de 2,4 unités, et non un arbre géant.
root.scale = (.57, .57, .57)
projection = bpy.data.objects.new('Projection jeu', None)
scene.collection.objects.link(projection)
root.parent = projection
projection.location = (.5, -.5, 0)
projection.scale = (1, 1, math.sqrt(2 / 3))

width, height, scale = 384, 480, 3
anchor_y = 136 * scale
camera = scene.camera
camera.location = (6, -6, math.sqrt(24))
camera.rotation_euler = (-camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = height / (32 * scale * math.sqrt(2))
up = camera.rotation_euler.to_quaternion() @ Vector((0, 1, 0))
camera.location += up * ((anchor_y - height / 2) / (32 * scale * math.sqrt(2)))
scene.render.resolution_x = width
scene.render.resolution_y = height
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.color_mode = 'RGBA'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
for rotation in range(4):
    root.rotation_euler.z = rotation * math.pi / 2
    scene.render.filepath = bpy.path.abspath('//../blender-frames/sakura-study-' + str(rotation) + '.png')
    bpy.ops.render.render(write_still=True)
    print('SAKURA_GAME_OK', rotation)
