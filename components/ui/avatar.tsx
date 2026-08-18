import * as React from 'react';
import { cn } from '@/lib/utils';

function Avatar({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'relative flex size-8 shrink-0 overflow-hidden rounded-full',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function AvatarFallback({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex size-full items-center justify-center rounded-full',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { Avatar, AvatarFallback };
