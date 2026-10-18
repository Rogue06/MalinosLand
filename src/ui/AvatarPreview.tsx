import { useEffect, useRef } from 'preact/hooks';
import type { AvatarAppearance } from '../content/avatars';
import type { Facing } from '../core/iso';
import { renderAvatarPreview } from '../game/art/characters';

/** Aperçu d'avatar dessiné avec le même générateur que le jeu. */
export function AvatarPreview({
  look,
  facing = 'py',
  size = 120,
}: {
  look: AvatarAppearance;
  facing?: Facing;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const src = renderAvatarPreview(look, facing, 3);
    const ratio = Math.min(size / src.width, size / src.height);
    canvas.width = size * 2;
    canvas.height = size * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = src.width * ratio * 2;
    const h = src.height * ratio * 2;
    ctx.drawImage(src, (canvas.width - w) / 2, canvas.height - h, w, h);
  }, [look, facing, size]);
  return (
    <canvas
      ref={ref}
      class="avatar-preview"
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-hidden="true"
    />
  );
}
