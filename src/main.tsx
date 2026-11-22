import { t } from './i18n';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './theme.css';
import './modules.css';
class AppBoundary extends Component<{
    children: ReactNode;
}, {
    failed: boolean;
}> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error: Error, info: ErrorInfo) { console.error('Padhai could not render', error, info.componentStack); }
    render() { return this.state.failed ? <main className="error-page"><span>{t("\u273D")}</span><h1>{t("Let\u2019s find our focus again.")}</h1><p>{t("Padhai couldn\u2019t open this time. Your saved data has not been cleared.")}</p><button className="primary" onClick={() => location.reload()}>{t("Try again")}</button></main> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<AppBoundary><App /></AppBoundary>);
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(error => console.warn('Offline installation unavailable', error)); });
}
