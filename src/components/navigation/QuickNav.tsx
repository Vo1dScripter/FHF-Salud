'use client';

import Link from 'next/link';
import { useState } from 'react';

import { cn } from '@/lib/utils';

export type QuickNavItem = {
  href: string;
  label: string;
};

export type QuickNavProps = {
  brand?: string;
  className?: string;
  cta?: QuickNavItem;
  items: QuickNavItem[];
  variant?: 'centered' | 'drawer' | 'floating' | 'hamburger' | 'inline';
};

export default function QuickNav({
  brand = 'Mi Sitio',
  className,
  cta,
  items,
  variant = 'inline',
}: QuickNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const needsToggle = variant === 'hamburger' || variant === 'drawer';

  return (
    <nav
      className={cn('quick-nav', `quick-nav--${variant}`, className)}
      aria-label='Navegacion principal'
    >
      <Link className='quick-nav__brand' href='/'>
        {brand}
      </Link>

      <button
        aria-expanded={isOpen}
        aria-label='Abrir menu'
        className={cn('quick-nav__toggle', needsToggle && 'is-enabled')}
        onClick={() => setIsOpen((current) => !current)}
        type='button'
      >
        <span />
        <span />
      </button>

      <div className={cn('quick-nav__links', isOpen && 'is-open')}>
        {items.map((item) => (
          <Link className='quick-nav__link' href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
        {cta ? (
          <Link className='quick-nav__cta' href={cta.href}>
            {cta.label}
          </Link>
        ) : null}
      </div>

      {variant === 'drawer' ? (
        <button
          aria-label='Cerrar menu'
          className={cn('quick-nav__scrim', isOpen && 'is-open')}
          onClick={() => setIsOpen(false)}
          type='button'
        />
      ) : null}
    </nav>
  );
}
