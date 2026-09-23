import { Link } from 'react-router-dom';

import { useSettings } from '../context/SettingsContext.jsx';

export function NotFoundPage() {
  const { t } = useSettings();
  return (
    <div className="card center">
      <h1>{t('common.notFoundTitle')}</h1>
      <p style={{ marginInline: 'auto' }}>{t('common.notFoundBody')}</p>
      <Link className="btn btn--primary" to="/">
        {t('common.goHome')}
      </Link>
    </div>
  );
}
