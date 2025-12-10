import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useTheme } from '@/theme/useTheme';

// Range-input thumb styling and focus rings for web; native ignores this.
export function WebStyles() {
  const c = useTheme();
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = 'college-rankings-web-styles';
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = `
      html, body { background: ${c.page}; }
      input.weight-slider { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 3px; margin: 11px 0; cursor: pointer; }
      input.weight-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%;
        background: ${c.surfaceRaised}; border: 3px solid var(--thumb); box-shadow: 0 1px 3px rgba(0,0,0,.25); }
      input.weight-slider::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: ${c.surfaceRaised};
        border: 3px solid var(--thumb); }
      input.weight-slider:focus-visible { outline: 2px solid ${c.focus}; outline-offset: 4px; }
      [role="button"]:focus-visible, [role="link"]:focus-visible, [role="radio"]:focus-visible, a:focus-visible,
      input:focus-visible { outline: 2px solid ${c.focus}; outline-offset: 2px; }
    `;
  }, [c]);
  return null;
}
