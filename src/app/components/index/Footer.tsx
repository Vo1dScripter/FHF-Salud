export default function Footer() {
  return (
    <footer className='border-t border-slate-200 bg-slate-50'>
      <div className='mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 text-sm text-slate-500 md:flex-row md:items-center md:justify-between'>
        <p>
          © {new Date().getFullYear()} FHF Salud. Todos los derechos reservados.
        </p>
        <p>Proyecto académico · Ingeniería de Software SCD-1011.</p>
      </div>
    </footer>
  );
}
