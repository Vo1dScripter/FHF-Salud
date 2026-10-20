'use client';

import Image from 'next/image';
import { type HTMLAttributes, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

export type GalleryImage = {
  alt: string;
  caption?: string;
  height: number;
  src: string;
  width: number;
};

export type ImageGalleryProps = HTMLAttributes<HTMLDivElement> & {
  images: GalleryImage[];
  layout?: 'grid' | 'masonry' | 'showcase';
  showCaptions?: boolean;
};

export default function ImageGallery({
  className,
  images,
  layout = 'showcase',
  showCaptions = true,
  ...props
}: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeImage = activeIndex === null ? null : images[activeIndex];
  const hasMultipleImages = images.length > 1;

  const close = () => setActiveIndex(null);

  const goToPrevious = () => {
    setActiveIndex((currentIndex) => {
      if (currentIndex === null) {
        return currentIndex;
      }

      return (currentIndex - 1 + images.length) % images.length;
    });
  };

  const goToNext = () => {
    setActiveIndex((currentIndex) => {
      if (currentIndex === null) {
        return currentIndex;
      }

      return (currentIndex + 1) % images.length;
    });
  };

  const viewerLabel =
    activeImage && activeIndex !== null
      ? `${activeImage.caption ?? activeImage.alt}. Imagen ${activeIndex + 1} de ${images.length}`
      : 'Galería de imágenes';

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveIndex(null);
      }

      if (event.key === 'ArrowLeft' && hasMultipleImages) {
        setActiveIndex((currentIndex) => {
          if (currentIndex === null) {
            return currentIndex;
          }

          return (currentIndex - 1 + images.length) % images.length;
        });
      }

      if (event.key === 'ArrowRight' && hasMultipleImages) {
        setActiveIndex((currentIndex) => {
          if (currentIndex === null) {
            return currentIndex;
          }

          return (currentIndex + 1) % images.length;
        });
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeIndex, hasMultipleImages, images.length]);

  if (images.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className={cn('image-gallery', `image-gallery--${layout}`, className)}
        {...props}
      >
        {images.map((image, index) => (
          <button
            aria-label={`Abrir ${image.caption ?? image.alt}`}
            className='image-gallery__item'
            key={`${image.src}-${index}`}
            onClick={() => setActiveIndex(index)}
            type='button'
          >
            <Image
              alt={image.alt}
              height={image.height}
              sizes='(max-width: 760px) 92vw, (max-width: 1100px) 44vw, 32vw'
              src={image.src}
              width={image.width}
            />
            {showCaptions ? (
              <span className='image-gallery__caption'>
                <span>{image.caption ?? image.alt}</span>
                <span>Ver grande</span>
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {activeImage ? (
        <div
          aria-label={viewerLabel}
          aria-modal='true'
          className='lightbox-viewer'
          role='dialog'
        >
          <button
            aria-label='Cerrar galería'
            className='lightbox-viewer__backdrop'
            onClick={close}
            type='button'
          />

          <figure className='lightbox-viewer__frame'>
            <div className='lightbox-viewer__topbar'>
              <span>
                {activeIndex === null ? 1 : activeIndex + 1} / {images.length}
              </span>
              <button
                aria-label='Cerrar galería'
                className='lightbox-viewer__close'
                onClick={close}
                type='button'
              >
                &times;
              </button>
            </div>

            <Image
              alt={activeImage.alt}
              height={activeImage.height}
              priority
              sizes='100vw'
              src={activeImage.src}
              width={activeImage.width}
            />

            {activeImage.caption ? (
              <figcaption className='lightbox-viewer__caption'>
                {activeImage.caption}
              </figcaption>
            ) : null}

            {hasMultipleImages ? (
              <>
                <button
                  aria-label='Imagen anterior'
                  className='lightbox-viewer__control lightbox-viewer__control--prev'
                  onClick={goToPrevious}
                  type='button'
                >
                  &lsaquo;
                </button>
                <button
                  aria-label='Imagen siguiente'
                  className='lightbox-viewer__control lightbox-viewer__control--next'
                  onClick={goToNext}
                  type='button'
                >
                  &rsaquo;
                </button>
              </>
            ) : null}
          </figure>
        </div>
      ) : null}
    </>
  );
}
