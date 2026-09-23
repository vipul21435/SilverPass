import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';

export function HomePage() {
  const { t } = useSettings();
  const { isSignedIn } = useAuth();

  const steps = ['step1', 'step2', 'step3', 'step4'];

  return (
    <>
      <div className="hero">
        <h1>{t('home.title')}</h1>
        <p className="lede">{t('home.lede')}</p>
        <div className="btn-row">
          <Link className="btn btn--primary" to={isSignedIn ? '/applications/new' : '/register'}>
            {t('home.cta.start')}
          </Link>
          <Link className="btn btn--secondary" to="/track">
            {t('home.cta.track')}
          </Link>
        </div>
      </div>

      <h2>{t('app.tagline')}</h2>
      <div className="card-grid">
        {steps.map((step) => (
          <div className="card" key={step}>
            <h3>{t(`home.${step}.title`)}</h3>
            <p>{t(`home.${step}.body`)}</p>
          </div>
        ))}
      </div>
    </>
  );
}
