import { cn } from '@/lib/utils';

export interface SkeletonProps {
  className?: string;
}

/** Neutral shimmer block approximating final layout (§48). */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-surface-muted', className)} />;
}
