'use client';

import { type HTMLAttributes, useState } from 'react';

import { cn } from '@/lib/utils';

type Rotation = {
  x: number;
  y: number;
};

export type TiltCardProps = HTMLAttributes<HTMLDivElement> & {
  strength?: number;
};

export default function TiltCard({
  children,
  className,
  strength = 10,
  style,
  ...props
}: TiltCardProps) {
  const [rotation, setRotation] = useState<Rotation>({ x: 0, y: 0 });

  return (
    <div
      className={cn('tilt-card', className)}
      onMouseLeave={() => setRotation({ x: 0, y: 0 })}
      onMouseMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = (event.clientY - bounds.top) / bounds.height - 0.5;
        const y = (event.clientX - bounds.left) / bounds.width - 0.5;
        setRotation({ x: x * strength * -1, y: y * strength });
      }}
      style={{
        transform: `perspective(900px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
