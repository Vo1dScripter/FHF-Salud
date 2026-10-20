export default function Header() {
  return (
    <header className='border-b border-slate-200 bg-white/80 backdrop-blur'>
      <div className='mx-auto flex max-w-6xl items-center justify-between px-6 py-4'>
        <p className='text-xs tracking-[0.28em] text-slate-500 uppercase'>
          Plantilla actualizada
        </p>
        <h1 className='text-sm font-medium text-slate-900'>
          Mi Sitio con Next.js
        </h1>
      </div>
    </header>
  );
}
