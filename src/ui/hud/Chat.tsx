import { useEffect, useRef, useState } from 'preact/hooks';
import { CHAT_MAX_LENGTH } from '../../core/text';
import { EMOTES, type ChatScope } from '../../multiplayer/protocol';
import { chatStore, commands, dialogStore, panelStore, statsStore, typingStore } from '../../state';
import { useStore } from '../hooks';

/** Chat : « Proximité » (même salle, bulle au-dessus de la tête) ou « Général ». */
export function Chat() {
  const messages = useStore(chatStore);
  const stats = useStore(statsStore);
  const [text, setText] = useState('');
  const [scope, setScope] = useState<ChatScope>('local');
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return;
      if (document.activeElement === input.current) return;
      if (typingStore.get() || panelStore.get() || dialogStore.get()) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages]);

  const send = (e: Event) => {
    e.preventDefault();
    if (text.trim()) commands.emit('chat-send', { text, scope });
    setText('');
    input.current?.blur();
  };

  const visible = messages.filter(
    (m) => m.kind === 'system' || m.scope === scope || m.kind === 'self',
  );
  return (
    <section class="chat panel-glass" aria-label="Discussion">
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
      </div>
      <div class="chat-log" ref={log} aria-live="polite">
        {visible.slice(-30).map((m) => (
          <p key={m.id} class={`msg ${m.kind}`}>
            <b>{m.from}</b> {m.text}
          </p>
        ))}
      </div>
      <form class="chat-input" onSubmit={send}>
        <input
          ref={input}
          type="text"
          value={text}
          maxLength={CHAT_MAX_LENGTH}
          placeholder="Entrée pour écrire…"
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
