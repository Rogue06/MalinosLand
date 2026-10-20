import { useEffect, useRef, useState } from 'preact/hooks';
import { CHAT_MAX_LENGTH } from '../../core/text';
import { EMOTES, type ChatScope } from '../../multiplayer/protocol';
import { chatStore, commands, dialogStore, panelStore, statsStore, typingStore } from '../../state';
import { isTouchDevice } from '../../services/device';
import { useStore } from '../hooks';

interface ChatProps {
  /** Chat déplié (historique visible) ou replié (dernier message + saisie). */
  open: boolean;
  onToggle: (open: boolean) => void;
}

/**
 * Chat : « Proximité » (même salle, bulle au-dessus de la tête) ou « Général ». Replié par
 * défaut sur petit écran : une ligne avec le dernier message et le nombre de messages non lus.
 */
export function Chat({ open, onToggle }: ChatProps) {
  const messages = useStore(chatStore);
  const stats = useStore(statsStore);
  const [text, setText] = useState('');
  const [scope, setScope] = useState<ChatScope>('local');
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
    return () => window.removeEventListener('keydown', onKey);
  }, [onToggle]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages, open]);

  const send = (e: Event) => {
    e.preventDefault();
    if (text.trim()) commands.emit('chat-send', { text, scope });
    setText('');
    input.current?.blur();
  };

  const visible = messages.filter(
    (m) => m.kind === 'system' || m.scope === scope || m.kind === 'self',
  );
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
                <b>{last.from}</b> {last.text}
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
        <div class="chat-tabs" role="tablist">
          {(['local', 'global'] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={scope === s}
              class={scope === s ? 'active' : ''}
              onClick={() => setScope(s)}
            >
              {s === 'local' ? 'Proximité' : 'Général'}
            </button>
          ))}
          <span class="chat-mode" title="Mode réseau actuel">
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
          {visible.slice(-30).map((m) => (
            <p key={m.id} class={`msg ${m.kind}${m.mention ? ' mention' : ''}`}>
              <b>{m.from}</b> {m.text}
            </p>
          ))}
        </div>
      )}
      <form class="chat-input" onSubmit={send}>
        <input
          ref={input}
          type="text"
          value={text}
          maxLength={CHAT_MAX_LENGTH}
          placeholder={isTouchDevice() ? 'Écrire un message…' : 'Entrée pour écrire…'}
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
