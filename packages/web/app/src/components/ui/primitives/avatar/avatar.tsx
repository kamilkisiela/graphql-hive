import { User } from 'lucide-react';
import { lenient } from '@/lib/recipe';
import { Avatar as BaseAvatar } from '@base-ui/react/avatar';
import * as styles from './avatar.css';

const avatarVariants = lenient(styles.avatarVariants);

const iconClass = {
  xs: styles.iconClassXs,
  md: styles.iconClassMd,
} as const;

type AvatarProps = NonNullable<Parameters<typeof avatarVariants>[0]> & {
  /** The person's name. Shown as initials when there is no image, and as the image's alt text. */
  alt?: string;
  src?: string | null;
};

export function initialsOf(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(word => /^[\p{L}\p{N}]/u.test(word));
  if (words.length === 0) {
    return '';
  }
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function Avatar({ alt, src, size, variant }: AvatarProps) {
  const initials = alt ? initialsOf(alt) : '';
  const icon = iconClass[size ?? 'md'];
  return (
    <BaseAvatar.Root className={avatarVariants({ size, variant })}>
      {src ? <BaseAvatar.Image src={src} alt={alt ?? ''} className={styles.avatarImage} /> : null}
      {/* Every call site shows the name beside the avatar, so the fallback is decoration. */}
      <BaseAvatar.Fallback className={styles.avatarFallback} aria-hidden>
        {initials || <User className={icon} />}
      </BaseAvatar.Fallback>
    </BaseAvatar.Root>
  );
}
