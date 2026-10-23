/**
 * Quiz IA des Malinos (v0.35) : les questions. Des notions durables (histoire de l'IA,
 * vocabulaire, bons usages, culture numérique) plutôt que l'actualité, qui vieillit vite.
 * Chaque question a 4 choix, une explication et, si possible, une source.
 *
 * ⚠️ Toute nouvelle question est relue par le responsable ou un modérateur avant d'être publiée
 * (DEC-030). Un test vérifie la forme : 4 choix distincts, réponse valide, identifiants uniques.
 */
export type QuizTheme = 'bases' | 'histoire' | 'notions' | 'usages' | 'culture';

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
  bases: 'Les bases de l’IA',
  histoire: 'Histoire de l’IA',
  notions: 'Notions',
  usages: 'Bons usages',
  culture: 'Culture numérique',
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // ------------------------------------------------------------ Les bases de l'IA
  {
    id: 'ia-definition',
    theme: 'bases',
    level: 1,
    question: 'Qu’appelle-t-on « intelligence artificielle » ?',
    choices: [
      'Des programmes qui font des tâches demandant d’habitude notre intelligence',
      'Des robots humanoïdes capables de ressentir des émotions comme nous',
      'Un ordinateur très puissant qui connaît la réponse à toutes les questions',
      'Un logiciel qui fonctionne tout seul, sans avoir été programmé par personne',
    ],
    answer: 0,
    explain:
      'Comprendre une phrase, reconnaître une image, traduire, jouer aux échecs… L’IA regroupe beaucoup de techniques différentes, et la plupart n’ont rien à voir avec des robots.',
  },
  {
    id: 'modele-vs-llm',
    theme: 'bases',
    level: 1,
    question: 'Quelle est la différence entre un « modèle d’IA » et un « LLM » ?',
    choices: [
      'Un LLM est un type de modèle d’IA, spécialisé dans le langage',
      'Aucune : ce sont deux noms différents pour exactement la même chose',
      'Un modèle d’IA est toujours bien plus gros et plus puissant qu’un LLM',
      'Un LLM fonctionne en ligne, alors qu’un modèle tourne sur l’ordinateur',
    ],
    answer: 0,
    explain:
      '« Modèle » est le terme général : il existe des modèles pour reconnaître des images, prévoir la météo, générer de la musique… Un LLM est un modèle entraîné sur du texte pour lire et écrire.',
  },
  {
    id: 'llm-ecrit',
    theme: 'bases',
    level: 2,
    question: 'Comment un LLM écrit-il sa réponse ?',
    choices: [
      'Il prédit le morceau de texte suivant, puis recommence, encore et encore',
      'Il cherche la réponse toute faite dans une immense base de données',
      'Il recopie le site web le plus pertinent qu’il a trouvé sur Internet',
      'Il réfléchit à toute la réponse d’un coup, puis l’affiche lettre par lettre',
    ],
    answer: 0,
    explain:
      'Un LLM choisit le token le plus adapté à la suite du texte, l’ajoute, et recommence. C’est pour ça que la réponse s’affiche petit à petit, et qu’il peut se tromper avec aplomb.',
  },
  {
    id: 'machine-learning',
    theme: 'bases',
    level: 1,
    question: 'Qu’est-ce que le « machine learning » (apprentissage automatique) ?',
    choices: [
      'Une façon de créer une IA qui apprend à partir d’exemples',
      'Le fait d’apprendre à utiliser une machine grâce à un tutoriel',
      'Une méthode pour réparer automatiquement les ordinateurs en panne',
      'Un cours en ligne pour apprendre à programmer des robots industriels',
    ],
    answer: 0,
    explain:
      'Au lieu d’écrire toutes les règles à la main, on montre au programme beaucoup d’exemples et il trouve lui-même les régularités. Presque toute l’IA actuelle fonctionne ainsi.',
  },
  {
    id: 'deep-learning',
    theme: 'bases',
    level: 2,
    question: 'Qu’appelle-t-on le « deep learning » (apprentissage profond) ?',
    choices: [
      'L’apprentissage avec des réseaux de neurones à très nombreuses couches',
      'Un apprentissage très lent qui dure plusieurs années sans s’arrêter',
      'L’étude de l’IA réservée aux chercheurs les plus expérimentés',
      'Une IA qui apprend uniquement pendant que l’ordinateur est en veille',
    ],
    answer: 0,
    explain:
      '« Profond » parle du nombre de couches du réseau. Le deep learning a fait décoller la reconnaissance d’images, de la voix, puis les modèles de langage.',
  },
  {
    id: 'reseau-neurones',
    theme: 'bases',
    level: 1,
    question: 'Un réseau de neurones artificiels est inspiré…',
    choices: [
      'du fonctionnement des neurones du cerveau',
      'de la forme des réseaux de câbles électriques',
      'de l’organisation des fourmis dans une fourmilière',
      'du plan du métro d’une grande ville comme Paris',
    ],
    answer: 0,
    explain:
      'Chaque « neurone » artificiel reçoit des nombres, les combine et transmet le résultat aux suivants. L’inspiration vient du cerveau, mais le fonctionnement reste très différent.',
  },
  {
    id: 'entrainer',
    theme: 'bases',
    level: 1,
    question: 'Que veut dire « entraîner » un modèle d’IA ?',
    choices: [
      'Ajuster ses réglages à partir d’une grande quantité de données',
      'Lui faire passer un examen pour vérifier qu’il fonctionne bien',
      'Le faire tourner en continu pour qu’il ne refroidisse jamais',
      'Lui apprendre les bonnes manières en lui parlant poliment',
    ],
    answer: 0,
    explain:
      'L’entraînement ajuste petit à petit des milliards de paramètres pour que le modèle réponde de mieux en mieux sur des exemples. C’est l’étape qui demande le plus de calcul.',
  },
  {
    id: 'inference',
    theme: 'bases',
    level: 2,
    question: 'En IA, qu’appelle-t-on l’« inférence » ?',
    choices: [
      'Le moment où un modèle déjà entraîné produit une réponse',
      'La période pendant laquelle le modèle apprend de ses données',
      'L’influence qu’une IA peut avoir sur les opinions des gens',
      'Le contrôle d’un modèle par une autorité avant sa sortie',
    ],
    answer: 0,
    explain:
      'Entraînement d’abord, inférence ensuite : chaque fois que tu poses une question à un assistant, le modèle fait une inférence.',
  },
  {
    id: 'ia-generative',
    theme: 'bases',
    level: 1,
    question: 'Qu’est-ce qui caractérise une IA « générative » ?',
    choices: [
      'Elle crée du contenu nouveau : texte, image, son ou code',
      'Elle génère de l’électricité pour alimenter les serveurs',
      'Elle sert seulement à classer des documents existants',
      'Elle est capable de se reproduire et de se copier toute seule',
    ],
    answer: 0,
    explain:
      'Les assistants qui écrivent, les générateurs d’images ou de musique sont des IA génératives. D’autres IA, dites « discriminatives », classent ou reconnaissent plutôt qu’elles ne créent.',
  },
  {
    id: 'chatbot',
    theme: 'bases',
    level: 1,
    question: 'Qu’est-ce qu’un « chatbot » ?',
    choices: [
      'Un programme avec lequel on discute par messages',
      'Un robot de compagnie en forme de chat',
      'Un virus qui se propage par les messageries',
      'Un salon de discussion réservé aux développeurs',
    ],
    answer: 0,
    explain:
      'Les premiers chatbots suivaient des règles écrites à la main (comme ELIZA en 1966). Les assistants actuels reposent sur des modèles de langage.',
  },
  {
    id: 'gpt-sigle',
    theme: 'bases',
    level: 2,
    question: 'Que signifie le sigle « GPT » ?',
    choices: [
      'Generative Pre-trained Transformer',
      'General Purpose Technology',
      'Global Prediction Tool',
      'Graphical Processing Terminal',
    ],
    answer: 0,
    explain:
      '« Génératif » parce qu’il produit du texte, « pré-entraîné » sur un énorme corpus avant d’être spécialisé, et « Transformer » pour son architecture (2017).',
  },
  {
    id: 'chatgpt-vs-gpt',
    theme: 'bases',
    level: 2,
    question: 'Quelle est la différence entre ChatGPT et GPT ?',
    choices: [
      'ChatGPT est une application de discussion ; GPT, les modèles derrière',
      'ChatGPT est la version gratuite ; GPT, la version payante du même outil',
      'ChatGPT répond en français ; GPT ne répond qu’en anglais',
      'Aucune : ChatGPT est simplement le nouveau nom de GPT',
    ],
    answer: 0,
    explain:
      'C’est la différence entre une application et le modèle qui la fait fonctionner. Beaucoup d’autres applications utilisent leurs propres modèles, ou ceux d’autres entreprises.',
  },
  {
    id: 'date-connaissances',
    theme: 'bases',
    level: 2,
    question: 'Que veut dire la « date de fin des connaissances » d’un modèle ?',
    choices: [
      'Après cette date, il n’a pas d’informations venant de son entraînement',
      'La date à laquelle le modèle cessera de fonctionner pour de bon',
      'La date limite pour s’inscrire et pouvoir utiliser le modèle',
      'Le jour où le modèle efface toutes les conversations des utilisateurs',
    ],
    answer: 0,
    explain:
      'Un modèle ne connaît le monde que jusqu’à la fin de ses données d’entraînement. Pour l’actualité, il lui faut une recherche web ou des documents fournis.',
  },
  {
    id: 'biais',
    theme: 'bases',
    level: 1,
    question: 'Pourquoi un modèle d’IA peut-il avoir des « biais » ?',
    choices: [
      'Il reproduit les déséquilibres et préjugés présents dans ses données',
      'Il est volontairement réglé pour avoir des opinions politiques',
      'Il manque de mémoire et oublie la moitié de ce qu’il apprend',
      'Il est surtout utilisé par des personnes qui pensent de la même façon',
    ],
    answer: 0,
    explain:
      'Si les exemples d’entraînement sont déséquilibrés (par exemple surtout des hommes pour un métier), le modèle risque de reproduire ce déséquilibre. On le corrige en partie, pas totalement.',
  },
  {
    id: 'poids-ouverts',
    theme: 'bases',
    level: 2,
    question: 'Qu’est-ce qu’un modèle à « poids ouverts » (open weights) ?',
    choices: [
      'Un modèle dont les paramètres sont publiés et utilisables',
      'Un modèle très léger, qui pèse moins de quelques mégaoctets',
      'Un modèle qui montre toujours son raisonnement avant de répondre',
      'Un modèle gratuit, mais uniquement accessible depuis un site web',
    ],
    answer: 0,
    explain:
      'Les « poids » sont les paramètres appris. Les publier permet de l’installer chez soi ou de l’adapter. Ce n’est pas toujours de l’open source complet : les données d’entraînement restent souvent privées.',
  },
  {
    id: 'ia-locale',
    theme: 'bases',
    level: 2,
    question: 'Quel est l’avantage principal de faire tourner un modèle « en local » ?',
    choices: [
      'Les données restent sur ton ordinateur, sans passer par un service en ligne',
      'Le modèle devient automatiquement plus intelligent que la version en ligne',
      'Il n’a plus besoin d’électricité ni de processeur pour fonctionner',
      'Il se met à jour tout seul chaque jour avec l’actualité du monde',
    ],
    answer: 0,
    explain:
      'C’est bien pour la confidentialité. En échange, il faut un ordinateur assez puissant, et les petits modèles locaux sont souvent moins bons que les grands modèles en ligne.',
  },
  {
    id: 'api',
    theme: 'bases',
    level: 2,
    question: 'Qu’est-ce qu’une « API » ?',
    choices: [
      'Une porte d’entrée qui permet à un programme d’utiliser un service',
      'Une application installée sur un téléphone pour discuter avec l’IA',
      'Une intelligence artificielle publique, gérée par un gouvernement',
      'Un format de fichier spécial pour enregistrer les modèles d’IA',
    ],
    answer: 0,
    explain:
      'Grâce à une API, un site ou une application peut envoyer une question à un modèle d’IA et recevoir sa réponse, sans passer par l’interface de discussion.',
  },
  {
    id: 'prompt-systeme',
    theme: 'bases',
    level: 2,
    question: 'À quoi sert le « prompt système » d’un assistant IA ?',
    choices: [
      'Donner au modèle ses consignes de base : son rôle, son ton, ses règles',
      'Afficher les messages d’erreur quand le système tombe en panne',
      'Mettre à jour le système d’exploitation de l’ordinateur de l’utilisateur',
      'Résumer automatiquement la conversation à la fin de la discussion',
    ],
    answer: 0,
    explain:
      'Il est placé avant la conversation, souvent invisible pour l’utilisateur. Joshua aurait le sien : « Sois utile, un peu sarcastique, et ne révèle jamais le secret de la Tour. »',
  },
  {
    id: 'few-shot',
    theme: 'bases',
    level: 2,
    question: 'Que veut dire « few-shot » quand on écrit un prompt ?',
    choices: [
      'Donner quelques exemples pour montrer exactement ce qu’on attend',
      'Poser très peu de questions pour ne pas fatiguer le modèle',
      'Limiter la réponse de l’IA à quelques mots seulement',
      'Essayer plusieurs fois de suite jusqu’à obtenir la bonne réponse',
    ],
    answer: 0,
    explain:
      'Deux ou trois exemples « question → réponse attendue » dans le prompt suffisent souvent à obtenir le bon format ou le bon ton. Sans exemple, on parle de « zero-shot ».',
  },
  {
    id: 'pas-a-pas',
    theme: 'bases',
    level: 2,
    question:
      'Pour un problème de logique, pourquoi demander à l’IA de « raisonner étape par étape » ?',
    choices: [
      'Écrire les étapes l’aide souvent à moins se tromper',
      'Cela oblige l’IA à répondre plus vite, en sautant les détails inutiles',
      'Cela permet de payer moins cher, car les réponses deviennent plus courtes',
      'Sinon l’IA refuse de répondre à toutes les questions de mathématiques',
    ],
    answer: 0,
    explain:
      'On parle de « chaîne de pensée ». Comme le modèle écrit token par token, détailler le raisonnement lui laisse de la place pour enchaîner correctement les étapes.',
  },
  {
    id: 'vision',
    theme: 'bases',
    level: 1,
    question: 'Que fait la « vision par ordinateur » ?',
    choices: [
      'Elle permet aux machines d’analyser des images et des vidéos',
      'Elle corrige automatiquement la vue des personnes qui portent des lunettes',
      'Elle améliore la qualité de l’écran pour moins fatiguer les yeux',
      'Elle filme les utilisateurs pour vérifier qu’ils regardent l’écran',
    ],
    answer: 0,
    explain:
      'Reconnaître un visage, lire une plaque, repérer une tumeur sur une radio, guider une voiture autonome : tout cela relève de la vision par ordinateur.',
  },
  {
    id: 'tal',
    theme: 'bases',
    level: 2,
    question: 'De quoi s’occupe le « traitement automatique du langage » (TAL, ou NLP) ?',
    choices: [
      'Faire comprendre et produire du langage humain par des machines',
      'Traduire les langages de programmation les uns dans les autres',
      'Corriger l’accent des personnes qui parlent une langue étrangère',
      'Compter le nombre de mots dans un document le plus vite possible',
    ],
    answer: 0,
    explain:
      'Traduction, résumé, correcteur, assistant vocal, chatbot : c’est le domaine du langage. Les LLM en sont aujourd’hui l’outil le plus connu.',
  },
  {
    id: 'speech-to-text',
    theme: 'bases',
    level: 1,
    question: 'Que fait la reconnaissance vocale (« speech-to-text ») ?',
    choices: [
      'Elle transforme la voix en texte écrit',
      'Elle reconnaît qui parle grâce à son visage',
      'Elle lit un texte à voix haute avec une voix de synthèse',
      'Elle traduit une chanson dans une autre langue',
    ],
    answer: 0,
    explain:
      'Le sens inverse, transformer un texte en voix, s’appelle la synthèse vocale (« text-to-speech »). Les assistants vocaux utilisent souvent les deux.',
  },
  {
    id: 'gpu',
    theme: 'bases',
    level: 2,
    question: 'Pourquoi utilise-t-on des cartes graphiques (GPU) pour entraîner les IA ?',
    choices: [
      'Elles font énormément de calculs simples en même temps',
      'Elles affichent de plus belles images pendant l’entraînement',
      'Elles consomment beaucoup moins d’électricité que tout le reste',
      'Ce sont les seules puces qui savent lire du texte écrit',
    ],
    answer: 0,
    explain:
      'Conçues pour calculer des millions de pixels à la fois, les cartes graphiques sont aussi parfaites pour les multiplications de nombres des réseaux de neurones.',
  },
  {
    id: 'donnees-entrainement',
    theme: 'bases',
    level: 1,
    question: 'Que sont les « données d’entraînement » d’un modèle ?',
    choices: [
      'Les exemples à partir desquels il apprend',
      'Les statistiques sportives des utilisateurs',
      'Les réglages choisis par l’utilisateur',
      'La liste des personnes qui ont créé le modèle',
    ],
    answer: 0,
    explain:
      'Textes, images, sons… Leur quantité, leur qualité et leur diversité comptent énormément : un modèle apprend aussi les erreurs et les biais de ses données.',
  },
  {
    id: 'surapprentissage',
    theme: 'bases',
    level: 3,
    question: 'Qu’appelle-t-on le « surapprentissage » (overfitting) ?',
    choices: [
      'Le modèle apprend ses exemples par cœur et réussit mal sur de nouveaux cas',
      'Le modèle s’entraîne si longtemps qu’il finit par surchauffer et s’arrêter',
      'Le modèle apprend trop de langues à la fois et finit par les mélanger',
      'Le modèle reçoit trop de questions en même temps et répond plus lentement',
    ],
    answer: 0,
    explain:
      'Comme un élève qui apprend les corrigés par cœur sans comprendre : parfait sur les exercices connus, perdu devant un nouveau sujet. On teste donc toujours un modèle sur des exemples qu’il n’a jamais vus.',
  },
  {
    id: 'renforcement',
    theme: 'bases',
    level: 2,
    question: 'Comment apprend une IA par « apprentissage par renforcement » ?',
    choices: [
      'Par essais et erreurs, en recevant des récompenses ou des pénalités',
      'En renforçant la sécurité de ses serveurs contre les attaques',
      'En relisant plusieurs fois les mêmes livres jusqu’à les connaître',
      'En copiant exactement les réponses données par un professeur humain',
    ],
    answer: 0,
    explain:
      'C’est ainsi qu’AlphaGo a progressé en jouant des millions de parties. Une variante avec des avis humains sert aussi à rendre les assistants plus utiles et plus polis.',
  },
  {
    id: 'agi',
    theme: 'bases',
    level: 2,
    question: 'Que désigne l’« AGI » (intelligence artificielle générale) ?',
    choices: [
      'Une IA hypothétique capable d’égaler l’humain dans la plupart des tâches',
      'L’agence gouvernementale qui autorise la sortie des nouveaux modèles',
      'Une IA générale de bureau, installée par défaut sur les ordinateurs',
      'Le nom donné à toutes les IA conçues avant les années 2000',
    ],
    answer: 0,
    explain:
      'Les IA actuelles sont très fortes sur certaines tâches et étonnamment faibles sur d’autres. Savoir si et quand une AGI existera fait débat entre chercheurs.',
  },
  {
    id: 'diffusion',
    theme: 'bases',
    level: 3,
    question:
      'Comment fonctionnent la plupart des générateurs d’images récents (« modèles de diffusion ») ?',
    choices: [
      'Ils partent d’un bruit aléatoire et le nettoient étape par étape',
      'Ils assemblent des morceaux d’images trouvées sur Internet',
      'Ils dessinent l’image trait par trait, comme un illustrateur',
      'Ils retouchent une photo existante choisie au hasard',
    ],
    answer: 0,
    explain:
      'Le modèle a appris à enlever du « bruit » d’une image. En partant d’une neige aléatoire et guidé par ta description, il fait apparaître une image nouvelle.',
  },
  {
    id: 'algorithme',
    theme: 'bases',
    level: 1,
    question: 'Qu’est-ce qu’un « algorithme » ?',
    choices: [
      'Une suite d’instructions précises pour résoudre un problème',
      'Un programme secret qui surveille ce qu’on fait sur Internet',
      'Une formule mathématique inventée par un savant arabe célèbre',
      'Un robot qui calcule plus vite que tous les humains réunis',
    ],
    answer: 0,
    explain:
      'Une recette de cuisine est un algorithme ! Le mot vient du nom du savant al-Khwârizmî (IXᵉ siècle), mais un algorithme n’est pas forcément mathématique.',
  },
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
