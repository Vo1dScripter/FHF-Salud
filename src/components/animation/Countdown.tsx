'use client';

import { type HTMLAttributes, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

type CountdownUnit = {
  label: string;
  value: number;
};

export type CountdownProps = HTMLAttributes<HTMLDivElement> & {
  completedLabel?: string;
  labels?: {
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
  };
  targetDate: Date | string;
};

const defaultLabels = {
  days: 'dias',
  hours: 'horas',
  minutes: 'min',
  seconds: 'seg',
};

function getUnits(targetDate: Date | string, labels: typeof defaultLabels) {
  const target = new Date(targetDate).getTime();
  const difference = Math.max(target - Date.now(), 0);

  return {
    isComplete: difference <= 0,
    units: [
      {
        label: labels.days,
        value: Math.floor(difference / (1000 * 60 * 60 * 24)),
      },
      {
        label: labels.hours,
        value: Math.floor((difference / (1000 * 60 * 60)) % 24),
      },
      {
        label: labels.minutes,
        value: Math.floor((difference / (1000 * 60)) % 60),
      },
      {
        label: labels.seconds,
        value: Math.floor((difference / 1000) % 60),
      },
    ] satisfies CountdownUnit[],
  };
}

export default function Countdown({
  className,
  completedLabel = 'Fecha alcanzada',
  labels = defaultLabels,
  targetDate,
  ...props
}: CountdownProps) {
  const [state, setState] = useState(() => getUnits(targetDate, labels));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setState(getUnits(targetDate, labels));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [labels, targetDate]);

  return (
    <div className={cn('countdown', className)} {...props}>
      {state.isComplete ? (
        <p className='countdown__complete'>{completedLabel}</p>
      ) : (
        state.units.map((unit) => (
          <span className='countdown__unit' key={unit.label}>
            <strong>{String(unit.value).padStart(2, '0')}</strong>
            <span>{unit.label}</span>
          </span>
        ))
      )}
    </div>
  );
}
