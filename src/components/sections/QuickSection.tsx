import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export type QuickSectionProps = HTMLAttributes<HTMLElement> & {
  eyebrow?: string;
  intro?: string;
  title?: string;
  variant?: 'band' | 'compact' | 'split';
};

export default function QuickSection({
  children,
  className,
  eyebrow,
  intro,
  title,
  variant = 'band',
  ...props
}: QuickSectionProps) {
  return (
    <section className={cn('quick-section', `quick-section--${variant}`, className)} {...props}>
      <div className='quick-section__header'>
        {eyebrow ? <p className='quick-section__eyebrow'>{eyebrow}</p> : null}
        {title ? <h2>{title}</h2> : null}
        {intro ? <p className='quick-section__intro'>{intro}</p> : null}
      </div>
      <div className='quick-section__body'>{children}</div>
    </section>
  );
}
