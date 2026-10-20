/**
 * Secrets du Hub : petits clins d'œil cachés, à trouver en explorant (compteur dans les
 * objectifs). Chaque secret est relié à une interaction (`secret: '…'`) d'un objet de la carte
 * ou du catalogue ; un test vérifie qu'ils sont tous trouvables.
 */
export interface SecretDef {
  id: string;
  /** Nom révélé une fois le secret trouvé. */
  title: string;
}

export const SECRETS: SecretDef[] = [
  { id: 'voeu', title: 'Un vœu dans la fontaine' },
  { id: 'pixel', title: 'Pixel, le chat du salon' },
  { id: 'capsule', title: 'La capsule temporelle du chantier' },
  { id: 'carnet', title: 'Le carnet oublié du coworking' },
  { id: 'nain', title: 'Le nain de jardin farceur' },
  { id: 'konami', title: 'Le code de la borne d’arcade' },
  { id: 'bouteille', title: 'La bouteille de l’étang' },
  { id: 'telescope', title: 'La vue du télescope' },
  { id: 'feu', title: 'L’histoire du feu de camp' },
  { id: 'champignons', title: 'Le cercle de champignons' },
];
