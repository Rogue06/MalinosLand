/** Étages desservis par l'ascenseur. Seul le rez-de-chaussée existe en v0.1. */
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
    plannedFor: 'v0.4',
  },
  {
    id: 'tour',
    label: 'Étages 1 et + — Tour communautaire',
    description: 'Les logements personnels des Malinos, chargés à la demande.',
    status: 'soon',
    plannedFor: 'v0.3 – v0.4',
  },
  {
    id: 'hub',
    label: 'RDC — Le Hub',
    description: 'Hall, coworking, conférence, salon, galerie.',
    status: 'open',
  },
];
