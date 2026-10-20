'use client';

import Image from 'next/image';
import { type ButtonHTMLAttributes, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

export type LightboxImageProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> & {
  alt: string;
  caption?: string;
  height: number;
  src: string;
  width: number;
};

export default function LightboxImage({
  alt,
  caption,
  className,
  height,
  src,
  width,
  ...props
}: LightboxImageProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <>
      <button
        className={cn('lightbox-image', className)}
        onClick={() => setIsOpen(true)}
        type='button'
        {...props}
      >
        <Image alt={alt} height={height} src={src} width={width} />
      </button>

      {isOpen ? (
        <div
          aria-label={caption ?? alt}
          aria-modal='true'
          className='lightbox-viewer'
          role='dialog'
        >
          <button
            aria-label='Cerrar imagen'
            className='lightbox-viewer__backdrop'
            onClick={() => setIsOpen(false)}
            type='button'
          />
          <figure className='lightbox-viewer__frame'>
            <button
              aria-label='Cerrar imagen'
              className='lightbox-viewer__close'
              onClick={() => setIsOpen(false)}
              type='button'
            >
              &times;
            </button>
            <Image alt={alt} height={height} priority src={src} width={width} />
            {caption ? (
              <figcaption className='lightbox-viewer__caption'>
                {caption}
              </figcaption>
            ) : null}
          </figure>
        </div>
      ) : null}
    </>
  );
}
