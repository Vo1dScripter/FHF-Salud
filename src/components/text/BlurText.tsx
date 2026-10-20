import StaggerText from '@/components/animation/StaggerText';

type BlurTextProps = {
  text: string;
  delay?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom';
};

export default function BlurText({
  text,
  delay = 70,
  className,
  animateBy = 'words',
  direction = 'top',
}: BlurTextProps) {
  return (
    <StaggerText
      text={text}
      className={className}
      split={animateBy === 'letters' ? 'chars' : 'words'}
      preset={direction === 'top' ? 'blur-down' : 'blur-up'}
      stagger={delay}
    />
  );
}
