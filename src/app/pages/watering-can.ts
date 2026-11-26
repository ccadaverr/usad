import * as THREE from 'three';
import {
  DROP_COUNT, DROP_INTERVAL, FIRST_IMPACT, WATER_IMPACTS, dropAge, fallingDistance, mix, smooth, waterFlow, wateringFrame,
} from './watering-motion';

type MeshFactory = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Group | THREE.Scene) => THREE.Mesh;
const { cos, sin, PI } = Math;

export function wateringCan(scene: THREE.Scene, mesh: MeshFactory) {
  const can = new THREE.Group();
  scene.add(can);
  const enamel = new THREE.MeshStandardMaterial({ roughness: .33, metalness: .24 });
  const trim = new THREE.MeshStandardMaterial({ roughness: .38, metalness: .31 });
  const inner = new THREE.MeshStandardMaterial({ color: 0x28342e, roughness: .84 });
  const lathe = (profile: number[][]) => new THREE.LatheGeometry(
    profile.map(([radius, height]) => new THREE.Vector2(radius, height)), 32,
  );
  function pipe(points: number[][], radius: number, surface = trim) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    mesh(new THREE.TubeGeometry(curve, 22, radius, 8, false), surface, can);
  }
  mesh(lathe([
    [0, -.207], [.176, -.207], [.201, -.196], [.226, -.173], [.237, -.109], [.225, .025],
    [.181, .141], [.163, .154], [.144, .154], [.13, .12], [.146, .038], [.154, -.11], [0, -.15],
  ]), enamel, can);
  mesh(lathe([[.173, .147], [.168, .162], [.155, .165], [.142, .159], [.137, .141]]), trim, can);
  mesh(lathe([[.211, -.182], [.221, -.179], [.225, -.17], [.224, -.162]]), trim, can);
  const mouth = mesh(new THREE.CircleGeometry(.135, 24), inner, can);
  mouth.rotation.x = -PI / 2;
  mouth.position.y = .102;

  pipe([[.169, .106, 0], [.292, .186, .005], [.398, .139, .016],
    [.416, .038, .024], [.354, -.065, .017], [.224, -.106, .007]], .022);
  pipe([[-.135, .124, -.005], [-.106, .229, -.023], [-.013, .268, -.03],
    [.089, .246, -.022], [.154, .139, -.009]], .017);
  pipe([[-.172, -.118, .008], [-.294, -.118, .012], [-.429, -.053, .017],
    [-.538, .018, .020], [-.608, .083, .023]], .028, enamel);
  const nozzleDirection = new THREE.Vector3(-.78, .63, 0).normalize();
  const nozzle = mesh(new THREE.CylinderGeometry(.049, .028, .065, 16), trim, can);
  nozzle.position.set(-.609, .088, .023);
  nozzle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nozzleDirection);
  const outlet = nozzle.position.clone().addScaledVector(nozzleDirection, .033);
  const face = mesh(new THREE.CircleGeometry(.040, 16), inner, can);
  face.position.copy(outlet);
  face.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nozzleDirection);

  // Scene lights color the can and soil. A restrained unlit tint keeps the thin water readable.
  const waterMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: .92, depthWrite: false });
  const waterGeometry = lathe([[0, -.026], [.014, -.021], [.017, -.005], [.011, .012], [0, .03]]);
  const drops = Array.from({ length: DROP_COUNT }, () => {
    const drop = mesh(waterGeometry, waterMaterial, scene);
    drop.renderOrder = 12;
    return drop;
  });
  const streamMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const streamGeometry = new THREE.CylinderGeometry(.010, .010, 1, 8);
  const streamPieces = Array.from({ length: 8 }, () => {
    const piece = mesh(streamGeometry, streamMaterial, scene);
    piece.renderOrder = 11;
    return piece;
  });
  const up = new THREE.Vector3(0, 1, 0);
  const forward = new THREE.Vector3(0, 0, 1);
  const source = new THREE.Vector3();
  const soil = new THREE.Vector3(.23, .551, .21);
  const pour = new THREE.Vector3(.82, 1.26, .09);
  const previousPoint = new THREE.Vector3();
  const nextPoint = new THREE.Vector3();
  const segment = new THREE.Vector3();
  const midpoint = new THREE.Vector3();
  const waterPoint = (into: THREE.Vector3, age: number, offset = 0) => into.set(
    mix(source.x, soil.x + offset, age),
    mix(source.y, soil.y, fallingDistance(age)),
    mix(source.z, soil.z, age),
  );
  const splashGeometry = new THREE.SphereGeometry(.013, 8, 6);
  const impacts = WATER_IMPACTS.map(index => {
    const surface = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const ripple = mesh(new THREE.RingGeometry(.083, .093, 24), surface, scene);
    ripple.rotation.x = -PI / 2;
    const splashes = Array.from({ length: 4 }, () => mesh(splashGeometry, waterMaterial, scene));
    return { index, ripple, surface, splashes };
  });
  const spread = (index: number) => (index % 3 - 1) * .020;
  const pourScale = .72;
  const tilt = .63;

  return {
    colors(style: CSSStyleDeclaration) {
      enamel.color.setStyle(style.getPropertyValue('--garden-can').trim());
      trim.color.setStyle(style.getPropertyValue('--garden-can-edge').trim());
      const water = style.getPropertyValue('--garden-water').trim();
      waterMaterial.color.setStyle(water);
      streamMaterial.color.copy(waterMaterial.color);
      impacts.forEach(({ surface }) => surface.color.copy(waterMaterial.color));
    },
    draw(elapsed: number, plantHeight: number, rest: THREE.Vector3, restScale: number) {
      const { arrival, lateral, arc, tilt: tip } = wateringFrame(elapsed);
      pour.y = Math.max(1.26, plantHeight + .26);
      can.position.set(
        mix(rest.x, pour.x, lateral) + arc * .27,
        mix(rest.y, pour.y, arrival) + arc * .12,
        mix(rest.z, pour.z, arrival),
      );
      can.scale.setScalar(mix(restScale, pourScale, arrival));
      can.rotation.z = tip * tilt;
      // Use the outlet in the held pour pose so water in flight stays put as the can tips back.
      source.copy(outlet).multiplyScalar(pourScale).applyAxisAngle(forward, tilt).add(pour);

      const { start, end, opacity } = waterFlow(elapsed);
      streamMaterial.opacity = .78 * opacity;
      streamPieces.forEach((piece, index) => {
        piece.visible = opacity > .025 && end - start > .01;
        if (!piece.visible) return;
        waterPoint(previousPoint, mix(start, end, index / streamPieces.length));
        waterPoint(nextPoint, mix(start, end, (index + 1) / streamPieces.length));
        segment.subVectors(nextPoint, previousPoint);
        const length = segment.length();
        midpoint.copy(previousPoint).addScaledVector(segment, .5);
        piece.position.copy(midpoint);
        piece.quaternion.setFromUnitVectors(up, segment.multiplyScalar(1 / length));
        piece.scale.set(1, length * .98, 1);
      });

      drops.forEach((drop, index) => {
        const age = dropAge(elapsed, index);
        drop.visible = age >= 0 && age < 1;
        if (!drop.visible) return;
        waterPoint(drop.position, age, spread(index));
        const size = .62 + (index % 4) * .11;
        drop.scale.set(size, size * (1 + age * .65), size);
      });

      for (const { index, ripple, surface, splashes } of impacts) {
        const age = (elapsed - FIRST_IMPACT - index * DROP_INTERVAL) / 360;
        const active = age >= 0 && age < 1;
        ripple.visible = active;
        splashes.forEach(splash => { splash.visible = active; });
        if (!active) continue;
        const x = soil.x + spread(index);
        const z = soil.z;
        ripple.position.set(x, soil.y + .002, z);
        ripple.scale.setScalar(mix(.24, 1.4, smooth(age)));
        surface.opacity = .68 * (1 - age);
        splashes.forEach((splash, particle) => {
          const angle = particle * PI * .54 + index * .26;
          const radius = age * (.075 + particle * .022);
          splash.position.set(x + radius * cos(angle), soil.y + age * (1 - age) * (.31 + particle * .045),
            z + radius * sin(angle));
          splash.scale.setScalar((1 - age) * (.68 + particle * .11));
        });
      }
    },
  };
}
