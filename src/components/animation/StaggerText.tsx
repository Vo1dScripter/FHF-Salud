'use client';

import {
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
} from 'react';

import { cn } from '@/lib/utils';

import {
  motionDefaults,
  type MotionStartMode,
  type MotionStyle,
  type MotionTimingProps,
  type TextPreset,
  type TextSplit,
  toMotionCssValue,
} from './motionConfig';
import { useMotionInView } from './useMotionInView';

type TextElement = 'h1' | 'h2' | 'h3' | 'p' | 'span';

type Token = {
  kind: 'break' | 'space' | 'token';
  isSpace: boolean;
  value: string;
};

type IndexedToken = {
  animatedIndex: number;
  token: Token;
  tokenIndex: number;
};

export type StaggerTextProps = Omit<HTMLAttributes<HTMLElement>, 'children'> &
  MotionTimingProps & {
  active?: boolean;
  as?: TextElement;
  highlightColor?: string;
  once?: boolean;
  onComplete?: () => void;
  renderToken?: (token: string, index: number) => ReactNode;
  preset?: TextPreset;
  rootMargin?: string;
  split?: TextSplit;
  stagger?: number;
  start?: MotionStartMode;
  text: string;
  threshold?: number;
};

function createTokens(text: string, split: TextSplit): Token[] {
  if (split === 'lines') {
    const lines = text.split('\n');

    return lines.flatMap((value, lineIndex) => {
      const tokens: Token[] = [
        {
          kind: 'token',
          isSpace: false,
          value,
        },
      ];

      if (lineIndex < lines.length - 1) {
        tokens.push({
          kind: 'break',
          isSpace: true,
          value: '\n',
        });
      }

      return tokens;
    });
  }

  if (split === 'chars') {
    return Array.from(text).map((value) => ({
      kind: /^\s+$/.test(value) ? 'space' : 'token',
      isSpace: /^\s+$/.test(value),
      value,
    }));
  }

  return text
    .split(/(\s+)/)
    .filter(Boolean)
    .map((value) => ({
      kind: /^\s+$/.test(value) ? 'space' : 'token',
      isSpace: /^\s+$/.test(value),
      value,
    }));
}

function indexTokens(tokens: Token[]): IndexedToken[] {
  let animatedIndex = 0;

  return tokens.map((token, tokenIndex) => {
    const currentIndex = token.isSpace ? -1 : animatedIndex;

    if (!token.isSpace) {
      animatedIndex += 1;
    }

    return {
      animatedIndex: currentIndex,
      token,
      tokenIndex,
    };
  });
}

export default function StaggerText({
  active = false,
  as = 'p',
  className,
  delay = motionDefaults.text.delay,
  disabled = false,
  distance = motionDefaults.text.distance,
  duration = motionDefaults.text.duration,
  easing = motionDefaults.text.easing,
  edgeDistance = motionDefaults.text.edgeDistance,
  highlightColor,
  initiallyVisible = false,
  once = true,
  onComplete,
  preset = 'slide-up',
  renderToken,
  rotate = motionDefaults.text.rotate,
  rootMargin,
  scale = motionDefaults.text.scale,
  split = 'words',
  stagger = motionDefaults.text.stagger,
  start = 'in-view',
  style,
  text,
  threshold,
  ...props
}: StaggerTextProps) {
  const Component = as;
  const { ref, isVisible } = useMotionInView({
    disabled: disabled || start !== 'in-view',
    initiallyVisible,
    once,
    threshold,
    rootMargin,
  });
  const tokens = createTokens(text, split);
  const indexedTokens = indexTokens(tokens);
  const animatedTokenCount = indexedTokens.filter(
    ({ token }) => !token.isSpace,
  ).length;
  const shouldAnimate =
    !disabled &&
    (start === 'manual' ? active : start === 'immediate' ? true : isVisible);
  const isRenderedVisible = disabled || shouldAnimate;

  useEffect(() => {
    if (!onComplete || !shouldAnimate) {
      return;
    }

    const totalDuration =
      delay + duration + Math.max(animatedTokenCount - 1, 0) * stagger;
    const timeout = window.setTimeout(onComplete, totalDuration);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [animatedTokenCount, delay, duration, onComplete, shouldAnimate, stagger]);

  const motionStyle: MotionStyle = {
    '--motion-delay': `${delay}ms`,
    '--motion-distance': toMotionCssValue(distance, 'px'),
    '--motion-duration': `${duration}ms`,
    '--motion-edge-distance': toMotionCssValue(edgeDistance, 'px'),
    '--motion-ease': easing,
    '--motion-highlight-color': highlightColor,
    '--motion-rotate': toMotionCssValue(rotate, 'deg'),
    '--motion-scale': toMotionCssValue(scale, ''),
    '--motion-stagger': `${stagger}ms`,
    ...style,
  };

  return (
    <Component
      ref={ref as never}
      aria-label={text}
      className={cn(
        'motion-text',
        `motion-text--${preset}`,
        isRenderedVisible && 'is-visible',
        disabled && 'motion-disabled',
        className,
      )}
      style={motionStyle}
      {...props}
    >
      {indexedTokens.map(({ animatedIndex, token, tokenIndex }) => {
        if (token.kind === 'break') {
          return <br key={`break-${tokenIndex}`} aria-hidden='true' />;
        }

        if (token.isSpace) {
          return (
            <span
              key={`space-${tokenIndex}`}
              aria-hidden='true'
              className='motion-text__space'
            >
              {token.value}
            </span>
          );
        }

        return (
          <span
            key={`token-${tokenIndex}-${animatedIndex}-${token.value}`}
            aria-hidden='true'
            className='motion-text__token'
            style={
              {
                '--motion-index': animatedIndex,
              } as CSSProperties
            }
          >
            {renderToken
              ? renderToken(token.value, animatedIndex)
              : token.value}
          </span>
        );
      })}
    </Component>
  );
}
