import { APP_THEME_STORAGE_KEY } from '@/lib/ui/app-preferences';

const themeInitScript = `(function(){try{var root=document.documentElement;var stored=window.localStorage.getItem('${APP_THEME_STORAGE_KEY}')||'system';var resolved=stored==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):stored;root.classList.toggle('dark',resolved==='dark');}catch(e){document.documentElement.classList.remove('dark');}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />;
}
