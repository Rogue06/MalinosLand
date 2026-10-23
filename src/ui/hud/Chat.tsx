import { useEffect, useRef, useState } from 'preact/hooks';
import { CHAT_MAX_LENGTH } from '../../core/text';
import { EMOTES, LOCAL_CHAT_RADIUS, type ChatScope } from '../../multiplayer/protocol';
import {
  chatStore,
  commands,
  dialogStore,
  nearbyStore,
  panelStore,
  roomStore,
  statsStore,
  typingStore,
} from '../../state';
import { useStore } from '../hooks';

interface ChatProps {
  /** Chat déplié (historique visible) ou replié (dernier message + saisie). */
  open: boolean;
  onToggle: (open: boolean) => void;
}

/**
 * Chat : un seul fil (les messages « autour de moi » sont marqués 📍) et un choix clair du
 * destinataire : « Tout le monde » (par défaut) ou « Autour de moi » (à moins de 8 cases, avec
 * le nombre de Malinos qui liront). Replié par défaut sur petit écran : une ligne avec le dernier
 * message et le nombre de messages non lus.
 */
export function Chat({ open, onToggle }: ChatProps) {
  const messages = useStore(chatStore);
  const stats = useStore(statsStore);
  // Dans un logement, tout ce qu'on écrit reste entre ses murs (imposé par le serveur).
  const inHome = useStore(roomStore).room.startsWith('home-');
  const [text, setText] = useState('');
  const [scope, setScope] = useState<ChatScope>('global');
  const nearby = useStore(nearbyStore);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  // Dernier message vu chat déplié : les suivants comptent comme non lus.
  const [seenId, setSeenId] = useState(() => messages.at(-1)?.id ?? 0);
  const lastId = messages.at(-1)?.id ?? 0;
  useEffect(() => {
    if (open) setSeenId(lastId);
  }, [open, lastId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return;
      if (document.activeElement === input.current) return;
      if (typingStore.get() || panelStore.get() || dialogStore.get()) return;
      e.preventDefault();
      onToggle(true);
      input.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    // Demandé par le panneau « Que faire ? » (objectif « Dis bonjour dans le chat »).
    const off = commands.on('chat-focus', () => {
      onToggle(true);
      setTimeout(() => input.current?.focus(), 0);
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      off();
    };
  }, [onToggle]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages, open]);

  const send = (e: Event) => {
    e.preventDefault();
    if (text.trim()) commands.emit('chat-send', { text, scope: inHome ? 'local' : scope });
    setText('');
    input.current?.blur();
  };

  const local = scope === 'local' && !inHome;
  const placeholder = inHome
    ? 'Message aux personnes présentes…'
    : local
      ? nearby > 0
        ? `Message aux ${nearby} autour de toi…`
        : 'Personne autour de toi…'
      : 'Message à tout le monde…';
  const unread = messages.filter((m) => m.kind === 'peer' && m.id > seenId);
  const last = messages.at(-1);
  return (
    <section class={`chat panel-glass${open ? '' : ' collapsed'}`} aria-label="Discussion">
      {!open && (
        <button
          type="button"
          class="chat-peek"
          onClick={() => onToggle(true)}
          aria-label="Déplier la discussion"
        >
          <span class="chat-peek-text">
            {last ? (
              <>
                <b class={last.role === 'gold' ? 'gold-name' : undefined}>{last.from}</b>{' '}
                {last.text}
              </>
            ) : (
              'Discussion'
            )}
          </span>
          {unread.length > 0 && (
            <span class={`chat-unread${unread.some((m) => m.mention) ? ' mention' : ''}`}>
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
          <span class="chat-fold" aria-hidden="true">
            ▴
          </span>
        </button>
      )}
      {open && (
        <div class="chat-tabs" role="radiogroup" aria-label="À qui j’écris">
          {inHome ? (
            <span class="chat-to">🔒 Logement : seules les personnes présentes te lisent</span>
          ) : (
            <>
              <span class="chat-to">À :</span>
              <button
                type="button"
                role="radio"
                aria-checked={scope === 'global'}
                class={scope === 'global' ? 'active' : ''}
                onClick={() => setScope('global')}
                title="Tous les Malinos connectés liront ton message"
              >
                🌍 Tout le monde
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={scope === 'local'}
                class={scope === 'local' ? 'active' : ''}
                onClick={() => setScope('local')}
                title={`Seuls les Malinos à moins de ${LOCAL_CHAT_RADIUS} cases liront ton message (et le verront dans une bulle)`}
              >
                📍 Autour · {nearby}
              </button>
            </>
          )}
          <span class="chat-mode" title={`Mode réseau : ${stats.transport}`}>
            {stats.transport}
          </span>
          <button
            type="button"
            class="chat-fold-btn"
            onClick={() => onToggle(false)}
            aria-label="Replier la discussion"
            title="Replier"
          >
            ▾
          </button>
        </div>
      )}
      {open && (
        <div class="chat-log" ref={log} aria-live="polite">
          {messages.slice(-40).map((m) => (
            <p key={m.id} class={`msg ${m.kind}${m.mention ? ' mention' : ''}`}>
              {m.kind !== 'system' && m.scope === 'local' && !inHome && (
                <span class="scope-tag" title="Message « autour de moi »">
                  📍{' '}
                </span>
              )}
              <b class={m.role === 'gold' ? 'gold-name' : undefined}>{m.from}</b> {m.text}
            </p>
          ))}
        </div>
      )}
      {open && local && nearby === 0 && (
        <p class="chat-private">
          Personne à moins de {LOCAL_CHAT_RADIUS} cases : approche-toi, ou écris à 🌍 tout le monde.
        </p>
      )}
      <form class="chat-input" onSubmit={send}>
        <input
          ref={input}
          type="text"
          value={text}
          maxLength={CHAT_MAX_LENGTH}
          placeholder={placeholder}
          aria-label="Message"
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
          onFocus={() => typingStore.set(true)}
          onBlur={() => typingStore.set(false)}
          onKeyDown={(e) => e.key === 'Escape' && input.current?.blur()}
        />
        <div class="emotes" aria-label="Émotes">
          {EMOTES.slice(0, 5).map((em) => (
            <button
              type="button"
              key={em}
              onClick={() => commands.emit('emote', { emoji: em })}
              title={`Émote ${em}`}
            >
              {em}
            </button>
          ))}
        </div>
      </form>
    </section>
  );
}
