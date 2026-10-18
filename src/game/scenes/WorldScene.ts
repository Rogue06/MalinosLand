import Phaser from 'phaser';
import { QUESTS } from '../../content/quests';
import { loadWorld } from '../../content/world';
import { project, screenInputToWorld, unproject, type Facing, type Vec2 } from '../../core/iso';
import { facesCamera } from '../../core/rotation';
import { CHAT_MAX_LENGTH, sanitizeText } from '../../core/text';
import { NetworkClient, type RemotePeer } from '../../multiplayer/NetworkClient';
import { EMOTES, type AnimState, type Emote } from '../../multiplayer/protocol';
import {
  BroadcastChannelTransport,
  OfflineTransport,
  type Transport,
} from '../../multiplayer/Transport';
import { completeQuest, progressStore } from '../../services/progress';
import { profileStore, type Profile } from '../../services/profile';
import { renderProfile, settingsStore, type Settings } from '../../services/settings';
import {
  commands,
  dialogStore,
  hintStore,
  isInputLocked,
  panelStore,
  peersPosStore,
  playerPosStore,
  presenceStore,
  pushChat,
  pushToast,
  statsStore,
  worldInfoStore,
  zoneStore,
} from '../../state';
import { PlayerController, USE_RANGE } from '../../world/PlayerController';
import type { WorldModel, WorldObject } from '../../world/WorldModel';
import { avatarDepth, DepthIndex } from '../../world/depth';
import type { InteractionDef } from '../../world/types';
import { AvatarView } from '../entities/AvatarView';
import { TextureFactory } from '../textures';
import { WorldRenderer } from '../WorldRenderer';

export interface WorldSceneData {
  selfId: string;
}

interface RemoteAvatar {
  peer: RemotePeer;
  view: AvatarView;
}

const ROOM = 'hub';
const BASE_ZOOM = 1.35;

/**
 * Scène principale : le Hub. Elle relie le modèle du monde (logique pure),
 * le rendu, les entrées, le réseau et l'interface (via les stores).
 */
export class WorldScene extends Phaser.Scene {
  private world!: WorldModel;
  private renderer3d!: WorldRenderer;
  private tex!: TextureFactory;
  private player!: PlayerController;
  private avatar!: AvatarView;
  private depthIndex!: DepthIndex;
  private net: NetworkClient | null = null;
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

  init(data: WorldSceneData): void {
    this.selfId = data.selfId;
  }

  create(): void {
    const settings = settingsStore.get();
    const profile = profileStore.get();
    if (!profile)
      throw new Error('Profil manquant : la scène démarre après la création du personnage.');
    const rp = renderProfile(settings.quality);
    this.pixelRatio = rp.pixelRatio;

    this.world = loadWorld('hub');
    worldInfoStore.set(this.world.map);
    this.tex = new TextureFactory(this, rp.textureScale);
    this.renderer3d = new WorldRenderer(this, this.world, this.tex, {
      effects: rp.effects,
      reducedMotion: settings.reducedMotion,
      hiDpi: settings.quality === 'high',
    });
    this.renderer3d.build();
    this.depthIndex = new DepthIndex(this.world.width, this.renderer3d.depthBoxes);

    const spawn = this.world.map.spawn;
    this.player = new PlayerController(this.world, this.selfId, spawn, spawn.facing);
    this.avatar = new AvatarView(this, this.tex, profile.look, profile.name, true);

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
    this.cleanups.push(commands.on('chat-send', ({ text, scope }) => this.sendChat(text, scope)));
    this.cleanups.push(commands.on('emote', ({ emoji }) => this.playEmote(emoji)));

    void this.startNetwork(settings.multiTab);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    const onUnload = () => this.net?.stop();
    window.addEventListener('pagehide', onUnload);
    this.cleanups.push(() => window.removeEventListener('pagehide', onUnload));

    this.updatePresence();
    this.exposeDebug();
    pushChat({
      from: 'MalinosLand',
      text: 'Bienvenue au Hub ! Clique sur le sol pour te déplacer, approche-toi des objets et appuie sur E.',
      kind: 'system',
      scope: 'local',
    });
  }

  // ---------------------------------------------------------------- Caméra

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#141a2b');
    const { width: W, height: H } = this.world;
    const left = project(0, H).x;
    const right = project(W, 0).x;
    const top = project(0, 0, 3).y;
    const bottom = project(W, H).y;
    cam.setBounds(left - 260, top - 200, right - left + 520, bottom - top + 400);
    this.updateZoom();
    const p = project(this.player.pos.x, this.player.pos.y);
    cam.centerOn(p.x, p.y - 30);
    cam.startFollow(this.avatar.sprite, false, 0.12, 0.12, 0, 20);
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.updateZoom());
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

    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (!pointer.leftButtonDown() || isInputLocked()) return;
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
        if (!id) return;
        this.hovered = id;
        this.renderer3d.highlight(id, true);
      },
    );
    this.input.on(
      Phaser.Input.Events.GAMEOBJECT_OUT,
      (_p: Phaser.Input.Pointer, go: Phaser.GameObjects.GameObject) => {
        const id = go.getData('objectId') as string | undefined;
        if (!id) return;
        if (this.hovered === id) this.hovered = null;
        this.renderer3d.highlight(id, false);
      },
    );
    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        this.userZoom = Phaser.Math.Clamp(this.userZoom * (dy > 0 ? 0.9 : 1.1), 0.6, 2.4);
        this.updateZoom();
      },
    );
  }

  private readInput(): Vec2 {
    if (isInputLocked()) return { x: 0, y: 0 };
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

  private useObject(obj: WorldObject): void {
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
        dialogStore.set({ speaker: it.speaker ?? obj.entry.name, lines: it.lines, index: 0 });
        break;
      case 'panel':
        panelStore.set(it.panel);
        break;
      case 'emote':
        this.avatar.say(it.emoji, 3500);
        pushToast(it.text, it.emoji);
        if ((EMOTES as readonly string[]).includes(it.emoji))
          this.net?.sendEmote(it.emoji as Emote);
        break;
    }
    if (it.quest) this.quest(it.quest);
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

  private sendChat(raw: string, scope: 'local' | 'global'): void {
    const text = sanitizeText(raw, CHAT_MAX_LENGTH);
    if (!text) return;
    const profile = profileStore.get();
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
    if (scope === 'local') this.avatar.say(text);
    pushChat({ from: profile?.name ?? 'Moi', text, kind: 'self', scope });
    this.quest('chat');
  }

  private playEmote(emoji: Emote): void {
    this.avatar.say(emoji, 3000);
    this.net?.sendEmote(emoji);
  }

  // ---------------------------------------------------------------- Réseau

  private async startNetwork(multiTab: boolean): Promise<void> {
    this.net?.stop();
    for (const r of this.remotes.values()) r.view.destroy();
    this.remotes.clear();
    const profile = profileStore.get()!;
    const transport: Transport =
      multiTab && BroadcastChannelTransport.isSupported()
        ? new BroadcastChannelTransport()
        : new OfflineTransport();
    const net = new NetworkClient(transport, this.selfId, {
      name: profile.name,
      look: profile.look,
      state: this.localState(),
    });
    this.net = net;
    net.events.on('join', (peer) => {
      this.addRemote(peer);
      pushChat({
        from: 'MalinosLand',
        text: `${peer.name} a rejoint le Hub.`,
        kind: 'system',
        scope: 'global',
      });
    });
    net.events.on('update', (peer) => {
      if (!this.remotes.has(peer.id)) this.addRemote(peer);
    });
    net.events.on('look', (peer) => {
      this.remotes.get(peer.id)?.view.setLook(peer.look, peer.name);
      this.updatePresence();
    });
    net.events.on('leave', ({ id }) => {
      const r = this.remotes.get(id);
      if (!r) return;
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
    net.events.on('chat', ({ peer, text, scope }) => {
      if (scope === 'local') this.remotes.get(peer.id)?.view.say(text);
      pushChat({ from: peer.name, text, kind: 'peer', scope });
    });
    net.events.on('emote', ({ peer, emote }) => this.remotes.get(peer.id)?.view.say(emote, 3000));
    try {
      await net.start();
    } catch (err) {
      console.warn('[réseau] démarrage impossible, passage en solo', err);
    }
    this.updatePresence();
  }

  private addRemote(peer: RemotePeer): void {
    if (this.remotes.has(peer.id)) return;
    const view = new AvatarView(this, this.tex, peer.look, peer.name, false);
    view.x = peer.x;
    view.y = peer.y;
    view.setNameVisible(settingsStore.get().showNames);
    this.remotes.set(peer.id, { peer, view });
    this.updatePresence();
  }

  private localState() {
    const s: AnimState = this.player?.seat ? 2 : this.avatar?.moving ? 1 : 0;
    return {
      room: ROOM,
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
        ? [{ id: this.selfId, name: profile.name, look: profile.look, self: true, room: ROOM }]
        : []),
      ...[...this.remotes.values()].map(({ peer }) => ({
        id: peer.id,
        name: peer.name,
        look: peer.look,
        self: false,
        room: peer.room,
      })),
    ];
    presenceStore.set(list);
  }

  // ---------------------------------------------------------------- Réglages & profil

  private applySettings(s: Settings): void {
    this.game.loop.setFPSLimit(s.fpsLimit);
    this.avatar.setNameVisible(s.showNames);
    this.renderer3d.setLabelsVisible(s.showNames);
    for (const r of this.remotes.values()) r.view.setNameVisible(s.showNames);
    const wantsTabs = s.multiTab && BroadcastChannelTransport.isSupported();
    const hasTabs = this.net?.transportKind === 'local-tabs';
    if (this.net && wantsTabs !== hasTabs) void this.startNetwork(s.multiTab);
  }

  private onProfileChanged(p: Profile): void {
    this.avatar.setLook(p.look, p.name);
    this.net?.updateLook(p.name, p.look);
    this.updatePresence();
  }

  // ---------------------------------------------------------------- Boucle

  update(time: number, delta: number): void {
    // Pas plafonné à 250 ms : vitesse constante même à faible FPS (collisions en sous-pas).
    const dt = Math.min(delta, 250) / 1000;
    if (
      !isInputLocked() &&
      (Phaser.Input.Keyboard.JustDown(this.keys.E!) ||
        Phaser.Input.Keyboard.JustDown(this.keys.SPACE!))
    ) {
      this.onUseKey();
    }

    const step = this.player.update(dt, this.readInput());
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
          .filter((r) => r.peer.room === ROOM)
          .map((r) => ({ x: r.view.x, y: r.view.y })),
      );
    }
    if (time - this.lastStats > 500) {
      this.lastStats = time;
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
      if (r) return r.depth + (facesCamera(facing) ? 1 : -1);
    }
    return avatarDepth({ x, y }, this.depthIndex.near({ x, y }));
  }

  private updateRemotes(delta: number): void {
    const k = 1 - Math.exp(-delta / 80);
    for (const { peer, view } of this.remotes.values()) {
      const visible = peer.room === ROOM;
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
      view.update(delta, this.depthFor(view.x, view.y, seatId, view.facing));
    }
  }

  private updateZone(): void {
    const zone = this.world.zoneAt(this.player.pos);
    const id = zone?.id ?? null;
    if (id === this.zoneId) return;
    this.zoneId = id;
    zoneStore.set(zone);
    if (id === 'terrace') this.quest('terrace');
    if (id === 'hall' && !this.greeted) {
      this.greeted = true;
      this.renderer3d.objectBubble('malo', 'Bip bip ! Bienvenue !', 4500);
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
      seated: () => this.player.seat !== null,
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
      useType: (type: string) => {
        const obj = this.world.objects.find((o) => o.type === type);
        if (obj) this.useObject(obj);
        return !!obj;
      },
      zoom: (z: number) => {
        this.userZoom = Phaser.Math.Clamp(z, 0.4, 2.4);
        this.updateZoom();
      },
      peers: () => this.remotes.size,
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

  private teardown(): void {
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.net?.stop();
    this.net = null;
  }
}
