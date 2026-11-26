import * as THREE from 'three';
import { FLOWER_SITES, stemStretch } from './botanical-growth';
import { streakFruit } from './streak-fruit';
import { wateringCan } from './watering-can';
import {
  CAN_ANCHOR_BOTTOM, CAN_DISPLAY_WIDTH, CAN_SPACE, PlantStage, WateringTransition, WATERING_DURATION,
  fruitAmount, mix, smooth, stageAmount, transitionDuration, transitionFrame,
} from './watering-motion';

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
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The garden renders on demand. Meshes, observers, timers and the context are owned by this instance. */
export function specimen(canvas: HTMLCanvasElement, failed: () => void, firstFrame: () => void) {
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
  plant.position.y = .55;
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
  const shadow = mesh(new THREE.PlaneGeometry(1.85, 1.65), new THREE.MeshBasicMaterial({
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
    const geometry = blade(length, width, rise, tint);
    geometry.computeBoundingBox();
    const bladeMesh = mesh(geometry, foliage, parent);
    bladeMesh.position.copy(position);
    bladeMesh.rotation.y = -angle;
    return bladeMesh;
  }
  function unfold(blade: THREE.Mesh, amount: number) {
    blade.visible = amount > 0;
    if (!blade.visible) return;
    blade.scale.set(amount, .58 + .42 * amount, amount * (.38 + .62 * amount));
    blade.rotation.z = (1 - amount) * .93;
  }

  const leafTop = (leaf: THREE.Mesh) => leaf.position.y + leaf.geometry.boundingBox!.max.y;

  const layers = tips.map((end, index) => {
    const start = tips[index - 1] ?? 0;
    const anchor = stalk.getPoint(start);
    const group = new THREE.Group();
    group.position.copy(anchor);
    plant.add(group);
    const center = (value: number) => stalk.getPoint(value).sub(anchor);
    const steps = Array.from({ length: 5 }, (_, step) => center(start + (end - start) * step / 4));
    const curve = new THREE.CatmullRomCurve3(steps);
    const segments = 32;
    const sides = 7;
    const ringSize = (sides + 1) * 3;
    const tube = new THREE.TubeGeometry(curve, segments, .021 - .0015 * index, sides, false);
    const position = tube.getAttribute('position') as THREE.BufferAttribute;
    position.setUsage(THREE.DynamicDrawUsage);
    const vertices = position.array as Float32Array;
    const fullLength = vertices.slice();
    mesh(tube, stemSurface, group);

    const leafNode = new THREE.Group();
    group.add(leafNode);
    const angle = index * goldAngle + .35;
    const size = [.26, .37, .46, .58, .7, .64, .6, .53, .42, .31][index];
    const blades = [
      leaf(new THREE.Vector3(), angle, size, size * .22, size * .34, greens[index % greens.length], leafNode),
      leaf(new THREE.Vector3(), angle + 2.66, size * .76, size * .17, size * .46, greens[(index + 2) % greens.length], leafNode),
    ];

    let height = steps[steps.length - 1].y + Math.max(...blades.map(leafTop));
    let extendBranch = (_amount: number) => {};
    if ([4, 5, 7, 8].includes(index)) {
      const branch = new THREE.Group();
      branch.position.copy(center(start + (end - start) * .24));
      group.add(branch);
      const azimuth = angle + 1.3;
      const direction = new THREE.Vector3(cos(azimuth), 0, sin(azimuth));
      const bend = direction.clone().multiplyScalar(.22).add(new THREE.Vector3(0, .10, 0));
      const branchTip = direction.clone().multiplyScalar(.33 + .013 * index).add(new THREE.Vector3(0, .27, 0));
      stem([new THREE.Vector3(), bend, branchTip], .012, branch, youngStem);
      const sideLeaves = [
        leaf(bend, azimuth - .7, .38, .105, .135, greens[2], branch),
        leaf(branchTip, azimuth + .27, .34, .09, .17, greens[1], branch),
      ];
      height = Math.max(height, branch.position.y + Math.max(...sideLeaves.map(leafTop)));
      extendBranch = amount => {
        const reach = smooth((amount - .29) / .71);
        branch.visible = reach > 0;
        branch.scale.setScalar(reach);
        sideLeaves.forEach(blade => unfold(blade, smooth((reach - .14) / .86)));
      };
    }

    let previous = -1;
    let movingRing = ringSize;
    const extend = (amount: number) => {
      if (previous === amount) return;
      previous = amount;
      group.visible = amount > 0;
      if (!group.visible) return;

      // Keep each mature ring fixed. Only the last ring moves with the growing tip.
      vertices.set(fullLength.subarray(movingRing, movingRing + ringSize), movingRing);
      const length = amount * segments;
      const count = Math.ceil(length);
      const fraction = length - (count - 1);
      movingRing = count * ringSize;
      for (let coordinate = movingRing; coordinate < movingRing + ringSize; coordinate++) {
        vertices[coordinate] = mix(fullLength[coordinate - ringSize], fullLength[coordinate], fraction);
      }
      position.needsUpdate = true;
      tube.setDrawRange(0, count * sides * 6);
      curve.getPointAt(amount, leafNode.position);
      blades.forEach((blade, i) => unfold(blade, smooth((amount - .38 - i * .09) / (.62 - i * .09))));
      extendBranch(amount);
    };
    return { extend, height: anchor.y + height };
  });

  const budAccent = material(0xb78c6f);
  const calyx = material(0x68804f);
  const buds = new THREE.SphereGeometry(.048, 12, 8);
  const flowerCenters = new THREE.SphereGeometry(.036, 12, 7);
  const flowers = FLOWER_SITES.map(site => {
    const branch = new THREE.Group();
    plant.add(branch);
    const from = stalk.getPoint(site.anchor);
    branch.position.copy(from);
    const direction = new THREE.Vector3(cos(site.angle), 0, sin(site.angle));
    const elbow = direction.clone().multiplyScalar(site.reach * .53).add(new THREE.Vector3(0, site.rise * .28, 0));
    const tip = direction.clone().multiplyScalar(site.reach).add(new THREE.Vector3(0, site.rise, 0));
    stem([new THREE.Vector3(), elbow, tip], .008, branch, youngStem);
    const branchLeaf = leaf(elbow, site.angle + .84, .22, .051, .09, greens[2], branch);

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
    return { site, branch, branchLeaf, bud, blossom, petals, height: from.y + tip.y + site.size };
  });

  const can = wateringCan(scene, mesh);
  const fruit = streakFruit(plant, mesh);
  const camera = new THREE.OrthographicCamera();
  const rest = new THREE.Vector3();
  const viewDirection = new THREE.Vector3();
  let aspect = 1;
  let canvasHeight = 0;
  let visible = false;
  let disposed = false;
  let drawn = false;
  let frame = 0;
  let stage: PlantStage = { level: 1, growth: 0, streak: 0 };
  let transition: WateringTransition | undefined;
  let yaw = -.43;
  pivot.rotation.y = yaw;

  const plantHeight = ({ level, growth }: PlantStage) => {
    const canopy = layers.slice(0, level).reduce((height, layer) => Math.max(height, layer.height), 0);
    const tallest = flowers.reduce((height, flower) =>
      flower.site.bud <= level ? Math.max(height, flower.height) : height, canopy);
    return plant.position.y + tallest * stemStretch(growth) + .09;
  };

  function draw(time: number) {
    frame = 0;
    if (disposed || !visible || document.hidden || canvasHeight <= CAN_SPACE) return;
    if (transition && time - transition.startedAt >= transitionDuration(transition.kind)) transition = undefined;
    const elapsed = transition ? Math.max(0, time - transition.startedAt) : WATERING_DURATION;
    const isWatering = transition?.kind === 'watering';
    const { growth, sway } = transitionFrame(elapsed, transition?.kind ?? 'watering');
    const before = transition?.before ?? stage;
    const after = transition?.after ?? stage;
    const amount = (level: number) => stageAmount(level, before, after, growth);

    plant.scale.y = mix(stemStretch(before.growth), stemStretch(after.growth), growth);
    plant.scale.x = plant.scale.z = 1 + .009 * mix(before.growth, after.growth, growth);
    plant.rotation.z = sway;
    layers.forEach((layer, index) => layer.extend(amount(index + 1)));
    for (const { site, branch, branchLeaf, bud, blossom, petals } of flowers) {
      const reach = smooth((amount(site.bud) - .24) / .76);
      branch.visible = reach > 0;
      if (!branch.visible) continue;
      branch.scale.setScalar(reach);
      unfold(branchLeaf, smooth((reach - .15) / .85));

      const opened = smooth((amount(site.open) - .12) / .88);
      bud.visible = opened < .96;
      bud.scale.set(.78, 1.18, .78).multiplyScalar(1 - .88 * opened);
      blossom.visible = opened > 0;
      blossom.scale.setScalar(opened);
      petals.forEach((shape, index) => {
        shape.rotation.z = (1 - opened) * (1.34 + .06 * index) - .13;
      });
    }
    fruit(stalk, mix(tips[before.level - 1], tips[after.level - 1], growth), mix(before.level, after.level, growth),
      index => fruitAmount(index, before.streak, after.streak, growth));
    pivot.rotation.y += (yaw - pivot.rotation.y) * .24;

    const originalHeight = plantHeight(before);
    const specimenHeight = mix(originalHeight, plantHeight(after), growth);
    const canHeight = Math.max(1.26, originalHeight + .26);
    const canFraming = isWatering ? smooth(elapsed / 240) * (1 - smooth((elapsed - 1810) / 390)) : 0;
    const height = mix(specimenHeight, Math.max(specimenHeight, canHeight + .29), canFraming);
    const centerX = .17 * canFraming;
    const botanicalRatio = (canvasHeight - CAN_SPACE) / canvasHeight;
    const span = Math.max((height + mix(.46, .35, canFraming)) / botanicalRatio, mix(1.68, 2.50, canFraming) / aspect);
    const aim = height * .49 - span * (1 - botanicalRatio) / 2;
    camera.left = -span * aspect / 2;
    camera.right = span * aspect / 2;
    camera.top = span / 2;
    camera.bottom = -span / 2;
    camera.position.set(centerX, aim + 1.06, 5);
    camera.lookAt(centerX, aim, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // Map the center of the HTML control to a fixed point on the scene's front plane.
    // Keep the same model and match its resting size in CSS pixels at every stage.
    const restScale = CAN_DISPLAY_WIDTH * span / canvasHeight / 1.08;
    const restDepth = .12;
    rest.set(0, 2 * CAN_ANCHOR_BOTTOM / canvasHeight - 1, 0).unproject(camera);
    camera.getWorldDirection(viewDirection);
    rest.addScaledVector(viewDirection, (restDepth - rest.z) / viewDirection.z);
    rest.x += .10 * restScale;
    rest.y -= .025 * restScale;
    can.draw(isWatering ? elapsed : WATERING_DURATION, originalHeight, rest, restScale);
    try { renderer.render(scene, camera); } catch { failed(); return; }
    if (!drawn) {
      drawn = true;
      firstFrame();
    }
    if (transition || Math.abs(yaw - pivot.rotation.y) > .003) schedule();
  }

  function schedule() {
    if (!frame && visible && !document.hidden && !disposed) frame = requestAnimationFrame(draw);
  }

  const resize = new ResizeObserver(() => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    aspect = width / height;
    canvasHeight = height;
    schedule();
  });
  resize.observe(canvas);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    schedule();
  });
  observer.observe(canvas);
  const updateColors = () => {
    can.colors(getComputedStyle(canvas));
    schedule();
  };
  updateColors();
  const appearance = new MutationObserver(updateColors);
  appearance.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode', 'data-theme'] });
  document.addEventListener('visibilitychange', schedule);
  canvas.addEventListener('webglcontextlost', failed);

  return {
    stage(value: PlantStage, action?: WateringTransition) {
      stage = value;
      transition = action;
      schedule();
    },
    rotate(delta: number) { yaw += delta; schedule(); },
    dispose(releaseContext = false) {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      appearance.disconnect();
      document.removeEventListener('visibilitychange', schedule);
      canvas.removeEventListener('webglcontextlost', failed);
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(surface => surface.dispose());
      shadowTexture.dispose();
      renderer.dispose();
      if (releaseContext) renderer.forceContextLoss();
    },
  };
}
