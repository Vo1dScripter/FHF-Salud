'use client';

import Link from 'next/link';
import { type ReactNode, useId, useState } from 'react';

import { cn } from '@/lib/utils';

export type QuickNavItem = {
  active?: boolean;
  href: string;
  label: string;
};

export type QuickNavProps = {
  brand?: string;
  className?: string;
  cta?: QuickNavItem;
  endContent?: ReactNode;
  items: QuickNavItem[];
  variant?: 'centered' | 'drawer' | 'floating' | 'hamburger' | 'inline';
};

export default function QuickNav({
  brand = 'Mi Sitio',
  className,
  cta,
  endContent,
  items,
  variant = 'inline',
}: QuickNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const needsToggle = variant === 'hamburger' || variant === 'drawer';

  return (
    <nav
      className={cn('quick-nav', `quick-nav--${variant}`, className)}
      aria-label='Navegación principal'
    >
      <Link className='quick-nav__brand' href='/'>
        {brand}
      </Link>

      <div
        className={cn('quick-nav__links', isOpen && 'is-open')}
        id={menuId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false);
            event.currentTarget.parentElement
              ?.querySelector<HTMLButtonElement>('.quick-nav__toggle')
              ?.focus();
          }
        }}
      >
        {items.map((item) => (
          <Link
            aria-current={item.active ? 'page' : undefined}
            className='quick-nav__link'
            href={item.href}
            key={item.href}
            onClick={() => setIsOpen(false)}
          >
            {item.label}
          </Link>
        ))}
        {cta ? (
          <Link
            className='quick-nav__cta'
            href={cta.href}
            onClick={() => setIsOpen(false)}
          >
            {cta.label}
          </Link>
        ) : null}
      </div>

      <div className='quick-nav__end'>{endContent}</div>

      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
        className={cn('quick-nav__toggle', needsToggle && 'is-enabled')}
        onClick={() => setIsOpen((current) => !current)}
        type='button'
      >
        <span />
        <span />
      </button>

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
