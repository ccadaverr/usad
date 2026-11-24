import * as THREE from 'three';
import { FLOWER_SITES, stemStretch } from './botanical-growth';
import type { GardenState } from './garden.service';

const { sin, cos, PI } = Math;
const goldAngle = PI * (3 - Math.sqrt(5));

function material(color: number, roughness = .85) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

/** The blade tapers to a point, with a raised central rib and downturned margins. */
function blade(length: number, width: number, rise: number, tint: number) {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const veins = [-1, -.45, -.06, 0, .06, .45, 1];
  const base = new THREE.Color(tint);
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const profile = Math.max(.002, sin(PI * t) ** .82 * (1.16 - .32 * t));
    for (const side of veins) {
      const rib = (1 - side * side) * sin(PI * t) * width * .39;
      positions.push(length * t, rise * t + length * .23 * sin(PI * t) + rib, side * profile * width + .1 * length * t * t);
      const shade = base.clone().multiplyScalar(side === 0 ? 1.52 : 1 + .14 * side - .16 * t);
      colors.push(shade.r, shade.g, shade.b);
    }
  }
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < veins.length - 1; j++) {
      const a = i * veins.length + j;
      const b = a + veins.length;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Rounded, cupped petals share an edge geometry and softly shaded vertex colors. */
function petal(length: number, tint: number) {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const base = new THREE.Color(tint);
  const across = [-1, -.55, 0, .55, 1];
  for (let row = 0; row <= 10; row++) {
    const t = row / 10;
    const width = length * .47 * Math.max(.015, sin(PI * t) ** .53 * (.70 + .48 * t));
    for (const side of across) {
      positions.push(length * t, length * (.26 * t * t + .32 * side * side * sin(PI * t)), width * side);
      const shade = base.clone().multiplyScalar(.78 + t * .25 + Math.abs(side) * .045);
      colors.push(shade.r, shade.g, shade.b);
    }
    if (!row) continue;
    for (let column = 0; column < across.length - 1; column++) {
      const here = row * across.length + column;
      const above = here - across.length;
      indices.push(above, here, above + 1, above + 1, here, here + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function contactShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 31);
  gradient.addColorStop(0, '#41382c78');
  gradient.addColorStop(.55, '#41382c40');
  gradient.addColorStop(1, '#41382c00');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

/** The garden renders on demand. Meshes, observers, timers and the context are owned by this instance. */
export function specimen(canvas: HTMLCanvasElement, failed: () => void) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, failIfMajorPerformanceCaveat: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffeee0, 0x8c8c75, 1.5));
  const key = new THREE.DirectionalLight(0xffe0be, 2.6);
  key.position.set(-3, 5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd5e9db, .9);
  fill.position.set(2, 3, -3);
  scene.add(fill);

  const pivot = new THREE.Group();
  const plant = new THREE.Group();
  plant.position.y = .57;
  pivot.add(plant);
  scene.add(pivot);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  function mesh(geometry: THREE.BufferGeometry, surface: THREE.Material, parent: THREE.Group | THREE.Scene) {
    geometries.add(geometry);
    materials.add(surface);
    const object = new THREE.Mesh(geometry, surface);
    parent.add(object);
    return object;
  }

  const shadowTexture = contactShadow();
  const shadow = mesh(new THREE.PlaneGeometry(2.5, 1.85), new THREE.MeshBasicMaterial({
    map: shadowTexture, transparent: true, depthWrite: false,
  }), scene);
  shadow.rotation.x = -PI / 2;
  shadow.position.set(.13, -.025, -.1);

  const clay = material(0xa3573b);
  const rim = material(0xc88461);
  const clayBody = [[.00, .00], [.30, .00], [.33, .025], [.33, .065], [.36, .085], [.43, .43], [.46, .48],
    [.50, .49], [.51, .515], [.50, .56], [.48, .575], [.425, .575], [.405, .53], [.37, .42], [.30, .08], [0, .08]];
  mesh(new THREE.LatheGeometry(clayBody.map(([x, y]) => new THREE.Vector2(x, y)), 40), clay, pivot);
  mesh(new THREE.LatheGeometry([new THREE.Vector2(.499, .505), new THREE.Vector2(.511, .522),
    new THREE.Vector2(.504, .553), new THREE.Vector2(.488, .569)], 40), rim, pivot);
  const soil = mesh(new THREE.CylinderGeometry(.421, .402, .035, 34), material(0x4e4230), pivot);
  soil.position.y = .53;
  const grit = material(0x74614a);
  const gritGeometry = new THREE.IcosahedronGeometry(.022, 0);
  for (let i = 0; i < 9; i++) {
    const radius = .1 + .26 * ((i * 7) % 9) / 9;
    mesh(gritGeometry, grit, pivot).position.set(radius * cos(i * goldAngle), .55, radius * sin(i * goldAngle));
  }

  const stemSurface = material(0x536d42);
  const youngStem = material(0x759064);
  const foliage = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .79 });
  const bloomSurface = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .86 });
  const pollen = material(0xc59754);
  const stalk = new THREE.CatmullRomCurve3([
    [0, 0, 0], [-.058, .22, .02], [-.08, .48, .045], [.02, .77, .04],
    [.095, 1.08, -.03], [.07, 1.4, -.06], [-.015, 1.65, 0], [.035, 1.9, .02],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const tips = [.105, .195, .285, .4, .515, .64, .755, .855, .94, 1];
  const greens = [0x476e46, 0x345f45, 0x608052, 0x507d5c, 0x6c8a55];
  function stem(points: THREE.Vector3[], radius: number, parent: THREE.Group, surface = stemSurface) {
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 8, radius, 7, false), surface, parent);
  }
  function leaf(position: THREE.Vector3, angle: number, length: number, width: number, rise: number, tint: number, parent: THREE.Group) {
    const bladeMesh = mesh(blade(length, width, rise, tint), foliage, parent);
    bladeMesh.position.copy(position);
    bladeMesh.rotation.y = -angle;
  }
  const layers = tips.map((end, index) => {
    const start = tips[index - 1] ?? 0;
    const anchor = stalk.getPoint(start);
    const group = new THREE.Group();
    group.position.copy(anchor);
    group.visible = false;
    plant.add(group);
    const center = (value: number) => stalk.getPoint(value).sub(anchor);
    const steps = Array.from({ length: 5 }, (_, step) => center(start + (end - start) * step / 4));
    stem(steps, .021 - .0015 * index, group);
    const node = center(end);
    const angle = index * goldAngle + .35;
    const size = [.26, .37, .46, .58, .7, .64, .6, .53, .42, .31][index];
    leaf(node, angle, size, size * .22, size * .34, greens[index % greens.length], group);
    leaf(node, angle + 2.66, size * .76, size * .17, size * .46, greens[(index + 2) % greens.length], group);

    if ([4, 5, 7, 8].includes(index)) {
      const from = center(start + (end - start) * .24);
      const azimuth = angle + 1.3;
      const direction = new THREE.Vector3(cos(azimuth), 0, sin(azimuth));
      const bend = from.clone().addScaledVector(direction, .22).add(new THREE.Vector3(0, .10, 0));
      const branchTip = from.clone().addScaledVector(direction, .33 + .013 * index).add(new THREE.Vector3(0, .27, 0));
      stem([from, bend, branchTip], .012, group, youngStem);
      leaf(bend, azimuth - .7, .38, .105, .135, greens[2], group);
      leaf(branchTip, azimuth + .27, .34, .09, .17, greens[1], group);
    }

    return group;
  });

  const budAccent = material(0xb78c6f);
  const calyx = material(0x68804f);
  const buds = new THREE.SphereGeometry(.048, 12, 8);
  const flowerCenters = new THREE.SphereGeometry(.036, 12, 7);
  const flowers = FLOWER_SITES.map(site => {
    const branch = new THREE.Group();
    plant.add(branch);
    const from = stalk.getPoint(site.anchor);
    const direction = new THREE.Vector3(cos(site.angle), 0, sin(site.angle));
    const elbow = from.clone().addScaledVector(direction, site.reach * .53).add(new THREE.Vector3(0, site.rise * .28, 0));
    const tip = from.clone().addScaledVector(direction, site.reach).add(new THREE.Vector3(0, site.rise, 0));
    stem([from, elbow, tip], .008, branch, youngStem);
    leaf(elbow, site.angle + .84, .22, .051, .09, greens[2], branch);

    const head = new THREE.Group();
    head.position.copy(tip);
    head.rotation.set(.66 + .11 * sin(site.angle), .19 * site.angle, -.28 * cos(site.angle));
    branch.add(head);
    const base = mesh(buds, calyx, head);
    base.scale.set(.88, .43, .88);
    const bud = mesh(buds, budAccent, head);
    bud.position.y = .034;
    const blossom = new THREE.Group();
    head.add(blossom);
    const petalGeometry = petal(site.size, site.tint);
    const petals = Array.from({ length: 5 }, (_, index) => {
      const joint = new THREE.Group();
      joint.rotation.y = -index * 2 * PI / 5 + .13;
      blossom.add(joint);
      const shape = mesh(petalGeometry, bloomSurface, joint);
      shape.position.x = .018;
      return shape;
    });
    const center = mesh(flowerCenters, pollen, blossom);
    center.position.y = .021;
    center.scale.y = .47;
    branch.visible = false;
    return { site, branch, bud, blossom, petals, height: tip.y + site.size };
  });

  const dropGeometry = new THREE.LatheGeometry([
    [0, -.047], [.021, -.040], [.033, -.022], [.029, -.001], [.016, .032], [0, .067],
  ].map(([radius, height]) => new THREE.Vector2(radius, height)), 12);
  const waterSurface = new THREE.MeshStandardMaterial({ color: 0x77acbc, roughness: .29, metalness: .09 });
  const drop = mesh(dropGeometry, waterSurface, scene);
  drop.scale.setScalar(1.35);
  const ringSurface = new THREE.MeshBasicMaterial({ color: 0xaedcde, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const ripple = mesh(new THREE.RingGeometry(.073, .089, 24), ringSurface, scene);
  ripple.rotation.x = -PI / 2;
  ripple.position.set(.20, .58, .24);
  drop.visible = ripple.visible = false;
  const camera = new THREE.OrthographicCamera();
  let aspect = 1;
  let visible = false;
  let disposed = false;
  let frame = 0;
  let level = 1;
  let lifetime = -1;
  let oldLevel = 1;
  let oldLifetime = 0;
  let growthAt = -Infinity;
  let waterAt = -Infinity;
  let yaw = -.43;
  pivot.rotation.y = yaw;

  const unit = (value: number) => Math.max(0, Math.min(1, value));
  const ease = (value: number) => 1 - (1 - value) ** 3;
  const plantHeight = (stage: number, count: number) => {
    const stemHeight = stalk.getPoint(tips[stage - 1]).y;
    const tallest = flowers.reduce((height, flower) => flower.site.bud <= stage ? Math.max(height, flower.height) : height, stemHeight);
    return .61 + tallest * stemStretch(count);
  };

  function draw(time: number) {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    const elapsed = time - growthAt;
    const growth = unit(elapsed / 670);
    const eased = ease(growth);
    const previousStretch = stemStretch(oldLifetime);
    const currentStretch = stemStretch(Math.max(0, lifetime));
    plant.scale.y = previousStretch + (currentStretch - previousStretch) * eased + sin(growth * PI) * .032;
    layers.forEach((layer, index) => {
      if (layer.visible) layer.scale.setScalar(index >= oldLevel ? .05 + .95 * eased : 1);
    });
    for (const { site, branch, bud, blossom, petals } of flowers) {
      if (!branch.visible) continue;
      const emerged = site.bud > oldLevel ? ease(unit(elapsed / 590)) : 1;
      // Branch points are stalk-relative. The young bud emerges without detaching from its stem.
      const opened = level < site.open ? 0 : site.open <= oldLevel ? 1 : ease(unit((elapsed - 95) / 760));
      bud.visible = opened < .88;
      bud.scale.set(.78, 1.18, .78).multiplyScalar((.28 + .72 * emerged) * (1 - .64 * opened));
      blossom.visible = opened > 0;
      blossom.scale.setScalar(.36 + .64 * opened);
      petals.forEach((shape, index) => { shape.rotation.z = (1 - opened) * (1.28 + .045 * index) - .13; });
    }

    const heightBefore = plantHeight(oldLevel, oldLifetime);
    const specimenHeight = heightBefore + (plantHeight(level, Math.max(0, lifetime)) - heightBefore) * eased;
    const watering = time - waterAt;
    const descent = unit(watering / 450);
    const impact = unit((watering - 435) / 510);
    drop.visible = watering >= 0 && descent < 1;
    if (drop.visible) {
      const dropHeight = Math.max(.34, Math.min(1.45, specimenHeight - .61));
      drop.position.set(.20 + .59 * (1 - descent), .63 + dropHeight * (1 - descent ** 1.8),
        .24 + .23 * (1 - descent));
      drop.rotation.z = -.22 * (1 - descent);
    }
    ripple.visible = watering >= 435 && impact < 1;
    if (ripple.visible) {
      ripple.scale.setScalar(.26 + 1.7 * ease(impact));
      ringSurface.opacity = .7 * (1 - impact);
    }
    plant.rotation.z = impact > 0 && impact < 1 ? sin(impact * PI * 2) * (1 - impact) * .032 : 0;
    pivot.rotation.y += (yaw - pivot.rotation.y) * .24;

    const span = Math.max(specimenHeight + .64, 1.79 / aspect);
    const aim = specimenHeight * .5;
    camera.left = -span * aspect / 2;
    camera.right = span * aspect / 2;
    camera.top = span / 2;
    camera.bottom = -span / 2;
    camera.position.set(0, aim + 1.06, 5);
    camera.lookAt(0, aim, 0);
    camera.updateProjectionMatrix();
    try { renderer.render(scene, camera); } catch { failed(); return; }
    if (elapsed < 855 || watering < 945 || Math.abs(yaw - pivot.rotation.y) > .003) schedule();
  }

  function schedule() {
    if (!frame && visible && !document.hidden && !disposed) frame = requestAnimationFrame(draw);
  }

  const resize = new ResizeObserver(() => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    aspect = width / height;
    schedule();
  });
  resize.observe(canvas);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    schedule();
  });
  observer.observe(canvas);
  document.addEventListener('visibilitychange', schedule);
  canvas.addEventListener('webglcontextlost', failed);

  return {
    stage(value: Pick<GardenState, 'level' | 'lifetime'>, previousLevel?: number) {
      if (level === value.level && lifetime === value.lifetime) return;
      level = value.level;
      lifetime = value.lifetime;
      oldLevel = previousLevel ?? level;
      oldLifetime = previousLevel === undefined ? lifetime : lifetime - 1;
      growthAt = previousLevel === undefined ? -Infinity : performance.now();
      if (previousLevel !== undefined) waterAt = -Infinity;
      layers.forEach((layer, index) => { layer.visible = index < level; });
      flowers.forEach(flower => { flower.branch.visible = level >= flower.site.bud; });
      schedule();
    },
    rotate(delta: number) { yaw += delta; schedule(); },
    water() { waterAt = performance.now(); schedule(); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      document.removeEventListener('visibilitychange', schedule);
      canvas.removeEventListener('webglcontextlost', failed);
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(surface => surface.dispose());
      shadowTexture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
