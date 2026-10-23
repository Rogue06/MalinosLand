/**
 * Quiz IA des Malinos (v0.35) : les questions. Des notions durables (histoire de l'IA,
 * vocabulaire, bons usages, culture numérique) plutôt que l'actualité, qui vieillit vite.
 * Chaque question a 4 choix, une explication et, si possible, une source.
 *
 * ⚠️ Toute nouvelle question est relue par le responsable ou un modérateur avant d'être publiée
 * (DEC-030). Un test vérifie la forme : 4 choix distincts, réponse valide, identifiants uniques.
 */
export type QuizTheme = 'histoire' | 'notions' | 'usages' | 'culture';

export interface QuizQuestion {
  id: string;
  theme: QuizTheme;
  /** 1 facile, 2 moyen, 3 plus pointu. */
  level: 1 | 2 | 3;
  question: string;
  /** Exactement 4 choix ; l'ordre est mélangé à l'affichage. */
  choices: [string, string, string, string];
  /** Index de la bonne réponse dans `choices`. */
  answer: 0 | 1 | 2 | 3;
  /** Affichée après la réponse : on apprend quelque chose, juste ou faux. */
  explain: string;
  source?: string;
}

export const QUIZ_THEMES: Record<QuizTheme, string> = {
  histoire: 'Histoire de l’IA',
  notions: 'Notions',
  usages: 'Bons usages',
  culture: 'Culture numérique',
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // ------------------------------------------------------------ Histoire de l'IA
  {
    id: 'turing-1950',
    theme: 'histoire',
    level: 1,
    question:
      'En quelle année Alan Turing a-t-il proposé son « jeu de l’imitation », devenu le test de Turing ?',
    choices: ['1950', '1936', '1969', '1984'],
    answer: 0,
    explain:
      'Dans l’article « Computing Machinery and Intelligence », Turing propose de remplacer la question « les machines peuvent-elles penser ? » par un jeu : un humain arrive-t-il à distinguer une machine d’une personne en conversant par écrit ?',
    source: 'A. M. Turing, revue Mind, 1950',
  },
  {
    id: 'dartmouth-1956',
    theme: 'histoire',
    level: 2,
    question:
      'Quelle rencontre de l’été 1956 est considérée comme l’acte de naissance de l’« intelligence artificielle » comme domaine de recherche ?',
    choices: [
      'Le projet d’été de Dartmouth',
      'La conférence d’Asilomar',
      'Le sommet de Bletchley Park',
      'Le congrès Solvay',
    ],
    answer: 0,
    explain:
      'John McCarthy, Marvin Minsky, Nathaniel Rochester et Claude Shannon y réunissent des chercheurs ; l’expression « artificial intelligence » vient de leur proposition de 1955.',
  },
  {
    id: 'deep-blue',
    theme: 'histoire',
    level: 1,
    question:
      'Quel ordinateur d’IBM a battu le champion du monde d’échecs Garry Kasparov en 1997 ?',
    choices: ['Deep Blue', 'Watson', 'AlphaGo', 'Stockfish'],
    answer: 0,
    explain:
      'Deep Blue gagne le match revanche de 1997 (3,5 à 2,5). Watson, autre machine d’IBM, a gagné au jeu télévisé Jeopardy! en 2011.',
  },
  {
    id: 'alphago',
    theme: 'histoire',
    level: 1,
    question: 'En 2016, le programme AlphaGo de DeepMind a battu Lee Sedol à quel jeu ?',
    choices: ['Le go', 'Les échecs', 'Le shōgi', 'Le poker'],
    answer: 0,
    explain:
      'AlphaGo gagne 4 parties sur 5. Le go était réputé trop complexe pour les ordinateurs : bien plus de positions possibles qu’aux échecs.',
  },
  {
    id: 'eliza',
    theme: 'histoire',
    level: 2,
    question:
      'Comment s’appelait le programme conversationnel de 1966, créé par Joseph Weizenbaum, qui imitait un psychothérapeute ?',
    choices: ['ELIZA', 'ALICE', 'Clippy', 'HAL'],
    answer: 0,
    explain:
      'ELIZA reformulait les phrases de l’utilisateur avec des règles simples. Beaucoup de gens lui prêtaient pourtant une vraie compréhension : on parle depuis d’« effet ELIZA ».',
  },
  {
    id: 'transformer',
    theme: 'histoire',
    level: 2,
    question:
      'L’article « Attention Is All You Need » (2017) a introduit l’architecture au cœur des grands modèles de langage actuels. Laquelle ?',
    choices: ['Le Transformer', 'Le réseau convolutif', 'Le LSTM', 'Le perceptron'],
    answer: 0,
    explain:
      'Le Transformer repose sur le mécanisme d’« attention », qui relie chaque mot à tous les autres d’un texte. C’est le « T » de GPT (Generative Pre-trained Transformer).',
    source: 'Vaswani et al., 2017',
  },
  {
    id: 'hiver-ia',
    theme: 'histoire',
    level: 2,
    question: 'Que désigne l’expression « hiver de l’IA » ?',
    choices: [
      'Une période de désintérêt et de baisse des financements',
      'Une panne mondiale des serveurs d’IA pendant une vague de froid',
      'Les premiers essais d’utilisation de l’IA pour prévoir la météo',
      'Le nom de code d’un modèle de langage sorti en décembre',
    ],
    answer: 0,
    explain:
      'Après des promesses trop ambitieuses, l’IA a connu des « hivers », notamment dans les années 1970 et à la fin des années 1980, avant de repartir.',
  },
  {
    id: 'lovelace',
    theme: 'histoire',
    level: 1,
    question:
      'Qui est souvent considérée comme la première programmeuse, pour ses notes de 1843 sur la machine analytique de Charles Babbage ?',
    choices: ['Ada Lovelace', 'Grace Hopper', 'Marie Curie', 'Hedy Lamarr'],
    answer: 0,
    explain:
      'Ada Lovelace y décrit un algorithme pour calculer les nombres de Bernoulli, et imagine déjà qu’une machine pourrait manipuler autre chose que des nombres, comme de la musique.',
  },
  // ------------------------------------------------------------ Notions
  {
    id: 'token',
    theme: 'notions',
    level: 1,
    question: 'Pour un modèle de langage, qu’est-ce qu’un « token » ?',
    choices: [
      'Un petit morceau de texte : un mot, une partie de mot ou un signe',
      'Un jeton de connexion qui prouve que l’utilisateur est abonné',
      'Une unité de monnaie numérique utilisée pour payer le calcul',
      'Une étiquette ajoutée à chaque phrase pour indiquer sa langue',
    ],
    answer: 0,
    explain:
      'Le modèle découpe le texte en tokens avant de le traiter. Un mot long ou rare peut en compter plusieurs, et les limites des modèles se comptent en tokens.',
  },
  {
    id: 'hallucination',
    theme: 'notions',
    level: 1,
    question: 'On dit qu’une IA « hallucine » quand…',
    choices: [
      'elle invente une réponse fausse en la présentant avec assurance',
      'elle génère une image à partir d’une description écrite',
      'elle met beaucoup de temps à répondre parce qu’elle est surchargée',
      'elle refuse de répondre à une question jugée dangereuse',
    ],
    answer: 0,
    explain:
      'Un modèle de langage produit le texte le plus plausible, pas forcément le plus vrai : il peut inventer un chiffre, une citation ou une source. D’où l’importance de vérifier.',
  },
  {
    id: 'prompt',
    theme: 'notions',
    level: 1,
    question: 'Qu’est-ce qu’un « prompt » ?',
    choices: [
      'La consigne ou la question qu’on donne à l’IA',
      'Le logiciel qui fait tourner l’IA sur l’ordinateur',
      'Le message d’erreur affiché quand l’IA plante',
      'La première phrase de la réponse de l’IA',
    ],
    answer: 0,
    explain:
      'Le prompt, c’est tout ce qu’on écrit pour guider l’IA : la demande, le contexte, des exemples, le format attendu.',
  },
  {
    id: 'llm',
    theme: 'notions',
    level: 1,
    question: 'Que signifie le sigle « LLM » ?',
    choices: [
      'Large Language Model : grand modèle de langage',
      'Logiciel libre modulaire : un logiciel en briques réutilisables',
      'Low Latency Machine : un serveur qui répond très vite',
      'Linear Learning Method : une méthode d’apprentissage linéaire',
    ],
    answer: 0,
    explain:
      'Un LLM est un modèle entraîné sur d’énormes quantités de texte pour prédire la suite d’un texte. C’est la technologie derrière les assistants conversationnels.',
  },
  {
    id: 'supervise',
    theme: 'notions',
    level: 2,
    question: 'L’« apprentissage supervisé » consiste à entraîner un modèle…',
    choices: [
      'sur des exemples accompagnés de la bonne réponse',
      'sous la surveillance d’un humain en temps réel',
      'sur des données brutes, sans aucune indication',
      'en le faisant jouer des millions de parties contre lui-même',
    ],
    answer: 0,
    explain:
      'Par exemple, des milliers de photos étiquetées « chat » ou « chien ». Jouer contre soi-même relève plutôt de l’apprentissage par renforcement (comme AlphaGo).',
  },
  {
    id: 'contexte',
    theme: 'notions',
    level: 2,
    question: 'Qu’est-ce que la « fenêtre de contexte » d’un modèle de langage ?',
    choices: [
      'La quantité de texte qu’il peut prendre en compte à la fois',
      'La taille de la fenêtre de discussion affichée à l’écran',
      'La liste des sites qu’il a le droit de consulter sur Internet',
      'La période couverte par ses données, jusqu’à sa dernière mise à jour',
    ],
    answer: 0,
    explain:
      'Tout ce qui dépasse la fenêtre de contexte est « oublié » pendant la conversation : c’est pour ça qu’une très longue discussion peut lui faire perdre le fil.',
  },
  {
    id: 'fine-tuning',
    theme: 'notions',
    level: 2,
    question: 'Que veut dire « fine-tuning » (affinage) d’un modèle ?',
    choices: [
      'Le ré-entraîner un peu sur des données spécifiques à une tâche',
      'Le compresser pour qu’il prenne moins de place en mémoire',
      'Corriger ses fautes d’orthographe après chaque réponse',
      'Réécrire son prompt jusqu’à obtenir la réponse parfaite',
    ],
    answer: 0,
    explain:
      'On part d’un modèle déjà entraîné et on le spécialise (un style, un domaine, une tâche) avec beaucoup moins de données qu’au départ.',
  },
  {
    id: 'rag',
    theme: 'notions',
    level: 3,
    question: 'En quoi consiste le « RAG » (génération augmentée par récupération) ?',
    choices: [
      'Donner au modèle des documents trouvés pour appuyer sa réponse',
      'Réduire la taille d’un modèle pour qu’il tienne sur un téléphone',
      'Faire relire chaque réponse du modèle par un autre modèle',
      'Entraîner le modèle à nouveau chaque nuit avec les conversations du jour',
    ],
    answer: 0,
    explain:
      'Le modèle répond à partir de documents trouvés pour l’occasion (une base de connaissances, des fichiers) : ses réponses sont plus à jour et plus faciles à vérifier.',
  },
  {
    id: 'temperature',
    theme: 'notions',
    level: 2,
    question: 'Le réglage de « température » d’un modèle de langage influe sur…',
    choices: [
      'le côté plus ou moins aléatoire et créatif de ses réponses',
      'la chaleur que peuvent supporter les serveurs avant de ralentir',
      'la vitesse à laquelle les mots s’affichent à l’écran',
      'le niveau de politesse et de formalité des réponses',
    ],
    answer: 0,
    explain:
      'Basse, le modèle choisit presque toujours le mot le plus probable (réponses stables) ; haute, il ose des choix moins probables (plus de variété, plus de risques).',
  },
  {
    id: 'multimodal',
    theme: 'notions',
    level: 2,
    question: 'Qu’appelle-t-on un modèle « multimodal » ?',
    choices: [
      'Un modèle qui comprend texte, images et son',
      'Un modèle qui parle couramment plusieurs langues humaines',
      'Un modèle découpé en morceaux répartis sur plusieurs serveurs',
      'Un modèle qui change de personnalité selon l’utilisateur',
    ],
    answer: 0,
    explain:
      'Il peut par exemple décrire une photo, lire un graphique ou répondre à une question posée à voix haute.',
  },
  {
    id: 'agent',
    theme: 'notions',
    level: 2,
    question: 'Un « agent » IA, c’est en général…',
    choices: [
      'une IA qui enchaîne des actions avec des outils pour atteindre un but',
      'une personne chargée de surveiller ce que répond l’IA',
      'un programme qui protège l’ordinateur contre les virus créés par IA',
      'un assistant qui répond à une seule question, sans rien faire d’autre',
    ],
    answer: 0,
    explain:
      'Un agent planifie, agit (chercher sur le web, lancer du code, remplir un fichier…), regarde le résultat et recommence jusqu’à atteindre le but qu’on lui a fixé.',
  },
  {
    id: 'embedding',
    theme: 'notions',
    level: 3,
    question: 'Qu’est-ce qu’un « embedding » ?',
    choices: [
      'Des nombres qui représentent le sens d’un texte',
      'Une vidéo ou une carte intégrée dans une page web',
      'Une façon de cacher un message secret dans une image',
      'Un petit modèle installé directement sur un téléphone',
    ],
    answer: 0,
    explain:
      'Deux textes de sens proche ont des embeddings proches : c’est ce qui permet de rechercher par le sens plutôt que par mots-clés (et c’est la base du RAG).',
  },
  {
    id: 'parametres',
    theme: 'notions',
    level: 3,
    question: 'Quand on parle des « milliards de paramètres » d’un modèle, de quoi s’agit-il ?',
    choices: [
      'Des valeurs (poids) apprises pendant l’entraînement',
      'Des réglages que l’utilisateur peut changer dans l’interface',
      'Du nombre de personnes qui utilisent le modèle chaque mois',
      'Du nombre de pages de texte lues pendant l’entraînement',
    ],
    answer: 0,
    explain:
      'Les paramètres sont les nombres que l’entraînement ajuste petit à petit. Plus il y en a, plus le modèle peut retenir de choses… et plus il demande de calcul.',
  },
  // ------------------------------------------------------------ Bons usages
  {
    id: 'donnees-perso',
    theme: 'usages',
    level: 1,
    question: 'Avant de coller un document dans une IA en ligne, que faut-il vérifier d’abord ?',
    choices: [
      'Qu’il ne contient pas de données personnelles ou confidentielles',
      'Qu’il est bien mis en page, sinon l’IA ne pourra pas le lire',
      'Qu’il fait moins d’une page, la limite de toutes les IA',
      'Qu’il est écrit en anglais, la seule langue bien comprise',
    ],
    answer: 0,
    explain:
      'Ce que tu envoies part sur les serveurs du service, et peut parfois servir à l’entraîner. Retire noms, adresses, contrats ou secrets professionnels.',
  },
  {
    id: 'verifier-source',
    theme: 'usages',
    level: 1,
    question: 'Une IA te donne un chiffre précis « avec une source ». Quel est le bon réflexe ?',
    choices: [
      'Ouvrir et vérifier la source moi-même',
      'Le croire : une source est citée, donc c’est vérifié',
      'Le partager tout de suite, c’est une information utile',
      'Poser la même question à une autre IA, sans aller plus loin',
    ],
    answer: 0,
    explain:
      'Une IA peut inventer une source qui a l’air sérieuse, ou mal la résumer. Une vérification rapide évite de propager une erreur.',
  },
  {
    id: 'rgpd',
    theme: 'usages',
    level: 1,
    question: 'En Europe, quel texte encadre l’utilisation des données personnelles ?',
    choices: ['Le RGPD', 'Le DMCA', 'Le Code de la route', 'La loi de Moore'],
    answer: 0,
    explain:
      'Le règlement général sur la protection des données (2018) te donne notamment le droit d’accéder à tes données et de les faire effacer. MalinosLand permet de supprimer son compte en un clic.',
  },
  {
    id: 'ai-act',
    theme: 'usages',
    level: 2,
    question:
      'Quel règlement européen classe les systèmes d’IA selon leur niveau de risque (inacceptable, élevé, limité, minimal) ?',
    choices: [
      'L’AI Act, le règlement européen sur l’IA',
      'Le RGPD',
      'Le règlement sur les services numériques (DSA)',
      'La directive sur le droit d’auteur',
    ],
    answer: 0,
    explain:
      'Adopté en 2024, il s’applique par étapes. Plus un usage est risqué (par exemple pour l’emploi ou la santé), plus les obligations sont fortes ; certains usages sont interdits.',
  },
  {
    id: 'deepfake',
    theme: 'usages',
    level: 1,
    question: 'Qu’est-ce qu’un « deepfake » ?',
    choices: [
      'Une vidéo, une voix ou une image truquée par IA',
      'Une erreur très grave cachée au plus profond d’un programme',
      'Un réseau social caché, accessible seulement avec un logiciel spécial',
      'Une copie de sauvegarde chiffrée, impossible à ouvrir sans clé',
    ],
    answer: 0,
    explain:
      'Face à une vidéo ou un message vocal surprenant, surtout s’il demande de l’argent ou une action urgente : on vérifie par un autre canal avant d’agir.',
  },
  {
    id: 'bon-prompt',
    theme: 'usages',
    level: 1,
    question: 'Pour obtenir une meilleure réponse d’une IA, qu’est-ce qui aide le plus ?',
    choices: [
      'Donner du contexte, un objectif clair et un exemple du résultat voulu',
      'Écrire en majuscules pour qu’elle comprenne que c’est important',
      'Être le plus bref possible : un ou deux mots-clés suffisent',
      'Poser la même question plusieurs fois de suite, sans rien changer',
    ],
    answer: 0,
    explain:
      'Qui tu es, ce que tu veux en faire, le format attendu, un exemple : l’IA n’a que ce que tu lui donnes. Et tu peux toujours lui demander d’améliorer sa réponse.',
  },
  // ------------------------------------------------------------ Culture numérique
  {
    id: 'open-source',
    theme: 'culture',
    level: 1,
    question: 'Que veut dire « open source » ?',
    choices: [
      'Le code est public et peut être étudié, modifié et partagé selon une licence',
      'Le logiciel est gratuit et chacun en fait ce qu’il veut, sans aucune règle',
      'Le logiciel fonctionne seulement en ligne, depuis un navigateur',
      'Le code a été écrit par une IA et ne peut donc pas être protégé',
    ],
    answer: 0,
    explain:
      'La licence fixe les règles du partage. MalinosLand est open source (licence AGPL-3.0) : chacun peut lire son code et proposer des améliorations.',
  },
  {
    id: 'pull-request',
    theme: 'culture',
    level: 2,
    question: 'Dans un projet de code, qu’est-ce qu’une « pull request » ?',
    choices: [
      'Une proposition de modification, relue avant fusion',
      'Le téléchargement de la dernière version du code',
      'Un signalement de bug urgent envoyé aux développeurs',
      'Une demande d’accès au projet pour un nouveau membre',
    ],
    answer: 0,
    explain:
      'C’est comme ça que MalinosLand se construit : chaque nouveauté est proposée, testée et relue avant d’arriver dans le monde.',
  },
  {
    id: 'devise',
    theme: 'culture',
    level: 1,
    question: 'Quelle est la devise des Malinos ?',
    choices: [
      'Comprendre · Penser · Agir',
      'Coder · Tester · Recommencer',
      'Voir · Croire · Partager',
      'Apprendre · Gagner · Briller',
    ],
    answer: 0,
    explain:
      'Elle est sur le totem à l’entrée du Hub. Joshua la répète souvent. Peut-être un peu trop.',
  },
];
