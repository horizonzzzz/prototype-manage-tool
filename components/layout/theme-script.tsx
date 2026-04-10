import { APP_THEME_STORAGE_KEY } from '@/lib/ui/app-preferences';

const themeInitScript = `(function(){try{var raw=window.localStorage.getItem('${APP_THEME_STORAGE_KEY}');var theme=raw==='dark'?'dark':'light';document.documentElement.dataset.theme=theme;}catch(e){document.documentElement.dataset.theme='light';}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />;
}
