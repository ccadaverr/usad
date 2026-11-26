import * as THREE from 'three';
import { FRUIT_LIMIT, mix } from './watering-motion';

type MeshFactory = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Group) => THREE.Mesh;

// Start below the first two leaf nodes so a seedling can support fruit as well.
export const FRUIT_NODES = [
  { anchor: .92, angle: .27, reach: .086 }, { anchor: .60, angle: 2.8, reach: .079 },
  { anchor: .94, angle: 3.35, reach: .157 }, { anchor: .49, angle: 5.85, reach: .141 },
] as const;

export function streakFruit(plant: THREE.Group, mesh: MeshFactory) {
  const stalk = new THREE.MeshStandardMaterial({ color: 0x61784a, roughness: .85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe59b62, roughness: .48 });
  const crown = new THREE.MeshStandardMaterial({ color: 0xaa5b37, roughness: .74 });
  const fruit = new THREE.LatheGeometry([
    [0, -.038], [.014, -.034], [.024, -.023], [.028, -.008], [.027, .008], [.018, .02], [0, .027],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 16);
  const crownGeometry = new THREE.SphereGeometry(.011, 10, 6);
  const instances = FRUIT_NODES.slice(0, FRUIT_LIMIT).map(site => {
    const joint = new THREE.Group();
    joint.rotation.y = -site.angle;
    plant.add(joint);
    const branch = new THREE.CatmullRomCurve3([
      new THREE.Vector3(), new THREE.Vector3(site.reach * .49, .016, 0), new THREE.Vector3(site.reach, -.002, 0),
    ]);
    mesh(new THREE.TubeGeometry(branch, 8, .004, 5, false), stalk, joint);
    const berry = mesh(fruit, skin, joint);
    berry.position.set(site.reach, -.028, 0);
    berry.rotation.z = -.24;
    const base = mesh(crownGeometry, crown, joint);
    base.position.set(site.reach + .006, -.061, 0);
    base.scale.y = .48;
    return { joint, site };
  });

  return (curve: THREE.Curve<THREE.Vector3>, tip: number, level: number, amounts: (index: number) => number) => {
    instances.forEach(({ joint, site }, index) => {
      const amount = amounts(index);
      joint.visible = amount > 0;
      if (!joint.visible) return;
      curve.getPoint(tip * site.anchor, joint.position);
      joint.scale.setScalar(amount * mix(.94, 1.65, (level - 1) / 9));
    });
  };
}
