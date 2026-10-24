import { ExternalLink } from './Museum';

/**
 * « Essayer ici » (v0.4, PR 10, DEC-038) : la démo d'un projet du musée, dans un cadre isolé.
 * Ce composant n'est affiché qu'après un clic sur « Essayer ici » : rien n'est chargé avant.
 *
 * Le cadre montre la visionneuse du serveur (`/demo/:id`), qui encadre à son tour le site du
 * projet avec une CSP limitée à ce seul site. Les restrictions sont les mêmes aux deux niveaux :
 * - sandbox « allow-scripts allow-same-origin allow-forms » seulement : pas de navigation de la
 *   page du jeu, pas de fenêtres surgissantes, pas de téléchargements ;
 * - aucune permission (caméra, micro, position, paiement, plein écran…) ;
 * - aucune information de provenance, et sans les cookies du navigateur quand c'est possible.
 */
export function DemoFrame({
  viewer,
  url,
  onClose,
}: {
  /** Adresse de la visionneuse (src/services/museum.ts, demoViewerUrl). */
  viewer: string;
  /** Adresse du site du projet (affichée en clair, et lien de repli). */
  url: string;
  onClose: () => void;
}) {
  const host = new URL(url).hostname;
  return (
    <div class="demo">
      <div class="demo-bar">
        <span class="demo-host">
          🌐 Tu es sur <b>{host}</b>
        </span>
        <span class="row-actions">
          <ExternalLink url={url} label="Ouvrir dans un onglet" className="btn ghost small" />
          <button type="button" class="btn ghost small" onClick={onClose}>
            Fermer la démo
          </button>
        </span>
      </div>
      <p class="muted small demo-note">
        Site externe : il reçoit ton adresse IP, comme si tu l’ouvrais toi-même. Il fonctionne dans
        une fenêtre isolée et ne voit rien de MalinosLand ni de ton compte. S’il reste blanc,
        ouvre-le dans un onglet.
      </p>
      <iframe
        class="demo-frame"
        src={viewer}
        title={`Démo de ${host}`}
        sandbox="allow-scripts allow-same-origin allow-forms"
        allow=""
        referrerpolicy="no-referrer"
        {...{ credentialless: true }}
      />
    </div>
  );
}
