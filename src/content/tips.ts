/** Astuces affichées sur le poste « Astuce IA du jour » du coworking. */
export const AI_TIPS: string[] = [
  'Donne du contexte à ton assistant IA : qui tu es, ce que tu veux obtenir et sous quel format.',
  'Demande à l’IA de reformuler ta demande avant de répondre : tu verras vite si elle a bien compris.',
  'Pour du code, fournis un exemple d’entrée et de sortie attendue : les réponses seront plus justes.',
  'Découpe les grosses tâches en petites étapes vérifiables plutôt que de tout demander d’un coup.',
  'Relis toujours le code généré : l’IA peut se tromper avec beaucoup d’assurance.',
  'Garde un fichier de contexte dans tes projets (comme CLAUDE.md ici) pour que chaque session reparte du bon pied.',
  'Ne colle jamais de mot de passe, clé d’API ou donnée personnelle dans une conversation avec une IA.',
  'Demande plusieurs propositions puis compare-les : la première n’est pas toujours la meilleure.',
  'Quand une réponse est fausse, explique pourquoi plutôt que de simplement redemander.',
  'Partage tes meilleures astuces avec les autres Malinos : c’est l’esprit de MalinosLand !',
];

/** Astuce du jour, stable sur une journée. */
export function tipOfTheDay(date = new Date()): number {
  const day = Math.floor(date.getTime() / 86400000);
  return day % AI_TIPS.length;
}
