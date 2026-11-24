import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Recover automatically (once per session) if a stale PWA/CDN chunk fails to load after a new deploy
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  try {
    const reloadKey = 'cbt_chunk_reload_once';
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, String(Date.now()));
      window.location.reload();
    }
  } catch {
    window.location.reload();
  }
});

try {
  registerSW({
    immediate: true,
    onRegisterError() {
      // Ignore SW registration failure so app boot is never blocked
    },
  });
} catch {
  // Ignore SW registration errors in restricted browsers/iframes
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
