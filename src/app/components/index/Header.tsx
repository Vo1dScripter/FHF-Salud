export default function Header() {
  return (
    <header className='border-b border-slate-200 bg-white/80 backdrop-blur'>
      <div className='mx-auto flex max-w-6xl items-center justify-between px-6 py-4'>
        <p className='text-xs font-semibold tracking-[0.28em] text-teal-700 uppercase'>
          FHF Salud
        </p>
        <p className='text-sm font-medium text-slate-700'>Gestión médica</p>
      </div>
    </header>
  );
}
