import Phaser from 'phaser';
import { QUESTS } from '../../content/quests';
import { followUpLines, moodLine } from '../../content/joshua';
import { SECRETS } from '../../content/secrets';
import { HOME_EXIT, HUB_ROOM, mapIdForRoom } from '../../content/rooms';
import { HOME_RULES, loadHomeWorld, loadWorld } from '../../content/world';
import { project, screenInputToWorld, unproject, type Facing, type Vec2 } from '../../core/iso';
import { facesCamera } from '../../core/rotation';
import { SoundGate } from '../../core/soundGate';
import { CHAT_MAX_LENGTH, mentions, sanitizeText } from '../../core/text';
import { REALTIME_URL } from '../../config';
import { NetworkClient, type RemotePeer } from '../../multiplayer/NetworkClient';
import { ServerTransport } from '../../multiplayer/ServerTransport';
import {
  EMOTES,
  LOCAL_CHAT_RADIUS,
  accountPlayerId,
  homeOwner,
  homeRoom,
  randomId,
  type AnimState,
  type Emote,
  type NoticeCode,
  type Role,
} from '../../multiplayer/protocol';
import { accessToken, accountStore, setOwnRole } from '../../services/account';
import { nameWithBadge } from '../../content/roles';
import { hiddenStore, isHidden } from '../../services/moderation';
import {
  ambienceForZone,
  playSound,
  setAmbience,
  setAudioPaused,
  setDiscoLevel,
  setSpotSound,
  type SpotSound,
} from '../../services/audio';
import { isTouchDevice } from '../../services/device';
import {
  loadMuseumWall,
  museumWallStore,
  previewUrl,
  type MuseumProject,
  type MuseumWall,
} from '../../services/museum';
import { MUSEUM_SAMPLES } from '../../content/museum';
import { fetchDecor, myHomeAccess, saveMyDecor, type HomeAccess } from '../../services/homes';
import { checkPendingInvitations } from '../../services/invitations';
import {
  BroadcastChannelTransport,
  OfflineTransport,
  type Transport,
} from '../../multiplayer/Transport';
import { completeQuest, findSecret, progressStore, secretsStore } from '../../services/progress';
import { profileStore, type Profile } from '../../services/profile';
import { renderProfile, settingsStore, type Settings } from '../../services/settings';
import {
  commands,
  dialogStore,
  hintStore,
  isInputLocked,
  nearbyStore,
  panelStore,
  peersPosStore,
  playerPosStore,
  presenceStore,
  projectFocusStore,
  pushChat,
  pushInvitation,
  pushToast,
  roomStore,
  statsStore,
  typingStore,
  worldInfoStore,
  skyStore,
  crowdStore,
  zoneStore,
  type DecorAction,
} from '../../state';
import { parseDecor, type DecorItem } from '../../world/decor';
import { PlayerController, USE_RANGE } from '../../world/PlayerController';
import type { WorldModel, WorldObject } from '../../world/WorldModel';
import { avatarDepth, DepthIndex } from '../../world/depth';
import type { InteractionDef } from '../../world/types';
import { DecorEditor } from '../DecorEditor';
import { AvatarView } from '../entities/AvatarView';
import { AmbientLife } from '../life/AmbientLife';
import { DayNight } from '../life/DayNight';
import { DanceFloor } from '../life/DanceFloor';
import { JoshuaLife } from '../life/JoshuaLife';
import { TextureFactory, type TextureArt } from '../textures';
import { bakedArt, preloadBakedArt } from '../art/bakedArt';
import { BACKREST_DEPTH, WorldRenderer } from '../WorldRenderer';

/**
 * Décorations des logements déjà chargées (par salle) : la salle s'affiche aussitôt meublée.
 * null : studio d'origine.
 */
const decorCache = new Map<string, DecorItem[] | null>();

/** Arrivée devant l'ascenseur du Hub en sortant d'un logement. */
const EXIT_SPAWN = { x: HOME_EXIT.x, y: HOME_EXIT.y, facing: HOME_EXIT.facing };

export interface WorldSceneData {
  /** Injection locale de l'atelier, absente du jeu publié. */
  preview?: LocalArtPreview;
  selfId: string;
  /** Salle à charger : le Hub (par défaut) ou un logement (`home-…`). */
  room?: string;
  /** Logement d'un autre : pseudo du propriétaire, pour l'affichage. */
  ownerName?: string;
  /** Point d'arrivée (sinon le départ de la carte). */
  spawn?: { x: number; y: number; facing: Facing };
  /** Connexion conservée d'une salle à l'autre (la scène est relancée, pas le réseau). */
  carry?: { net: NetworkClient | null; serverTransport: ServerTransport | null };
  /** Objet du Hub à rejoindre dès l'arrivée (panneau « Que faire ? » utilisé depuis un logement). */
  goTo?: string;
}

export interface LocalArtPreview {
  spawn: { x: number; y: number; facing: Facing };
  preload(scene: Phaser.Scene): void;
  prepareWorld(world: WorldModel): void;
  art(scene: Phaser.Scene): TextureArt;
}

interface RemoteAvatar {
  peer: RemotePeer;
  view: AvatarView;
}

/** Nom affiché : la marque ✓ signale un joueur connecté à son compte (garantie par le serveur). */
function displayName(name: string, verified: boolean): string {
  return verified ? `${name} ✓` : name;
}

/** Messages affichés pour les avis du serveur. */
const NOTICE_TEXT: Record<NoticeCode, string> = {
  full: 'Le Hub et sa file d’attente sont pleins pour le moment. Tu peux continuer à explorer en solo : nouvelle tentative dans une minute.',
  maintenance:
    'Le quota gratuit du jour est atteint : le multijoueur revient bientôt. Le jeu reste jouable en solo.',
  duplicate:
    'Tu es connecté dans un autre onglet ou appareil : cet onglet passe en solo. Recharge la page pour jouer ici.',
  kicked: 'Tu as été déconnecté du multijoueur.',
};
const BASE_ZOOM = 1.35;

/**
 * Scène principale : le Hub. Elle relie le modèle du monde (logique pure),
 * le rendu, les entrées, le réseau et l'interface (via les stores).
 */
export class WorldScene extends Phaser.Scene {
  private preview?: LocalArtPreview;
  private world!: WorldModel;
  private renderer3d!: WorldRenderer;
  private tex!: TextureFactory;
  private player!: PlayerController;
  private avatar!: AvatarView;
  private depthIndex!: DepthIndex;
  private net: NetworkClient | null = null;
  private serverTransport: ServerTransport | null = null;
  /** Sons des messages : un à la fois, jamais pour un joueur qui inonde le chat. */
  private readonly soundGate = new SoundGate();
  private awayTimer: ReturnType<typeof setTimeout> | null = null;
  /** Place dans la file d'attente du serveur (salle pleine), ou null. */
  private lastQueuePos: number | null = null;
  private unreadMentions = 0;
  /** Clé de session de cet onglet : permet de reprendre sa place après une coupure. */
  private readonly sessionKey = randomId();
  /** Le joueur est connecté à son compte et le serveur le sait (marque ✓). */
  private selfVerified = false;
  private remotes = new Map<string, RemoteAvatar>();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cleanups: Array<() => void> = [];
  private selfId = '';
  private zoneId: string | null = null;
  private userZoom = BASE_ZOOM;
  private pixelRatio = 1;
  private marker!: Phaser.GameObjects.Ellipse;
  private lastUiSync = 0;
  private lastStats = 0;
  private hovered: string | null = null;
  private greeted = false;

  constructor() {
    super('world');
  }

  /** Salle actuelle, nom du propriétaire (logement) et arrivée demandée. */
  private room = HUB_ROOM;
  private ownerName: string | null = null;
  private arrival: WorldSceneData['spawn'] | null = null;
  private carry: WorldSceneData['carry'] | null = null;
  /** Changement de salle en cours : la scène est relancée sans couper le réseau. */
  private traveling = false;
  /** Abonnements aux événements réseau de cette scène (retirés à chaque changement de salle). */
  private netCleanups: Array<() => void> = [];
  private life: AmbientLife | null = null;
  /** Objet à rejoindre après un changement de salle (panneau « Que faire ? »). */
  private pendingGoTo: string | null = null;
  /** Prochain calcul des Malinos présents par zone (ms). */
  private crowdTimer = 0;
  /** Jour et nuit à l'heure de Paris (lot C). */
  private dayNight: DayNight | null = null;
  /** Le joueur est-il à l'intérieur (nuit plus douce) ? Gardé tel quel hors des zones. */
  private indoor = false;
  /** Joshua vivant (antennes animées, humeur). */
  private joshua: JoshuaLife | null = null;
  /** Rondes de champignons : qui s'y tient immobile danse (vu par tous, sans message réseau). */
  private danceRings: WorldObject[] = [];
  private danceFloors: DanceFloor[] = [];
  private wasDancing = false;
  private danceNoteAt = 0;
  /** Demande d'entrée dans un logement en attente de la réponse du serveur. */
  private pendingDoor: { room: string; ownerName: string | null } | null = null;
  /** Meubles du logement affiché (vides au Hub). */
  private decorItems: DecorItem[] = [];
  /** Éditeur de décoration ouvert (chez soi seulement). */
  private editor: DecorEditor | null = null;
  /** Meuble mis en valeur par l'éditeur. */
  private editorHighlight: string | null = null;
  /** Chargement de la décoration avant d'entrer dans un logement. */
  private loadingDecor = false;

  init(data: WorldSceneData): void {
    // Conserver l'essai lorsque Phaser relance cette scène pour changer de salle.
    this.preview = data.preview ?? this.preview;
    if (data.preview) this.userZoom = 2.4;
    this.selfId = data.selfId;
    // Phaser réutilise la même scène à chaque relance : on repart d'un état propre.
    this.room = data.room ?? HUB_ROOM;
    this.ownerName = data.ownerName ?? null;
    this.arrival = data.spawn ?? null;
    this.carry = data.carry ?? null;
    this.pendingGoTo = data.goTo ?? null;
    this.crowdTimer = 0;
    this.traveling = false;
    this.remotes = new Map();
    this.cleanups = [];
    this.netCleanups = [];
    this.pendingDoor = null;
    this.life = null;
    this.zoneId = null;
    this.hovered = null;
    this.decorItems = [];
    this.editor = null;
    this.editorHighlight = null;
    this.loadingDecor = false;
  }

  preload(): void {
    if (this.preview) this.preview.preload(this);
    else preloadBakedArt(this);
  }

  create(): void {
    const settings = settingsStore.get();
    const profile = profileStore.get();
    if (!profile)
      throw new Error('Profil manquant : la scène démarre après la création du personnage.');
    const rp = renderProfile(settings.quality);
    this.pixelRatio = rp.pixelRatio;

    if (homeOwner(this.room)) {
      // Logement : le studio meublé selon la décoration de son propriétaire.
      const home = loadHomeWorld(decorCache.get(this.room) ?? null);
      this.world = home.world;
      this.decorItems = home.items;
    } else this.world = loadWorld(mapIdForRoom(this.room) ?? 'hub');
    this.preview?.prepareWorld(this.world);
    // Une seule fabrique pour toute la partie : les textures déjà dessinées (Hub, studio,
    // avatars) sont réutilisées d'une salle à l'autre.
    if (!this.tex || this.tex.texScale !== rp.textureScale)
      this.tex = new TextureFactory(
        this,
        rp.textureScale,
        this.preview?.art(this) ?? bakedArt(this),
      );
    this.buildRoom();

    const account = accountStore.get();
    this.selfVerified =
      account.status === 'signed-in' && accountPlayerId(account.user.id) === this.selfId;
    this.savedName = account.status === 'signed-in' ? account.savedName : null;
    const spawn = this.arrival ?? this.world.map.spawn;
    this.player = new PlayerController(this.world, this.selfId, spawn, spawn.facing);
    const owner = homeOwner(this.room);
    roomStore.set({
      room: this.room,
      ownerName: owner === this.selfId ? (profile.name ?? null) : this.ownerName,
      mine: owner !== null && owner === this.selfId,
    });
    this.avatar = new AvatarView(
      this,
      this.tex,
      profile.look,
      displayName(profile.name, this.selfVerified),
      true,
    );
    this.avatar.setRole(this.selfRole());

    this.marker = this.add
      .ellipse(0, 0, 30, 15)
      .setStrokeStyle(2, 0x5fe3d0, 0.9)
      .setDepth(-4.5e6)
      .setVisible(false);
    if (!settings.reducedMotion) {
      this.tweens.add({ targets: this.marker, scale: 0.7, duration: 500, yoyo: true, repeat: -1 });
    }

    this.setupCamera();
    this.setupInput();
    this.applySettings(settings);
    this.cleanups.push(settingsStore.subscribe((s) => this.applySettings(s)));
    this.cleanups.push(profileStore.subscribe((p) => p && this.onProfileChanged(p)));
    this.cleanups.push(accountStore.subscribe(() => this.onAccountChanged()));
    this.cleanups.push(museumWallStore.subscribe((w) => this.applyMuseumWall(w)));
    this.cleanups.push(
      hiddenStore.subscribe(() => {
        for (const [id, r] of this.remotes) r.view.setHidden(isHidden(id));
      }),
    );
    this.cleanups.push(commands.on('chat-send', ({ text, scope }) => this.sendChat(text, scope)));
    this.cleanups.push(commands.on('emote', ({ emoji }) => this.playEmote(emoji)));
    this.cleanups.push(
      commands.on('invite-notify', ({ target }) => this.net?.inviteNotify(target)),
    );
    this.cleanups.push(commands.on('role-changed', ({ target }) => this.net?.roleChanged(target)));
    this.cleanups.push(commands.on('go-to-object', ({ object }) => this.goToObject(object)));
    // Bouton d'action de l'interface (indispensable au doigt, sans touche E).
    this.cleanups.push(commands.on('use', () => !isInputLocked() && this.onUseKey()));
    this.cleanups.push(
      commands.on('travel', ({ room, ownerName }) => void this.goTo(room, ownerName ?? null)),
    );
    this.cleanups.push(
      commands.on('home-access', ({ access, guests }) => this.enforceAccess(access, guests)),
    );
    this.cleanups.push(
      commands.on('decor', ({ action, type }) => this.onDecorCommand(action, type)),
    );

    if (this.carry) this.adoptNetwork(this.carry);
    else void this.startNetwork(settings.multiTab);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    const onVisibility = () => this.onVisibilityChange(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));
    const onUnload = () => this.net?.stop();
    window.addEventListener('pagehide', onUnload);
    this.cleanups.push(() => window.removeEventListener('pagehide', onUnload));

    this.updatePresence();
    this.exposeDebug();
    if (this.pendingGoTo) {
      const id = this.pendingGoTo;
      this.pendingGoTo = null;
      this.time.delayedCall(400, () => this.goToObject(id));
    }
    if (this.carry) {
      this.announceArrival();
      return;
    }
    // Invitations reçues pendant l'absence (joueur connecté à son compte).
    if (accountStore.get().status === 'signed-in') void checkPendingInvitations();
    pushChat({
      from: 'MalinosLand',
      text: isTouchDevice()
        ? 'Bienvenue au Hub ! Touche le sol pour te déplacer, touche un objet pour l’utiliser. Deux doigts pour zoomer.'
        : 'Bienvenue au Hub ! Clique sur le sol pour te déplacer, approche-toi des objets et appuie sur E.',
      kind: 'system',
      scope: 'local',
    });
  }

  /** Affiche la salle (sols, murs, objets) et la vie du décor, à partir de this.world. */
  private buildRoom(): void {
    const settings = settingsStore.get();
    const rp = renderProfile(settings.quality);
    worldInfoStore.set(this.world.map);
    this.renderer3d = new WorldRenderer(this, this.world, this.tex, {
      effects: rp.effects,
      reducedMotion: settings.reducedMotion,
      hiDpi: settings.quality === 'high',
    });
    this.renderer3d.build();
    this.applyMuseumWall(museumWallStore.get());
    this.depthIndex = new DepthIndex(this.world.width, this.renderer3d.depthBoxes);
    // Vie du décor (fontaine, oiseaux, papillons, vapeur) : rien n'est envoyé sur le réseau.
    this.life = settings.reducedMotion
      ? null
      : new AmbientLife(this, this.world, this.renderer3d, {
          effects: rp.effects,
          texScale: rp.textureScale,
          depthAt: (x, y) => this.depthFor(x, y, null, 'py'),
          player: () => this.player.pos,
        });
    this.joshua = new JoshuaLife(this, this.world, this.renderer3d, this.tex, {
      animate: !settings.reducedMotion,
    });
    this.dayNight?.destroy();
    this.dayNight = new DayNight(this, this.world, this.renderer3d, this.life, this.tex, {
      effects: rp.effects,
      reducedMotion: settings.reducedMotion,
      alwaysDay: () => settingsStore.get().alwaysDay,
    });
    this.dayNight.setContext(this.indoor, settings.alwaysDay);
    this.publishSky();
    this.danceRings = this.world.objects.filter((o) => o.type === 'mushroom_ring');
    for (const f of this.danceFloors) f.destroy();
    this.danceFloors = this.danceRings.map(
      (r) => new DanceFloor(this, this.tex, r, !settings.reducedMotion),
    );
  }

  /** Remeuble le logement affiché, sans relancer la scène (éditeur, visiteurs prévenus). */
  private applyDecor(items: DecorItem[] | null): void {
    const home = loadHomeWorld(items);
    this.decorItems = home.items;
    this.life?.destroy();
    this.joshua?.destroy();
    for (const f of this.danceFloors) f.destroy();
    this.danceFloors = [];
    this.renderer3d.destroy();
    this.hovered = null;
    this.editorHighlight = null;
    this.world = home.world;
    this.buildRoom();
    this.player.setWorld(this.world);
  }

  /** Charge la décoration d'un logement avant d'y entrer (4 s au plus, sinon celle connue). */
  private async preloadDecor(room: string): Promise<void> {
    const owner = homeOwner(room);
    if (!owner) return;
    this.loadingDecor = true;
    try {
      const raw = await Promise.race([
        fetchDecor(owner),
        new Promise((_, reject) => setTimeout(() => reject(new Error('délai')), 4000)),
      ]);
      decorCache.set(room, parseDecor(raw, HOME_RULES));
    } catch {
      // On entre quand même : la décoration connue (ou d'origine) s'affiche.
    } finally {
      this.loadingDecor = false;
    }
  }

  /** Le propriétaire du logement où l'on est a changé sa décoration. */
  private async reloadDecor(owner: string): Promise<void> {
    if (homeOwner(this.room) !== owner || this.editor) return;
    const room = this.room;
    await this.preloadDecor(room);
    if (this.room !== room || this.traveling || !this.renderer3d) return;
    this.applyDecor(decorCache.get(room) ?? null);
    pushToast('La décoration a changé ✨', '🛋️', 3000);
  }

  // ---------------------------------------------------------------- Décoration

  private onDecorCommand(action: DecorAction, type?: string): void {
    if (action !== 'start') {
      this.editor?.command(action, type);
      return;
    }
    if (homeOwner(this.room) !== this.selfId) {
      pushToast('Tu peux décorer ton propre logement (ascenseur → « Mon logement »).', '🛋️', 5000);
      return;
    }
    this.openEditor();
  }

  /** Ouvre l'éditeur sur les meubles affichés (l'enregistrement exige un compte, chez soi). */
  private openEditor(): void {
    if (this.editor || !homeOwner(this.room)) return;
    panelStore.set(null);
    this.player.standUp();
    this.player.cancel();
    this.marker.setVisible(false);
    this.editor = new DecorEditor(
      {
        scene: this,
        tex: this.tex,
        touch: isTouchDevice(),
        apply: (items) => this.applyDecor(items),
        people: () => [
          this.player.pos,
          ...[...this.remotes.values()]
            .filter((r) => r.peer.room === this.room)
            .map((r) => ({ x: r.peer.x, y: r.peer.y })),
        ],
        highlight: (index) => {
          if (this.editorHighlight) this.renderer3d.highlight(this.editorHighlight, false);
          this.editorHighlight = index === null ? null : `decor-${index}`;
          if (this.editorHighlight) this.renderer3d.highlight(this.editorHighlight, true);
        },
        save: async (items) => {
          await saveMyDecor(items);
          decorCache.set(this.room, items);
          this.net?.decorChanged();
          pushToast('Décoration enregistrée ✨', '🛋️');
        },
        close: () => {
          this.editor?.destroy();
          this.editor = null;
          this.frameRoom(false);
        },
      },
      this.decorItems,
    );
    this.frameRoom(true);
  }

  /**
   * Éditeur ouvert : la caméra montre toute la pièce au-dessus de la barre de décoration (qui
   * occupe le bas de l'écran). Fermé : elle suit de nouveau le personnage.
   */
  private frameRoom(editing: boolean): void {
    const cam = this.cameras.main;
    if (!editing) {
      this.setCameraBounds();
      this.updateZoom();
      cam.startFollow(this.avatar.sprite, false, 0.12, 0.12, 0, 20);
      return;
    }
    const { width: W, height: H } = this.world;
    const left = project(0, H).x;
    const right = project(W, 0).x;
    const top = project(0, 0, 3).y;
    const bottom = project(W, H).y;
    const cssW = this.scale.width / this.pixelRatio;
    const cssH = this.scale.height / this.pixelRatio;
    const topBar = 64;
    const reserved = Math.max(250, cssH * 0.4);
    const availH = Math.max(120, cssH - reserved - topBar);
    const zoom = Math.min(
      this.userZoom * 1.2,
      availH / (bottom - top),
      (cssW * 0.94) / (right - left),
    );
    cam.stopFollow();
    cam.removeBounds();
    cam.setZoom(zoom * this.pixelRatio);
    // Centre de la pièce affiché au milieu de l'espace libre, entre l'en-tête et la barre.
    const freeMiddle = topBar + availH / 2;
    cam.centerOn((left + right) / 2, (top + bottom) / 2 + (cssH / 2 - freeMiddle) / zoom);
  }

  // ---------------------------------------------------------------- Caméra

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#141a2b');
    this.setCameraBounds();
    this.updateZoom();
    const p = project(this.player.pos.x, this.player.pos.y);
    cam.centerOn(p.x, p.y - 30);
    cam.startFollow(this.avatar.sprite, false, 0.12, 0.12, 0, 20);
    const onResize = () => this.updateZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.cleanups.push(() => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  /** Limites de la caméra : la salle et une marge autour. */
  private setCameraBounds(): void {
    const { width: W, height: H } = this.world;
    const left = project(0, H).x;
    const right = project(W, 0).x;
    const top = project(0, 0, 3).y;
    const bottom = project(W, H).y;
    this.cameras.main.setBounds(left - 260, top - 200, right - left + 520, bottom - top + 400);
  }

  private updateZoom(): void {
    this.cameras.main.setZoom(this.userZoom * this.pixelRatio);
  }

  // ---------------------------------------------------------------- Entrées

  private setupInput(): void {
    const kb = this.input.keyboard!;
    // enableCapture = false : ne bloque jamais la saisie dans le chat.
    const codes = {
      W: 'W',
      Z: 'Z',
      A: 'A',
      Q: 'Q',
      S: 'S',
      D: 'D',
      UP: 'UP',
      DOWN: 'DOWN',
      LEFT: 'LEFT',
      RIGHT: 'RIGHT',
      E: 'E',
      SPACE: 'SPACE',
      ESC: 'ESC',
    };
    this.keys = {};
    for (const [name, code] of Object.entries(codes)) {
      this.keys[name] = kb.addKey(
        Phaser.Input.Keyboard.KeyCodes[code as keyof typeof Phaser.Input.Keyboard.KeyCodes],
        false,
      );
    }

    // Éditeur de décoration : R tourner, C couleur, M déplacer, Suppr ranger, Échap.
    kb.on('keydown', (e: KeyboardEvent) => {
      if (!this.editor || typingStore.get()) return;
      if (this.editor.key(e.code)) e.preventDefault();
    });

    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (!pointer.leftButtonDown() || isInputLocked()) return;
        // Deuxième doigt posé : c'est un zoom, pas un déplacement.
        if (this.input.pointer2?.isDown) {
          this.player.cancel();
          return;
        }
        if (this.editor) {
          const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
          const ids = over
            .map((o) => o.getData('objectId') as string | undefined)
            .filter((v): v is string => !!v);
          this.editor.pointerDown(wp.x, wp.y, ids, pointer.wasTouch);
          return;
        }
        const id = over.map((o) => o.getData('objectId') as string | undefined).find(Boolean);
        const obj = id ? this.world.getObject(id) : undefined;
        if (obj) {
          this.useObject(obj);
          return;
        }
        const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const target = unproject(wp.x, wp.y);
        if (this.player.walkTo(target)) {
          const dest = this.player.destination;
          if (dest) this.showMarker(dest);
        }
      },
    );
    this.input.on(
      Phaser.Input.Events.GAMEOBJECT_OVER,
      (_p: Phaser.Input.Pointer, go: Phaser.GameObjects.GameObject) => {
        const id = go.getData('objectId') as string | undefined;
        if (!id || this.editor) return;
        this.hovered = id;
        this.renderer3d.highlight(id, true);
      },
    );
    this.input.on(
      Phaser.Input.Events.GAMEOBJECT_OUT,
      (_p: Phaser.Input.Pointer, go: Phaser.GameObjects.GameObject) => {
        const id = go.getData('objectId') as string | undefined;
        if (!id || this.editor) return;
        if (this.hovered === id) this.hovered = null;
        this.renderer3d.highlight(id, false);
      },
    );
    // Zoom à deux doigts (pincer / écarter).
    this.input.addPointer(1);
    let pinch: { dist: number; zoom: number } | null = null;
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (this.editor && !this.input.pointer2?.isDown) {
        const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.editor.pointerMove(wp.x, wp.y);
      }
      const a = this.input.pointer1;
      const b = this.input.pointer2;
      if (!a?.isDown || !b?.isDown) {
        pinch = null;
        return;
      }
      const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      if (!pinch) {
        pinch = { dist: Math.max(dist, 1), zoom: this.userZoom };
        return;
      }
      this.userZoom = Phaser.Math.Clamp((pinch.zoom * dist) / pinch.dist, 0.6, 2.4);
      this.updateZoom();
    });
    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        this.userZoom = Phaser.Math.Clamp(this.userZoom * (dy > 0 ? 0.9 : 1.1), 0.6, 2.4);
        this.updateZoom();
      },
    );
  }

  private readInput(): Vec2 {
    if (isInputLocked() || this.editor) return { x: 0, y: 0 };
    const k = this.keys;
    const up = k.W!.isDown || k.Z!.isDown || k.UP!.isDown;
    const down = k.S!.isDown || k.DOWN!.isDown;
    const left = k.A!.isDown || k.Q!.isDown || k.LEFT!.isDown;
    const right = k.D!.isDown || k.RIGHT!.isDown;
    return screenInputToWorld(up, down, left, right);
  }

  private showMarker(p: Vec2): void {
    const s = project(p.x, p.y);
    this.marker.setPosition(s.x, s.y).setVisible(true);
  }

  // ---------------------------------------------------------------- Interactions

  /**
   * Panneau « Que faire ? » : l'avatar rejoint un objet du Hub et s'en sert, comme d'un clic
   * dessus. Depuis un logement, on revient d'abord au Hub (devant l'ascenseur).
   */
  private goToObject(id: string): void {
    if (this.traveling || this.editor) return;
    if (this.room !== HUB_ROOM) {
      this.travel(HUB_ROOM, null, EXIT_SPAWN, id);
      return;
    }
    const obj = this.world.getObject(id);
    if (obj) this.useObject(obj);
  }

  private useObject(obj: WorldObject): void {
    // La ronde de champignons : on va au milieu (on y danse), au lieu de rester à côté.
    if (obj.type === 'mushroom_ring') {
      if (this.player.walkTo({ x: obj.x + obj.w / 2, y: obj.y + obj.d / 2 })) {
        const dest = this.player.destination;
        if (dest) this.showMarker(dest);
      }
      return;
    }
    const res = this.player.requestUse(obj);
    if (res === 'unreachable') {
      pushToast(
        obj.seats.length > 0 ? 'Toutes les places sont prises.' : 'Impossible d’y accéder d’ici.',
        '🚧',
      );
      return;
    }
    if (res === 'walking') {
      const dest = this.player.destination;
      if (dest) this.showMarker(dest);
      return;
    }
    this.performAction(res.kind, obj);
  }

  private performAction(kind: 'use' | 'sit', obj: WorldObject): void {
    this.marker.setVisible(false);
    if (kind === 'sit') {
      if (this.player.sitOn(obj)) this.quest('sit');
      else pushToast('Toutes les places sont prises.', '🪑');
      return;
    }
    if (this.world.distanceToObject(this.player.pos, obj) > USE_RANGE + 0.3) return;
    this.player.faceObject(obj);
    if (obj.interaction) this.runInteraction(obj, obj.interaction);
  }

  private runInteraction(obj: WorldObject, it: InteractionDef): void {
    switch (it.kind) {
      case 'dialog':
        dialogStore.set({
          speaker: it.speaker ?? obj.entry.name,
          lines: obj.id === 'joshua' ? this.joshuaLines(it.lines) : it.lines,
          index: 0,
        });
        break;
      case 'panel':
        panelStore.set(it.panel);
        break;
      case 'stand':
        this.openStand(it.slot);
        break;
      case 'emote':
        this.avatar.say(it.emoji, 'local', 3500);
        pushToast(it.text, it.emoji);
        if ((EMOTES as readonly string[]).includes(it.emoji))
          this.net?.sendEmote(it.emoji as Emote);
        break;
    }
    if (it.quest) this.quest(it.quest);
    if (it.secret) this.secret(it.secret);
  }

  /**
   * Stands du musée : chacun porte l'affiche du projet exposé à sa place (les plus récents
   * d'abord) ; un stand sans projet montre une invitation à exposer le sien.
   */
  private applyMuseumWall(wall: MuseumWall): void {
    if (!this.renderer3d || this.room !== HUB_ROOM) return;
    for (const obj of this.world.objects) {
      const it = obj.interaction;
      if (it?.kind !== 'stand') continue;
      const p = wall.projects[it.slot];
      const url = p ? previewUrl(p) : null;
      const image = url ? this.previewImage(url) : null;
      const poster = p
        ? { id: p.id, title: p.title, author: p.author, category: p.category, image }
        : null;
      this.renderer3d.setObjectTexture(
        obj.id,
        this.tex.stand(obj.type, obj.rot, obj.variant, poster, url ?? ''),
      );
    }
  }

  /** Aperçus du musée déjà chargés (ou en cours) : une seule lecture par image. */
  private previewImages = new Map<string, HTMLImageElement | 'loading' | 'error'>();

  /**
   * Image d'aperçu d'un projet (servie par le serveur temps réel, autorisée par la CSP). Pas
   * encore chargée : null, et les stands sont redessinés à son arrivée.
   */
  private previewImage(url: string): HTMLImageElement | null {
    const known = this.previewImages.get(url);
    if (known instanceof HTMLImageElement) return known;
    if (known) return null;
    this.previewImages.set(url, 'loading');
    const img = new Image();
    // Image d'une autre origine dessinée dans un canevas : lecture autorisée par le serveur.
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      this.previewImages.set(url, img);
      this.applyMuseumWall(museumWallStore.get());
    };
    img.onerror = () => this.previewImages.set(url, 'error');
    img.src = url;
    return null;
  }

  /** Clic sur un stand : la fiche du projet, ou le formulaire si la place est libre. */
  private openStand(slot: number): void {
    const project: MuseumProject | undefined = museumWallStore.get().projects[slot];
    if (project) {
      projectFocusStore.set(project);
      panelStore.set('project');
    } else {
      pushToast('Cette place attend une création : pourquoi pas la tienne ?', '🖼️', 4000);
      panelStore.set('museum');
    }
  }

  /**
   * Répliques de Joshua : une phrase selon son humeur, puis la visite guidée la première fois,
   * ensuite un mot sur le carnet de secrets. Ses antennes s'agitent pendant qu'il parle.
   */
  private joshuaLines(tour: string[]): string[] {
    this.joshua?.talk(6);
    const mood = this.joshua?.mood;
    const first = mood ? [moodLine(mood, Math.floor(Math.random() * 10))] : [];
    if (!progressStore.get().includes('talk_guide')) return [...first, ...tour];
    return [...first, ...followUpLines(secretsStore.get().length, SECRETS.length)];
  }

  private secret(id: string): void {
    if (!findSecret(id)) return;
    const s = SECRETS.find((x) => x.id === id);
    const n = secretsStore.get().length;
    this.time.delayedCall(900, () => {
      pushToast(
        n === SECRETS.length
          ? `Dernier secret : ${s?.title} ! Joshua a laissé une dernière page dans son carnet… 📓`
          : `Secret trouvé : ${s?.title} (${n}/${SECRETS.length}) · nouvelle page dans le carnet de Joshua`,
        '🔎',
        6000,
      );
      pushChat({
        from: 'Joshua',
        text: `📓 Nouvelle page dans mon carnet : « ${s?.title} ». Bouton 🎯 → Carnet de Joshua.`,
        kind: 'system',
        scope: 'local',
      });
    });
  }

  private quest(id: string): void {
    if (!completeQuest(id)) return;
    const q = QUESTS.find((x) => x.id === id);
    if (q) pushToast(`Objectif accompli : ${q.title}`, '✅');
    if (progressStore.get().length === QUESTS.length) {
      this.time.delayedCall(1200, () =>
        pushToast('Bravo ! Tu as terminé les Premiers pas. Tu es un vrai Malino !', '🎉', 6000),
      );
    }
  }

  private updateHint(): void {
    if (this.player.seat) {
      hintStore.set('Se lever');
      return;
    }
    const obj = this.world.nearestUsable(this.player.pos, USE_RANGE);
    if (!obj) hintStore.set(null);
    else hintStore.set(obj.seats.length > 0 ? 'S’asseoir' : (obj.interaction?.label ?? null));
  }

  private onUseKey(): void {
    if (this.player.seat) {
      this.player.standUp();
      return;
    }
    const obj = this.world.nearestUsable(this.player.pos, USE_RANGE);
    if (obj) this.useObject(obj);
  }

  // ---------------------------------------------------------------- Chat & emotes

  private sendChat(raw: string, wanted: 'local' | 'global'): void {
    // Dans un logement, tout reste entre ses murs (le serveur l'impose aussi).
    const scope = homeOwner(this.room) ? 'local' : wanted;
    const text = sanitizeText(raw, CHAT_MAX_LENGTH);
    if (!text) return;
    const profile = profileStore.get();
    if (this.net?.isQueued) {
      pushChat({
        from: 'MalinosLand',
        text: 'Tu es dans la file d’attente : le chat s’ouvre dès que tu entres.',
        kind: 'system',
        scope,
      });
      return;
    }
    if (this.net && !this.net.sendChat(text, scope)) {
      const wait = Math.ceil(this.net.chatCooldown());
      pushChat({
        from: 'MalinosLand',
        text: `Doucement ! Réessaie dans ${wait} s (anti-spam).`,
        kind: 'system',
        scope,
      });
      return;
    }
    // Une bulle au-dessus de soi, pour « Autour » comme pour « Tout le monde ».
    this.avatar.say(text, scope);
    const role = this.selfRole();
    pushChat({
      from: nameWithBadge(profile?.name ?? 'Moi', role),
      text,
      kind: 'self',
      scope,
      ...(role ? { role } : {}),
    });
    this.quest('chat');
  }

  private playEmote(emoji: Emote): void {
    this.avatar.say(emoji, 'local', 3000);
    this.net?.sendEmote(emoji);
  }

  // ---------------------------------------------------------------- Salles et logements

  /** Le joueur demande à aller dans une salle (ascenseur). */
  private async goTo(room: string, ownerName: string | null): Promise<void> {
    if (this.traveling || this.pendingDoor) return;
    if (room === this.room) {
      pushToast('Tu y es déjà !', '🛗');
      return;
    }
    if (room === HUB_ROOM) {
      this.travel(HUB_ROOM, null, EXIT_SPAWN);
      return;
    }
    const owner = homeOwner(room);
    if (!owner) return;
    const net = this.net;
    if (!net || net.transportKind !== 'server') {
      pushToast('Les logements se visitent dans la version en ligne du jeu.', '🏠', 5000);
      return;
    }
    if (owner === this.selfId) {
      if (this.loadingDecor) return;
      // Le logement est créé en base à la première visite (pour pouvoir l'ouvrir ensuite).
      void myHomeAccess().catch(() => {});
      await this.preloadDecor(room);
      this.travel(room, null);
      return;
    }
    const account = accountStore.get();
    if (account.status === 'signed-in' && accountPlayerId(account.user.id) === owner) {
      pushToast('Recharge la page pour entrer avec ton compte ✓.', '🔑', 6000);
      return;
    }
    this.pendingDoor = { room, ownerName };
    net.requestEnter(room, await accessToken());
    this.time.delayedCall(8000, () => {
      if (this.pendingDoor?.room !== room) return;
      this.pendingDoor = null;
      pushToast('Pas de réponse du serveur : réessaie dans un instant.', '🛗', 5000);
    });
  }

  /** Relance la scène dans une autre salle, en gardant la connexion. */
  private travel(
    room: string,
    ownerName: string | null,
    spawn?: WorldSceneData['spawn'],
    goTo?: string,
  ): void {
    if (this.traveling) return;
    this.traveling = true;
    panelStore.set(null);
    dialogStore.set(null);
    const data: WorldSceneData = {
      selfId: this.selfId,
      room,
      ...(ownerName ? { ownerName } : {}),
      ...(spawn ? { spawn } : {}),
      ...(goTo ? { goTo } : {}),
      carry: { net: this.net, serverTransport: this.serverTransport },
    };
    this.scene.restart(data);
  }

  /** Réponse du serveur : entrée permise ou refusée, ou sortie forcée d'un logement. */
  private onDoor(room: string, ok: boolean, why?: string): void {
    if (homeOwner(room)) {
      const pending = this.pendingDoor;
      this.pendingDoor = null;
      if (ok && pending?.room === room)
        void this.preloadDecor(room).then(() => this.travel(room, pending.ownerName));
      else if (!ok)
        pushToast(
          why === 'full'
            ? 'Ce logement est plein pour le moment (12 personnes) : réessaie plus tard.'
            : 'Ce logement est fermé, ou tu n’y es pas invité.',
          '🚪',
          5000,
        );
      return;
    }
    // Mis à la porte, ou plus le droit d'entrer après une coupure : retour devant l'ascenseur.
    const owner = homeOwner(this.room);
    if (!owner || owner === this.selfId) return;
    pushToast(
      why === 'evicted'
        ? 'Le propriétaire t’a raccompagné jusqu’à l’ascenseur du Hub.'
        : 'Ce logement n’est plus accessible : retour au Hub.',
      '🛗',
      6000,
    );
    this.travel(HUB_ROOM, null, EXIT_SPAWN);
  }

  /** Chez moi : fait sortir les personnes présentes qui n'ont plus le droit d'être là. */
  private enforceAccess(access: HomeAccess, guests: string[]): void {
    if (homeOwner(this.room) !== this.selfId || !this.net) return;
    for (const { peer } of this.remotes.values()) {
      if (peer.room !== this.room) continue;
      const allowed = access === 'public' || (access === 'invite' && guests.includes(peer.id));
      if (!allowed) this.net.evict(peer.id);
    }
  }

  /** Ce joueur lirait-il un message « autour de moi » ? (même salle, moins de 8 cases) */
  private withinEarshot(peer: RemotePeer): boolean {
    if (peer.room !== this.room) return false;
    if (homeOwner(this.room)) return true;
    const p = this.player.pos;
    return Math.hypot(peer.x - p.x, peer.y - p.y) <= LOCAL_CHAT_RADIUS;
  }

  /** Nom affiché du lieu dans un logement. */
  private homeLabel(): string {
    return homeOwner(this.room) === this.selfId
      ? 'Mon studio'
      : `Chez ${this.ownerName ?? 'un Malino'}`;
  }

  private announceArrival(): void {
    const owner = homeOwner(this.room);
    const text = !owner
      ? 'Retour au Hub !'
      : owner === this.selfId
        ? 'Bienvenue chez toi ! Le bouton 🛋️ en haut sert à décorer, la table basse règle qui peut entrer. Ce qui s’écrit ici reste entre ces murs.'
        : `Tu es chez ${this.ownerName ?? 'un Malino'}. Ce qui s’écrit ici n’est lu que par les personnes présentes.`;
    pushChat({ from: 'MalinosLand', text, kind: 'system', scope: 'local' });
  }

  // ---------------------------------------------------------------- Réseau

  private async startNetwork(multiTab: boolean): Promise<void> {
    this.net?.stop();
    for (const r of this.remotes.values()) r.view.destroy();
    this.remotes.clear();
    const profile = profileStore.get()!;
    // Serveur configuré (VITE_REALTIME_URL) : multijoueur en ligne. Sinon, démo locale ou solo.
    this.serverTransport = REALTIME_URL
      ? new ServerTransport(REALTIME_URL, undefined, accessToken)
      : null;
    const transport: Transport = this.serverTransport
      ? this.serverTransport
      : !this.preview && multiTab && BroadcastChannelTransport.isSupported()
        ? new BroadcastChannelTransport()
        : new OfflineTransport();
    const net = new NetworkClient(
      transport,
      this.selfId,
      { name: profile.name, look: profile.look, state: this.localState() },
      transport.kind === 'server'
        ? {
            // En ligne : 5 positions par seconde au plus (quota gratuit), l'interpolation lisse
            // le reste. Les départs sont annoncés par le serveur : un joueur dont l'onglet est en
            // arrière-plan (jeu en pause, donc silencieux) reste visible.
            stateIntervalMs: 200,
            peerTimeoutMs: Infinity,
            sessionKey: this.sessionKey,
          }
        : { stateIntervalMs: 100 },
    );
    this.net = net;
    this.attachNetwork(net);
    try {
      await net.start();
    } catch (err) {
      console.warn('[réseau] démarrage impossible, passage en solo', err);
    }
    this.updatePresence();
  }

  /** Reprend la connexion de la salle précédente (changement de salle). */
  private adoptNetwork(carry: NonNullable<WorldSceneData['carry']>): void {
    this.net = carry.net;
    this.serverTransport = carry.serverTransport;
    if (!this.net) return;
    this.attachNetwork(this.net);
    for (const peer of this.net.peers.values()) this.addRemote(peer);
  }

  /** Branche cette scène sur les événements réseau (abonnements retirés à la sortie). */
  private attachNetwork(net: NetworkClient): void {
    for (const off of this.netCleanups) off();
    this.netCleanups = [];
    const on: NetworkClient['events']['on'] = (type, handler) => {
      const off = net.events.on(type, handler);
      this.netCleanups.push(off);
      return off;
    };
    on('join', (peer) => {
      this.addRemote(peer);
      if (isHidden(peer.id)) return;
      pushChat({
        from: 'MalinosLand',
        text: `${displayName(peer.name, peer.verified)} a rejoint le Hub.`,
        kind: 'system',
        scope: 'global',
      });
    });
    on('update', (peer) => {
      if (!this.remotes.has(peer.id)) this.addRemote(peer);
    });
    on('look', (peer) => {
      const view = this.remotes.get(peer.id)?.view;
      view?.setLook(peer.look, displayName(peer.name, peer.verified));
      view?.setRole(peer.role);
      this.updatePresence();
    });
    on('selfRole', ({ role }) => setOwnRole(role));
    on('leave', ({ id }) => {
      const r = this.remotes.get(id);
      if (!r) return;
      if (!isHidden(id))
        pushChat({
          from: 'MalinosLand',
          text: `${r.peer.name} a quitté le Hub.`,
          kind: 'system',
          scope: 'global',
        });
      r.view.destroy();
      this.remotes.delete(id);
      this.updatePresence();
    });
    // Joueur masqué : ni bulle, ni message, ni émote.
    on('chat', ({ peer, text, scope }) => {
      if (isHidden(peer.id)) return;
      // « Autour de moi » : trop loin, on ne l'entend pas (le serveur filtre déjà en ligne ; ici
      // pour la démo entre onglets).
      if (scope === 'local' && !this.withinEarshot(peer)) return;
      // Bulle au-dessus de celui qui parle, s'il est dans la même salle (« Tout le monde » aussi).
      this.remotes.get(peer.id)?.view.say(text, scope);
      const mention = mentions(text, profileStore.get()?.name ?? '');
      pushChat({
        from: nameWithBadge(displayName(peer.name, peer.verified), peer.role),
        text,
        kind: 'peer',
        scope,
        peerId: peer.id,
        ...(mention ? { mention: true } : {}),
        ...(peer.role ? { role: peer.role } : {}),
      });
      const sound = this.soundGate.decide(peer.id, mention);
      if (sound) playSound(sound);
      if (mention && document.hidden) {
        this.unreadMentions++;
        document.title = `(${this.unreadMentions}) MalinosLand`;
      }
    });
    on('away', (peer) => {
      this.remotes.get(peer.id)?.view.setAway(peer.away);
      this.updatePresence();
    });
    on('emote', ({ peer, emote }) => {
      if (!isHidden(peer.id)) this.remotes.get(peer.id)?.view.say(emote, 'local', 3000);
    });
    on('queue', ({ pos }) => {
      if (pos === 0) {
        pushToast('C’est ton tour : bienvenue dans le Hub !', '🎉', 5000);
        pushChat({
          from: 'MalinosLand',
          text: 'Une place s’est libérée : tu es entré, les autres te voient.',
          kind: 'system',
          scope: 'global',
        });
      } else {
        const text = `Le Hub est plein : tu es ${pos === 1 ? '1er' : `${pos}e`} dans la file d’attente. Tu entres tout seul dès qu’une place se libère ; en attendant, explore en solo.`;
        pushToast(text, '⏳', 7000);
        if (this.lastQueuePos === null)
          pushChat({ from: 'MalinosLand', text, kind: 'system', scope: 'global' });
      }
      this.lastQueuePos = pos === 0 ? null : pos;
    });
    on('notice', ({ code }) => {
      const text = NOTICE_TEXT[code];
      pushToast(text, '🌐', 7000);
      pushChat({ from: 'MalinosLand', text, kind: 'system', scope: 'global' });
    });
    on('door', ({ room, ok, why }) => this.onDoor(room, ok, why));
    on('decor', ({ owner }) => void this.reloadDecor(owner));
    on('invite', ({ peer }) => {
      if (isHidden(peer.id)) return;
      pushInvitation({ room: homeRoom(peer.id), ownerName: peer.name });
      pushChat({
        from: 'MalinosLand',
        text: `✉️ ${peer.name} t’invite dans son logement !`,
        kind: 'system',
        scope: 'local',
      });
      playSound('mention');
    });
  }

  private addRemote(peer: RemotePeer): void {
    if (this.remotes.has(peer.id)) return;
    const view = new AvatarView(
      this,
      this.tex,
      peer.look,
      displayName(peer.name, peer.verified),
      false,
    );
    view.x = peer.x;
    view.y = peer.y;
    view.setNameVisible(settingsStore.get().showNames);
    view.setHidden(isHidden(peer.id));
    view.setAway(peer.away);
    view.setRole(peer.role);
    this.remotes.set(peer.id, { peer, view });
    this.updatePresence();
  }

  private localState() {
    const s: AnimState = this.player?.seat ? 2 : this.avatar?.moving ? 1 : 0;
    return {
      room: this.room,
      x: this.player?.pos.x ?? 0,
      y: this.player?.pos.y ?? 0,
      f: this.player?.facing ?? 'py',
      s,
    };
  }

  private updatePresence(): void {
    const profile = profileStore.get();
    const list = [
      ...(profile
        ? [
            {
              id: this.selfId,
              name: profile.name,
              look: profile.look,
              self: true,
              room: this.room,
              verified: this.selfVerified,
              away: false,
              role: this.selfRole(),
            },
          ]
        : []),
      ...[...this.remotes.values()].map(({ peer }) => ({
        id: peer.id,
        name: peer.name,
        look: peer.look,
        self: false,
        room: peer.room,
        verified: peer.verified,
        away: peer.away,
        role: peer.role,
      })),
    ];
    presenceStore.set(list);
  }

  // ---------------------------------------------------------------- Réglages & profil

  /** Autres Malinos présents dans le Hub, par zone (panneau « Que faire ? »), si ça a changé. */
  private publishCrowd(): void {
    const crowd: Record<string, number> = {};
    if (this.room === HUB_ROOM) {
      for (const { peer } of this.remotes.values()) {
        if (peer.room !== HUB_ROOM || isHidden(peer.id)) continue;
        const zone = this.world.zoneAt({ x: peer.x, y: peer.y })?.id;
        if (zone) crowd[zone] = (crowd[zone] ?? 0) + 1;
      }
    }
    if (JSON.stringify(crowd) !== JSON.stringify(crowdStore.get())) crowdStore.set(crowd);
  }

  /** Petite horloge de l'interface : mise à jour seulement quand la minute change. */
  private publishSky(): void {
    const sky = this.dayNight?.sky;
    if (!sky) return;
    const h = Math.floor(sky.hours);
    const m = Math.floor((sky.hours - h) * 60);
    const time = `${h}:${String(m).padStart(2, '0')}`;
    const prev = skyStore.get();
    if (prev?.time !== time || prev.phase !== sky.phase) skyStore.set({ phase: sky.phase, time });
  }

  private applySettings(s: Settings): void {
    this.game.loop.setFPSLimit(s.fpsLimit);
    this.dayNight?.setContext(this.indoor, s.alwaysDay);
    this.avatar.setNameVisible(s.showNames);
    this.renderer3d.setLabelsVisible(s.showNames);
    for (const r of this.remotes.values()) r.view.setNameVisible(s.showNames);
    if (REALTIME_URL) return; // en ligne : la démo multi-onglets ne s'applique pas
    const wantsTabs = s.multiTab && BroadcastChannelTransport.isSupported();
    const hasTabs = this.net?.transportKind === 'local-tabs';
    if (this.net && wantsTabs !== hasTabs) void this.startNetwork(s.multiTab);
  }

  private onProfileChanged(p: Profile): void {
    this.avatar.setLook(p.look, displayName(p.name, this.selfVerified));
    this.net?.updateLook(p.name, p.look);
    this.updatePresence();
  }

  private savedName: string | null = null;

  /** Pseudo du compte enregistré ou modifié en base : le serveur doit le relire. */
  /** Mon rôle visible : celui de mon compte, si je joue avec lui. */
  private selfRole(): Role | null {
    const s = accountStore.get();
    return this.selfVerified && s.status === 'signed-in' ? s.role : null;
  }

  private onAccountChanged(): void {
    const s = accountStore.get();
    this.avatar?.setRole(this.selfRole());
    this.updatePresence();
    const saved = s.status === 'signed-in' ? s.savedName : null;
    if (saved === this.savedName) return;
    const first = this.savedName === null;
    this.savedName = saved;
    if (!saved) return;
    if (this.selfVerified) this.serverTransport?.reconnect();
    else if (first && REALTIME_URL)
      pushToast(
        'Profil enregistré. Recharge la page pour apparaître avec ton compte ✓.',
        '🔑',
        8000,
      );
  }

  // ---------------------------------------------------------------- Boucle

  update(time: number, delta: number): void {
    // Pas plafonné à 250 ms : vitesse constante même à faible FPS (collisions en sous-pas).
    const dt = Math.min(delta, 250) / 1000;
    if (
      !isInputLocked() &&
      !this.editor &&
      (Phaser.Input.Keyboard.JustDown(this.keys.E!) ||
        Phaser.Input.Keyboard.JustDown(this.keys.SPACE!))
    ) {
      this.onUseKey();
    }

    const step = this.player.update(dt, this.readInput());
    this.life?.update(delta);
    this.dayNight?.update(delta);
    this.publishSky();
    this.crowdTimer -= delta;
    if (this.crowdTimer <= 0) {
      this.crowdTimer = 1000;
      this.publishCrowd();
    }
    this.joshua?.update(delta, this.player.pos);
    if (step.arrived) {
      const obj = this.world.getObject(step.arrived.objectId);
      if (obj) this.performAction(step.arrived.kind, obj);
    }
    if (!this.player.isWalkingPath) this.marker.setVisible(false);

    const av = this.avatar;
    av.x = this.player.pos.x;
    av.y = this.player.pos.y;
    av.facing = this.player.facing;
    av.moving = step.moved;
    av.seatHeight = this.player.seat?.height ?? null;
    av.dancing = !step.moved && !this.player.seat && this.inDanceRing(av.x, av.y);
    if (av.dancing && !this.wasDancing) this.startDancing(time);
    if (av.dancing && time > this.danceNoteAt) {
      this.danceNoteAt = time + 5000;
      av.say('🎶', 'local', 1800);
    }
    this.wasDancing = av.dancing;
    this.updateDanceFloors(delta, av.dancing);
    av.update(
      delta,
      this.depthFor(av.x, av.y, this.player.seat ? this.player.seat.objectId : null, av.facing),
    );

    this.updateRemotes(delta);
    this.updateHint();
    this.updateZone();
    this.net?.updateLocal(this.localState());

    if (time - this.lastUiSync > 100) {
      this.lastUiSync = time;
      playerPosStore.set({ x: av.x, y: av.y });
      peersPosStore.set(
        [...this.remotes.values()]
          .filter((r) => r.peer.room === this.room)
          .map((r) => ({ x: r.view.x, y: r.view.y })),
      );
    }
    if (time - this.lastStats > 500) {
      this.lastStats = time;
      this.updateSpotSound();
      let nearby = 0;
      for (const { peer } of this.remotes.values())
        if (!isHidden(peer.id) && this.withinEarshot(peer)) nearby++;
      if (nearbyStore.get() !== nearby) nearbyStore.set(nearby);
      statsStore.set({
        fps: Math.round(this.game.loop.actualFps),
        peers: this.remotes.size,
        kbSent: Math.round(((this.net?.bytesSent ?? 0) / 1024) * 10) / 10,
        transport: this.net?.transportLabel ?? 'Hors ligne (solo)',
      });
    }
  }

  /** Profondeur d'affichage d'un avatar (assis : juste devant ou derrière le siège). */
  private depthFor(
    x: number,
    y: number,
    seatObjectId: string | null,
    facing: AvatarView['facing'],
  ): number {
    if (seatObjectId) {
      const r = this.renderer3d.objects.get(seatObjectId);
      // Face à la caméra : devant tout le siège. De dos : devant l'assise, derrière le dossier.
      if (r) return r.depth + (facesCamera(facing) ? 1 : r.front ? BACKREST_DEPTH / 2 : -1);
    }
    return avatarDepth({ x, y }, this.depthIndex.near({ x, y }));
  }

  private updateRemotes(delta: number): void {
    const k = 1 - Math.exp(-delta / 80);
    for (const { peer, view } of this.remotes.values()) {
      const visible = peer.room === this.room;
      view.sprite.setVisible(visible);
      if (!visible) continue;
      const dx = peer.x - view.x;
      const dy = peer.y - view.y;
      if (Math.hypot(dx, dy) > 3) {
        view.x = peer.x;
        view.y = peer.y;
      } else {
        view.x += dx * k;
        view.y += dy * k;
      }
      view.facing = peer.f;
      view.moving = peer.s === 1 || Math.hypot(dx, dy) > 0.05;
      let seatId: string | null = null;
      if (peer.s === 2) {
        const seatObj = this.world.objects.find(
          (o) =>
            o.seats.length > 0 &&
            peer.x >= o.x &&
            peer.x < o.x + o.w &&
            peer.y >= o.y &&
            peer.y < o.y + o.d,
        );
        seatId = seatObj?.id ?? null;
        view.seatHeight = seatObj?.seats[0]?.height ?? 0.42;
        view.moving = false;
      } else view.seatHeight = null;
      view.dancing = peer.s !== 2 && !view.moving && this.inDanceRing(view.x, view.y);
      view.update(delta, this.depthFor(view.x, view.y, seatId, view.facing));
    }
  }

  /**
   * Lumières et musique de la ronde : allumées dès que quelqu'un y danse ; la musique s'entend en
   * s'approchant, et à fond quand on danse soi-même.
   */
  private updateDanceFloors(delta: number, selfDancing: boolean): void {
    let music = 0;
    for (const floor of this.danceFloors) {
      const ring = floor.ringObject;
      const cx = ring.x + ring.w / 2;
      const cy = ring.y + ring.d / 2;
      const inside = (x: number, y: number) =>
        Math.hypot(x - cx, y - cy) < Math.min(ring.w, ring.d) * 0.42;
      const active =
        (selfDancing && inside(this.player.pos.x, this.player.pos.y)) ||
        [...this.remotes.values()].some((r) => r.view.dancing && inside(r.view.x, r.view.y));
      floor.update(delta, active);
      if (!active) continue;
      const dist = Math.hypot(this.player.pos.x - cx, this.player.pos.y - cy);
      music = Math.max(music, selfDancing ? 1 : Math.max(0, 1 - dist / 9) * 0.7);
    }
    setDiscoLevel(music);
  }

  /** Le point est-il dans une ronde de champignons (cercle inscrit dans son empreinte) ? */
  private inDanceRing(x: number, y: number): boolean {
    return this.danceRings.some(
      (o) => Math.hypot(x - (o.x + o.w / 2), y - (o.y + o.d / 2)) < Math.min(o.w, o.d) * 0.42,
    );
  }

  /** Entrée dans la ronde : on danse ; la première fois, c'est aussi un secret. */
  private startDancing(time: number): void {
    this.danceNoteAt = time + 5000;
    const others = [...this.remotes.values()].filter(
      (r) => r.peer.room === this.room && this.inDanceRing(r.view.x, r.view.y),
    ).length;
    pushToast(
      others > 0
        ? `🕺 Tu rejoins la ronde : vous êtes ${others + 1} à danser !`
        : '🕺 Tu danses dans la ronde des Malinos ! Invite d’autres Malinos à te rejoindre.',
      '🍄',
      4000,
    );
    this.secret('champignons');
  }

  /** Son de la source la plus proche (feu de camp, fontaine), plus fort en s'approchant. */
  private updateSpotSound(): void {
    const SOURCES: Record<string, SpotSound> = { campfire: 'fire', fountain: 'water' };
    const RADIUS = 6;
    let best: { kind: SpotSound; dist: number } | null = null;
    for (const o of this.world.objects) {
      const kind = SOURCES[o.type];
      if (!kind) continue;
      const dist = Math.hypot(o.x + o.w / 2 - this.player.pos.x, o.y + o.d / 2 - this.player.pos.y);
      if (dist < RADIUS && (!best || dist < best.dist)) best = { kind, dist };
    }
    setSpotSound(best?.kind ?? null, best ? (1 - best.dist / RADIUS) ** 1.5 : 0);
  }

  private updateZone(): void {
    const zone = this.world.zoneAt(this.player.pos);
    const id = zone?.id ?? null;
    if (id === this.zoneId) return;
    this.zoneId = id;
    zoneStore.set(zone && homeOwner(this.room) ? { ...zone, name: this.homeLabel() } : zone);
    // Musée : la liste des stands est lue en approchant (hall ou musée), puis gardée 5 minutes.
    if (this.room === HUB_ROOM && (id === 'hall' || id === 'gallery')) void loadMuseumWall();
    setAmbience(ambienceForZone(id));
    if (id) {
      this.indoor = ambienceForZone(id) !== 'outdoor';
      this.dayNight?.setContext(this.indoor, settingsStore.get().alwaysDay);
    }
    if (id === 'terrace') this.quest('terrace');
    if (id === 'hall' && !this.greeted) {
      this.greeted = true;
      this.renderer3d.objectBubble('joshua', 'Bip bip ! Bienvenue !', 4500);
    }
  }

  /**
   * Accès de débogage pour les tests automatisés (dev ou URL avec ?debug).
   * Il ne donne aucun pouvoir supplémentaire : tout reste local au navigateur.
   */
  private exposeDebug(): void {
    if (!import.meta.env.DEV && !new URLSearchParams(location.search).has('debug')) return;
    (window as unknown as Record<string, unknown>).__malinosDebug = {
      pos: () => ({ ...this.player.pos }),
      /** Diagnostic des modèles réellement affichés, y compris les joueurs distants. */
      art: () => ({
        avatar: this.avatar.sprite.texture.key,
        frame: this.avatar.sprite.frame.name,
        peers: [...this.remotes.values()].map(({ view }) => view.sprite.texture.key),
        trees: [...this.renderer3d.objects.values()]
          .filter(({ obj }) => obj.type === 'tree')
          .map(({ obj, image }) => ({
            x: obj.x,
            y: obj.y,
            variant: obj.variant,
            frame: image.frame.name,
          })),
      }),
      seated: () => this.player.seat !== null,
      /** Salle actuelle, et changement de salle direct (sans demande au serveur). */
      room: () => this.room,
      travel: (room: string) => {
        if (!mapIdForRoom(room)) return false;
        this.travel(room, 'Test', room === HUB_ROOM ? EXIT_SPAWN : undefined);
        return true;
      },
      /** Meubles du logement affiché, et clic de l'éditeur de décoration sur une case. */
      decor: () => this.decorItems.map((i) => ({ ...i })),
      /** Ouvre l'éditeur dans n'importe quel logement (test local : rien n'est enregistré). */
      decorStart: () => this.openEditor(),
      decorTap: (x: number, y: number) => {
        if (!this.editor) return false;
        const p = project(x + 0.5, y + 0.5);
        this.editor.pointerMove(p.x, p.y);
        this.editor.pointerDown(p.x, p.y, [], false);
        return true;
      },
      /** État de l'interface et du joueur, pour diagnostiquer un test qui échoue. */
      state: () => ({
        pos: { ...this.player.pos },
        seated: this.player.seat !== null,
        walking: this.player.isWalkingPath,
        panel: panelStore.get(),
        dialog: dialogStore.get()?.speaker ?? null,
        zone: this.zoneId,
        fps: Math.round(this.game.loop.actualFps),
        transport: this.net?.transportKind ?? 'offline',
        peersPos: [...this.remotes.values()].map((r) => ({
          x: r.peer.x,
          y: r.peer.y,
          away: r.peer.away,
        })),
      }),
      walkTo: (x: number, y: number) => this.player.walkTo({ x, y }),
      teleport: (x: number, y: number, facing?: Facing) => {
        if (!this.world.grid.isWalkable(Math.floor(x), Math.floor(y))) return false;
        this.player.standUp();
        this.player.cancel();
        this.player.pos = { x, y };
        if (facing) this.player.facing = facing;
        const p = project(x, y);
        this.cameras.main.centerOn(p.x, p.y - 30);
        return true;
      },
      use: (id: string) => {
        const obj = this.world.getObject(id);
        if (obj) this.useObject(obj);
        return !!obj;
      },
      /**
       * Point de la page (pixels CSS) au milieu de l'image d'un objet, pour y cliquer vraiment
       * avec la souris dans les tests (null : objet absent ou hors de l'écran).
       */
      screenOf: (id: string) => {
        const img = this.renderer3d.objects.get(id)?.image;
        if (!img) return null;
        const cam = this.cameras.main;
        const b = img.getBounds();
        const rect = this.game.canvas.getBoundingClientRect();
        const k = rect.width / this.scale.width;
        const x = rect.left + (b.centerX - cam.worldView.x) * cam.zoom * k;
        const y = rect.top + (b.centerY - cam.worldView.y) * cam.zoom * k;
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
          ? { x, y }
          : null;
      },
      /** Remplit les stands du musée avec des projets d'exemple, sans réseau (captures, tests). */
      museumSample: (n = MUSEUM_SAMPLES.length) => {
        museumWallStore.set({
          status: 'ready',
          projects: MUSEUM_SAMPLES.slice(0, n).map((p, i) => ({
            ...p,
            id: 900 + i,
            preview: null,
          })),
          at: Date.now(),
        });
        return museumWallStore.get().projects.length;
      },
      useType: (type: string) => {
        const obj = this.world.objects.find((o) => o.type === type);
        if (obj) this.useObject(obj);
        return !!obj;
      },
      /** S'assoit aussitôt sur le n-ième objet d'un type (captures et tests d'affichage). */
      sit: (type: string, n = 0) => {
        const obj = this.world.objects.filter((o) => o.type === type)[n];
        if (!obj) return false;
        this.player.standUp();
        this.player.cancel();
        if (!this.player.sitOn(obj)) return false;
        const p = project(this.player.pos.x, this.player.pos.y);
        this.cameras.main.centerOn(p.x, p.y - 30);
        return this.player.facing;
      },
      /** Change le zoom (sans argument : le lit seulement). */
      zoom: (z?: number) => {
        if (z !== undefined) {
          this.userZoom = Phaser.Math.Clamp(z, 0.4, 2.4);
          this.updateZoom();
        }
        return this.userZoom;
      },
      peers: () => this.remotes.size,
      /** Impose une heure de Paris (0–24) pour voir la nuit ; sans argument : heure réelle. */
      time: (h?: number) => {
        this.dayNight?.forceHour(typeof h === 'number' ? h : null);
        return this.dayNight?.sky;
      },
      /** Ouvre un panneau de l'interface (tests, captures) : `panel('quiz')`. */
      panel: (id: Parameters<typeof panelStore.set>[0]) => panelStore.set(id),
      /** Aperçu local d'un rôle sur son propre avatar (captures) : rien n'est envoyé. */
      role: (r: Role | null) => this.avatar.setRole(r),
      fps: () => Math.round(this.game.loop.actualFps),
      objects: () => this.children.length,
      hideAll: (filter?: string) => {
        for (const c of this.children.list) {
          const v = c as unknown as {
            setVisible?: (v: boolean) => void;
            texture?: { key: string };
            frame?: { name: string };
          };
          const name = `${v.texture?.key ?? ''}|${v.frame?.name ?? ''}`;
          if (!filter || name.includes(filter)) v.setVisible?.(false);
        }
      },
    };
  }

  /**
   * Onglet caché : l'ambiance sonore s'arrête et, après 20 s, les autres joueurs voient le
   * statut « absent » (💤). Il disparaît dès le retour sur l'onglet.
   */
  private onVisibilityChange(hidden: boolean): void {
    setAudioPaused(hidden);
    if (this.awayTimer) clearTimeout(this.awayTimer);
    this.awayTimer = null;
    if (hidden) {
      this.awayTimer = setTimeout(() => this.net?.setAway(true), 20_000);
    } else {
      this.net?.setAway(false);
      this.unreadMentions = 0;
      document.title = 'MalinosLand';
    }
  }

  private teardown(): void {
    if (this.awayTimer) clearTimeout(this.awayTimer);
    this.dayNight?.destroy();
    this.dayNight = null;
    setDiscoLevel(0);
    this.editor?.destroy();
    this.editor = null;
    for (const c of this.cleanups) c();
    this.cleanups = [];
    for (const off of this.netCleanups) off();
    this.netCleanups = [];
    // Changement de salle : la connexion continue (elle est reprise par la nouvelle salle).
    if (!this.traveling) this.net?.stop();
    this.net = null;
  }
}
