import { type HTMLAttributes, type ReactNode } from 'react';

import MotionGroup from './MotionGroup';

export type RevealGridProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  stagger?: number;
};

export default function RevealGrid({
  children,
  className,
  stagger = 90,
  ...props
}: RevealGridProps) {
  return (
    <MotionGroup
      as='div'
      className={className}
      preset='fade-up'
      stagger={stagger}
      {...props}
    >
      {children}
    </MotionGroup>
  );
}
