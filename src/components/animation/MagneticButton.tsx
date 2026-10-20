'use client';

import { type ButtonHTMLAttributes, useState } from 'react';

import { cn } from '@/lib/utils';

type Offset = {
  x: number;
  y: number;
};

export type MagneticButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  strength?: number;
};

export default function MagneticButton({
  children,
  className,
  strength = 0.24,
  style,
  ...props
}: MagneticButtonProps) {
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });

  return (
    <button
      className={cn('magnetic-button', className)}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
      onMouseMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - bounds.left - bounds.width / 2) * strength;
        const y = (event.clientY - bounds.top - bounds.height / 2) * strength;
        setOffset({ x, y });
      }}
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        ...style,
      }}
      type='button'
      {...props}
    >
      {children}
    </button>
  );
}
