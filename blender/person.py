# Builds the people's body and clothes in Blender, around the skeleton the site animates them with.
#
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python blender/person.py -- <out.glb> [preview-dir]
#
# blender/joints.json holds where each joint is in the pose the body is bound in (from actor.ts, bindPose()).
# The body is grown around those joints with the Skin modifier and smoothed, so shoulders, elbows, hips and
# knees flow into each other. Blender works out the skin weights. The clothes are cut from the body's own
# surface and pushed outwards, so they carry the same weights and move exactly with it: nothing pokes through.
# Head, hair, hands and shoes stay in the site's code (character.ts): scripted heads and hair came out
# worse than the ones built there.

import bpy, bmesh, json, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.path.dirname(__file__), 'person.glb')
PREVIEW = argv[1] if len(argv) > 1 else None
HERE = os.path.dirname(os.path.abspath(__file__))
JOINTS = {j['name']: j for j in json.load(open(os.path.join(HERE, 'joints.json')))}


def B(p):
    """The site's coordinates (y up, facing +z) to Blender's (z up, facing -y)."""
    return Vector((p[0], -p[2], p[1]))


def T(v):
    """And back."""
    return (v.x, v.z, -v.y)


def at(name):
    return B(JOINTS[name]['at'])


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------- The skeleton ----------------

arm_data = bpy.data.armatures.new('Rig')
rig = bpy.data.objects.new('Rig', arm_data)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
CHILD = {'pelvis': 'spine_01', 'spine_01': 'spine_02', 'spine_02': 'spine_03', 'spine_03': 'neck_01', 'neck_01': 'Head'}
for c in 'lr':
    CHILD.update({f'clavicle_{c}': f'upperarm_{c}', f'upperarm_{c}': f'lowerarm_{c}', f'lowerarm_{c}': f'hand_{c}', f'thigh_{c}': f'calf_{c}', f'calf_{c}': f'foot_{c}', f'foot_{c}': f'ball_{c}'})
bones = {}
for name, j in JOINTS.items():
    b = arm_data.edit_bones.new(name)
    b.head = at(name)
    if name in CHILD:
        b.tail = at(CHILD[name])
    elif name == 'Head':
        b.tail = b.head + Vector((0, 0, 0.25))
    elif name.startswith('hand'):
        b.tail = b.head + (at(name) - at('lowerarm_' + name[-1])).normalized() * 0.1
    elif name.startswith('ball'):
        b.tail = b.head + Vector((0, -0.08, 0))
    else:
        b.tail = b.head + Vector((0, 0, 0.1))
    b.use_deform = name != 'root'
    bones[name] = b
for name, j in JOINTS.items():
    if j['parent']:
        bones[name].parent = bones[j['parent']]
bpy.ops.object.mode_set(mode='OBJECT')

# ---------------- The body ----------------
# A stick figure of points with a thickness at each: the Skin modifier wraps it in one surface.

pts, radii, edges = [], [], []


def point(p, r, rz=None):
    pts.append(B(p))
    radii.append((r, rz if rz is not None else r))
    return len(pts) - 1


def line(*ids):
    for a, b in zip(ids, ids[1:]):
        edges.append((a, b))


hips = point((0, 0.885, -0.01), 0.15, 0.165)
waist = point((0, 0.99, -0.005), 0.132, 0.145)
chest = point((0, 1.11, 0.0), 0.15, 0.165)
top = point((0, 1.205, -0.005), 0.135, 0.145)
neck = point((0, 1.3, -0.012), 0.045, 0.047)
neck2 = point((0, 1.345, -0.018), 0.038, 0.04)
line(hips, waist, chest, top, neck, neck2)
for s in (1, -1):
    c = 'l' if s > 0 else 'r'
    # legs
    x = s * 0.088
    leg = [
        point((x, 0.80, 0.0), 0.075),
        point((x, 0.66, 0.004), 0.062),
        point((x, 0.53, 0.004), 0.05),
        point((x, 0.47, 0.006), 0.045),
        point((x, 0.37, -0.008), 0.049, 0.05),
        point((x, 0.25, -0.004), 0.04),
        point((x, 0.15, 0.0), 0.033),
        point((x, 0.085, 0.0), 0.031),
    ]
    line(hips, *leg)
    # arms, wherever the bind pose puts them
    S, E, W = (Vector(JOINTS[f'{n}_{c}']['at']) for n in ('upperarm', 'lowerarm', 'hand'))
    shoulder = point((s * 0.13, 1.215, -0.008), 0.06, 0.055)
    arm = [
        point(tuple(S), 0.046),
        point(tuple(S.lerp(E, 0.5)), 0.041),
        point(tuple(E), 0.035),
        point(tuple(E.lerp(W, 0.45)), 0.035, 0.031),
        point(tuple(W), 0.027, 0.025),
    ]
    line(top, shoulder, *arm)


mesh = bpy.data.meshes.new('Body')
mesh.from_pydata(pts, edges, [])
body = bpy.data.objects.new('Body', mesh)
scene.collection.objects.link(body)
skin = body.modifiers.new('skin', 'SKIN')
skin.branch_smoothing = 0.6
skin.use_smooth_shade = True
for i, r in enumerate(radii):
    body.data.skin_vertices[0].data[i].radius = r
body.data.skin_vertices[0].data[hips].use_root = True
sub = body.modifiers.new('sub', 'SUBSURF')
sub.levels = 1
bpy.context.view_layer.objects.active = body
for m in list(body.modifiers):
    bpy.ops.object.modifier_apply(modifier=m.name)
bpy.ops.object.shade_smooth()

# ---------------- Weights ----------------

body.parent = rig
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# ---------------- Clothes, cut from the body ----------------


def along_arm(v3):
    """How far down the arm a point is, from the shoulder joint (negative: not on an arm)."""
    best = -1
    for c in 'lr':
        S = Vector(JOINTS[f'upperarm_{c}']['at'])
        E = Vector(JOINTS[f'lowerarm_{c}']['at'])
        d = (E - S).normalized()
        p = Vector(v3)
        if (p.x > 0) != (S.x > 0) or abs(p.x) < 0.12:
            continue
        best = max(best, (p - S).dot(d))
    return best


def garment(name, cuts, push, drop=None):
    """
    A copy of the body, sliced clean by planes and pushed outwards by push(point).
    cuts: (point, normal, region): everything beyond the plane (on the normal's side) goes, but only among
    the vertices for which region(point) holds (so cutting a sleeve does not cut into the chest).
    drop(point): parts that go entirely (the arms, for a pair of shorts).
    """
    bm = bmesh.new()
    bm.from_mesh(body.data)
    if drop:
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if all(drop(T(v.co)) for v in f.verts)], context='FACES')
    for co, no, region in cuts:
        inside = [f for f in bm.faces if any(region(T(v.co)) for v in f.verts)]
        geom = list({e for f in inside for e in f.edges}) + inside + list({v for f in inside for v in f.verts})
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=B(co), plane_no=B(no) - B((0, 0, 0)), clear_outer=True, dist=0.0001)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * push(T(v.co))
    m = bpy.data.meshes.new(name)
    bm.to_mesh(m)
    bm.free()
    o = bpy.data.objects.new(name, m)
    scene.collection.objects.link(o)
    # the vertex groups (weights) came along with the copied vertices
    for g in body.vertex_groups:
        o.vertex_groups.new(name=g.name)
    o.parent = rig
    mod = o.modifiers.new('rig', 'ARMATURE')
    mod.object = rig
    thick = o.modifiers.new('cloth', 'SOLIDIFY')
    thick.thickness = 0.004
    thick.offset = -1
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='cloth')
    bpy.ops.object.shade_smooth()
    return o


def arm_cut(c, a, towards_hand=True):
    """A plane across the arm on side c, a metres down from the shoulder joint; it only cuts that arm.
    It takes away what lies towards the hand (or, with towards_hand=False, towards the shoulder)."""
    S = Vector(JOINTS[f'upperarm_{c}']['at'])
    E = Vector(JOINTS[f'lowerarm_{c}']['at'])
    d = (E - S).normalized()
    side = 1 if S.x > 0 else -1
    return (tuple(S + d * a), tuple(d if towards_hand else -d), lambda p: p[0] * side > 0.16)


def tee_push(p):
    a = along_arm(p)
    if a >= 0:
        return 0.016 + 0.014 * max(0, a) / 0.13  # the sleeve opens up towards its end
    return 0.016 + max(0, 0.92 - p[1]) * 0.12  # and the hem hangs a little loose


def shorts_push(p):
    return 0.011 + max(0, 0.72 - p[1]) * 0.09


everywhere = lambda p: True
tee = garment('Tee', [((0, 1.315, 0), (0, 1, 0), everywhere), ((0, 0.8, 0), (0, -1, 0), everywhere), arm_cut('l', 0.13), arm_cut('r', 0.13)], tee_push)
shorts = garment('Shorts', [((0, 0.9, 0), (0, 1, 0), everywhere), ((0, 0.53, 0), (0, -1, 0), everywhere)], shorts_push, drop=lambda p: abs(p[0]) > 0.17 and p[1] > 0.75)
# the same, long: sleeves to the wrist, legs to the ankle
SLEEVE = (Vector(JOINTS['upperarm_l']['at']) - Vector(JOINTS['lowerarm_l']['at'])).length + (Vector(JOINTS['lowerarm_l']['at']) - Vector(JOINTS['hand_l']['at'])).length - 0.02
long_tee = garment('LongTee', [((0, 1.315, 0), (0, 1, 0), everywhere), ((0, 0.8, 0), (0, -1, 0), everywhere), arm_cut('l', SLEEVE), arm_cut('r', SLEEVE)], lambda p: 0.016 + (0.006 if along_arm(p) >= 0 else max(0, 0.92 - p[1]) * 0.12))
trousers = garment('Trousers', [((0, 0.9, 0), (0, 1, 0), everywhere), ((0, 0.1, 0), (0, -1, 0), everywhere)], lambda p: 0.012 + max(0, 0.3 - p[1]) * 0.03, drop=lambda p: abs(p[0]) > 0.17 and p[1] > 0.75)


def hidden(p):
    """Body that is always under the clothes: left out, so nothing can show through."""
    a = along_arm(p)
    if a >= 0:
        return a < 0.09
    return 0.6 < p[1] < 1.27


bm = bmesh.new()
bm.from_mesh(body.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if all(hidden(T(v.co)) for v in f.verts)], context='FACES')
bm.to_mesh(body.data)
bm.free()

parts = [body, tee, shorts, long_tee, trousers]
for o in parts:
    print(o.name, 'verts', len(o.data.vertices), 'faces', len(o.data.polygons))

# ---------------- Export ----------------

bpy.ops.object.select_all(action='DESELECT')
for o in [rig] + parts:
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    use_selection=True,
    export_skins=True,
    export_animations=False,
    export_morph=False,
    export_materials='NONE',
    export_texcoords=False,
    export_normals=True,
    export_yup=True,
)
print('wrote', OUT, os.path.getsize(OUT))

# ---------------- Preview renders ----------------

if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    for o, col in ((body, (0.85, 0.65, 0.5, 1)), (tee, (0.25, 0.45, 0.6, 1)), (shorts, (0.8, 0.72, 0.55, 1))):
        o.color = col
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.color_type = 'OBJECT'
    scene.display.shading.light = 'STUDIO'
    scene.render.resolution_x, scene.render.resolution_y = 700, 1000
    H = float(os.environ.get('CAMY', '0.85'))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 1.9 if not os.environ.get('CLOSE') else 0.6
    for label, loc, rot in (
        ('front', (0, -4, H), (math.pi / 2, 0, 0)),
        ('side', (4, 0, H), (math.pi / 2, 0, math.pi / 2)),
        ('three', (2.8, -2.8, H + 0.1), (math.radians(88), 0, math.radians(45))),
    ):
        cam.location = loc
        cam.rotation_euler = rot
        scene.render.filepath = os.path.join(PREVIEW, f'{label}.png')
        bpy.ops.render.render(write_still=True)
    print('previews in', PREVIEW)
