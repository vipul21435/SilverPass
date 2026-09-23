import { Link, NavLink, useNavigate } from 'react-router-dom';

import { AccessibilityBar } from './AccessibilityBar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';

export function Layout({ children }) {
  const { t } = useSettings();
  const { isSignedIn, signOut } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: '/', key: 'nav.home', end: true },
    { to: '/services', key: 'nav.services' },
    { to: '/track', key: 'nav.track' },
    ...(isSignedIn ? [{ to: '/dashboard', key: 'nav.dashboard' }] : []),
  ];

  return (
    <div className="page">
      <a className="skip-link" href="#main">
        {t('a11y.skip')}
      </a>

      <AccessibilityBar />

      <header className="site-header">
        <div className="shell header-bar">
          <Link to="/" className="wordmark">
            {t('app.name')}
          </Link>
          <nav className="site-nav" aria-label={t('nav.home')}>
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end}>
                {t(link.key)}
              </NavLink>
            ))}
            {isSignedIn ? (
              <button
                type="button"
                onClick={() => {
                  signOut();
                  navigate('/', { replace: true });
                }}
              >
                {t('nav.signOut')}
              </button>
            ) : (
              <>
                <NavLink to="/sign-in">{t('nav.signIn')}</NavLink>
                <NavLink to="/register">{t('nav.register')}</NavLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="shell" id="main" tabIndex={-1}>
        {children}
      </main>

      <footer className="site-footer">
        <div className="shell">
          <p>
            <strong>{t('app.name')}</strong> - {t('app.tagline')}
          </p>
          <p className="muted" style={{ color: 'inherit' }}>
            {t('app.disclaimer')}
          </p>
        </div>
      </footer>
    </div>
  );
}
