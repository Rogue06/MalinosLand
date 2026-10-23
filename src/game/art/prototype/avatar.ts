import type { AvatarAppearance } from '../../../content/avatars';
import type { Facing } from '../../../core/iso';
import { facesCamera, rotationForFacing } from '../../../core/rotation';
import { renderAvatarFrames, SIT_HEIGHT, type AvatarPose } from '../characters';
import { darken, lighten } from '../color';
import { IsoBuilder, type Decal } from '../iso3d';

/** Un seul personnage d'étude ; aucune nouvelle valeur dans les profils ou le réseau. */
export const PROTOTYPE_APPEARANCE: AvatarAppearance = {
  body: 0,
  skin: 0,
  hair: 0,
  hairColor: 1,
  top: 4,
  bottom: 1,
  accessory: 0,
  beard: 0,
};

/** Veste marine, sweat M, sac à dos et baskets : interprétation procédurale de la référence. */
export function buildPrototypeAvatar(facing: Facing, pose: AvatarPose): IsoBuilder {
  const b = new IsoBuilder(rotationForFacing(facing), 0, 0);
  const k = 1.32;
  const skin = '#f1bc91';
  const navy = '#333d60';
  const cream = '#f2eef0';
  const denim = '#356299';
  const hair = '#51372f';
  const shoe = '#655de0';
  const B = (
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    color: string,
    decals?: Decal[],
  ) =>
    b.box({
      x: x * k,
      y: y * k,
      z: z * k,
      w: w * k,
      d: d * k,
      h: h * k,
      color,
      decals,
      outline: false,
    });
  const dc = (
    face: Decal['face'],
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    color: string,
  ): Decal => ({ face, u0, v0, u1, v1, color });
  const sitting = pose === 'sit';
  const swing = pose === 'walkA' ? 1 : pose === 'walkB' ? -1 : 0;
  const hip = sitting ? SIT_HEIGHT / k : 0.4;
  const z = hip + (swing ? 0.012 : 0);

  for (const side of [-1, 1]) {
    const x = side < 0 ? -0.123 : 0.015;
    const y = sitting ? 0.16 : -0.065 + swing * side * 0.06;
    if (sitting) B(x, -0.065, hip - 0.09, 0.108, 0.33, 0.1, denim);
    if (!sitting || facesCamera(facing)) {
      B(x, y, 0.09, 0.108, 0.12, hip - 0.09 + (sitting ? -0.09 : 0), denim, [
        dc('py', 0.15, 0.38, 0.85, 0.53, '#4075b0'),
        dc('px', 0.78, 0, 0.93, 1, '#2b5286'),
      ]);
      B(x - 0.006, y - 0.008, 0.08, 0.12, 0.135, 0.035, '#78a8ce');
      B(x - 0.006, y - 0.004, 0.012, 0.12, 0.19, 0.025, cream);
      B(x - 0.004, y - 0.003, 0.037, 0.116, 0.18, 0.04, shoe, [
        dc('top', 0.23, 0.25, 0.77, 0.35, cream),
        dc('top', 0.23, 0.43, 0.77, 0.53, cream),
        dc('py', 0, 0, 1, 0.8, cream),
      ]);
      B(x - 0.006, y - 0.004, 0, 0.12, 0.19, 0.012, '#33496b');
    }
  }

  // Torse et panneau du sweat. Les détails sont plaqués sur la face pour rester lisibles.
  B(-0.16, -0.095, z, 0.32, 0.19, 0.37, navy, [
    dc('py', 0.22, 0.03, 0.78, 0.98, cream),
    dc('py', 0.18, 0.03, 0.22, 0.88, '#252e49'),
    dc('py', 0.78, 0.03, 0.82, 0.88, '#252e49'),
    dc('py', 0.34, 0.74, 0.38, 0.95, '#bcb8c8'),
    dc('py', 0.62, 0.74, 0.66, 0.95, '#bcb8c8'),
    dc('py', 0.34, 0.33, 0.66, 0.64, '#5078d0'),
    // Petit M construit en pixels : indépendant de la police du navigateur.
    dc('py', 0.4, 0.38, 0.44, 0.59, '#ffffff'),
    dc('py', 0.56, 0.38, 0.6, 0.59, '#ffffff'),
    dc('py', 0.44, 0.51, 0.48, 0.57, '#ffffff'),
    dc('py', 0.48, 0.47, 0.52, 0.53, '#ffffff'),
    dc('py', 0.52, 0.51, 0.56, 0.57, '#ffffff'),
    dc('ny', 0.14, 0, 0.86, 0.06, '#242e49'),
  ]);
  // Sac : la silhouette de dos est réellement différente de celle de face.
  B(-0.126, -0.185, z + 0.05, 0.252, 0.09, 0.29, '#2d3657', [
    dc('ny', 0.08, 0.15, 0.92, 0.25, '#1cabb9'),
    dc('nx', 0.15, 0.15, 0.85, 0.25, '#1cabb9'),
    dc('px', 0.15, 0.15, 0.85, 0.25, '#1cabb9'),
  ]);
  B(-0.095, -0.209, z + 0.07, 0.19, 0.024, 0.13, '#384569');
  B(-0.035, -0.155, z + 0.34, 0.07, 0.028, 0.025, '#232d4b');

  for (const side of [-1, 1]) {
    const x = side < 0 ? -0.245 : 0.16;
    const y = sitting ? 0.04 : -swing * side * 0.05;
    B(x, -0.06 + y, z + 0.13, 0.085, 0.13, 0.22, lighten(navy, 0.05));
    B(x - 0.004, -0.066 + y, z + 0.1, 0.093, 0.142, 0.055, navy);
    B(x + 0.005, -0.055 + y, z + 0.07, 0.075, 0.12, 0.03, cream);
    B(x + 0.007, -0.053 + y, z + 0.012, 0.071, 0.115, 0.058, skin);
  }
  B(-0.055, -0.04, z + 0.37, 0.11, 0.1, 0.065, darken(skin, 0.04));
  B(-0.17, -0.11, z + 0.36, 0.34, 0.075, 0.055, cream);
  B(-0.17, -0.035, z + 0.36, 0.105, 0.15, 0.045, cream);
  B(0.065, -0.035, z + 0.36, 0.105, 0.15, 0.045, cream);

  const hz = z + 0.43;
  B(-0.151, -0.135, hz, 0.302, 0.27, 0.3, skin, [
    dc('py', 0.2, 0.39, 0.29, 0.61, '#30232c'),
    dc('py', 0.71, 0.39, 0.8, 0.61, '#30232c'),
    dc('py', 0.17, 0.67, 0.32, 0.71, hair),
    dc('py', 0.68, 0.67, 0.83, 0.71, hair),
    dc('py', 0.38, 0.2, 0.43, 0.25, '#743e36'),
    dc('py', 0.43, 0.17, 0.57, 0.21, '#743e36'),
    dc('py', 0.57, 0.2, 0.62, 0.25, '#743e36'),
  ]);
  // Une oreille de chaque côté ; le tri isométrique masque automatiquement celle du fond.
  B(-0.176, -0.005, hz + 0.055, 0.025, 0.08, 0.09, skin);
  B(0.151, -0.005, hz + 0.055, 0.025, 0.08, 0.09, skin);
  // Mèches étagées : pas de cube unique posé sur la tête.
  B(-0.163, -0.148, hz + 0.25, 0.326, 0.296, 0.065, hair);
  B(-0.163, -0.148, hz + 0.07, 0.326, 0.07, 0.18, darken(hair, 0.04));
  B(-0.163, -0.078, hz + 0.15, 0.035, 0.18, 0.1, hair);
  B(0.128, -0.078, hz + 0.17, 0.035, 0.18, 0.08, hair);
  B(-0.115, -0.11, hz + 0.315, 0.16, 0.18, 0.042, lighten(hair, 0.12));
  B(0.045, -0.075, hz + 0.315, 0.09, 0.17, 0.028, lighten(hair, 0.06));
  B(-0.115, 0.13, hz + 0.235, 0.14, 0.035, 0.052, hair);
  B(0.025, 0.13, hz + 0.21, 0.1, 0.035, 0.077, hair);
  return b;
}

export function renderPrototypeAvatarSheet(_look: AvatarAppearance, scale: number) {
  return renderAvatarFrames(buildPrototypeAvatar, scale);
}
