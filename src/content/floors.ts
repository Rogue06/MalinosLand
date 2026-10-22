/** Étages desservis par l'ascenseur (les logements, eux, sont proposés directement). */
export interface FloorDef {
  id: string;
  label: string;
  description: string;
  status: 'open' | 'soon';
  plannedFor?: string;
}

export const FLOORS: FloorDef[] = [
  {
    id: 'toit',
    label: 'Toit-terrasse',
    description: 'Vue sur tout MalinosLand, événements en plein air.',
    status: 'soon',
  },
  {
    id: 'tour',
    label: 'Étages de la Tour communautaire',
    description: 'Un couloir et une porte par logement, des espaces publics par étage.',
    status: 'soon',
  },
  {
    id: 'hub',
    label: 'RDC — Le Hub',
    description: 'Hall, coworking, conférence, salon, galerie.',
    status: 'open',
  },
];
