import { cn } from '@/lib/utils';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
}

/**
 * Avatar with deterministic initials fallback (§65). Never renders sensitive
 * profile information beyond the name-derived initials.
 */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

  return (
    <span
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-primary-subtle font-semibold text-primary',
        SIZES[size],
        className
      )}
      role="img"
      aria-label={name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote avatars from authorized storage
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

export interface AvatarGroupProps {
  names: string[];
  /** Shown when the group exceeds `max`. */
  max?: number;
  size?: AvatarSize;
  className?: string;
}

export function AvatarGroup({ names, max = 4, size = 'sm', className }: AvatarGroupProps) {
  const visible = names.slice(0, max);
  const overflow = names.length - visible.length;

  return (
    <div className={cn('flex items-center', className)}>
      {visible.map((name, index) => (
        <Avatar
          key={`${name}-${index}`}
          name={name}
          size={size}
          className={index > 0 ? '-ml-2 ring-2 ring-surface' : undefined}
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-surface-muted font-semibold text-foreground-muted ring-2 ring-surface',
            SIZES[size],
            '-ml-2'
          )}
          aria-label={`${overflow} more`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
