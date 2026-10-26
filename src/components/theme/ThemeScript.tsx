/** Preferencia visual local antes de pintar; nunca contiene datos de usuario o sesión. */
export default function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html:
          "try{document.documentElement.dataset.theme=localStorage.getItem('fhf-theme')==='dark'?'dark':'light'}catch{}",
      }}
    />
  );
}
