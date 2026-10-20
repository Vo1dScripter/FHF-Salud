'use client';

import { type FormEvent, type HTMLAttributes, useState } from 'react';

import { cn } from '@/lib/utils';

export type QuickContactFormProps = HTMLAttributes<HTMLFormElement> & {
  submitLabel?: string;
};

export default function QuickContactForm({
  className,
  submitLabel = 'Enviar',
  ...props
}: QuickContactFormProps) {
  const [status, setStatus] = useState<'idle' | 'sent'>('idle');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sent');
  };

  return (
    <form className={cn('quick-form', className)} onSubmit={handleSubmit} {...props}>
      <label>
        Nombre
        <input name='name' placeholder='Tu nombre' required type='text' />
      </label>
      <label>
        Email
        <input name='email' placeholder='correo@dominio.com' required type='email' />
      </label>
      <label>
        Mensaje
        <textarea name='message' placeholder='Cuéntame qué necesitas' required />
      </label>
      <button type='submit'>{submitLabel}</button>
      {status === 'sent' ? (
        <p className='quick-form__status'>Formulario listo para conectar a tu API.</p>
      ) : null}
    </form>
  );
}
