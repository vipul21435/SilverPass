import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Alert } from '../components/Alert.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { api } from '../lib/api.js';
import { rupees } from '../lib/format.js';

export function ServicesPage() {
  const { t, language } = useSettings();
  const [services, setServices] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .services()
      .then((data) => setServices(data.services))
      .catch((apiError) => setError(apiError.message));
  }, []);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!services) {
    return (
      <p role="status" aria-live="polite">
        {t('common.loading')}
      </p>
    );
  }

  return (
    <>
      <h1>{t('services.title')}</h1>
      <div className="card-grid">
        {services.map((service) => (
          <article className="card" key={service.id}>
            <h2>{language === 'hi' ? service.nameHi : service.name}</h2>
            <p>{language === 'hi' ? service.summaryHi : service.summary}</p>

            <dl className="detail-list">
              <dt>{t('services.fee')}</dt>
              <dd>{rupees(service.feeInr)}</dd>
              {service.tatkalFeeInr ? (
                <>
                  <dt>{t('services.tatkalFee')}</dt>
                  <dd>{rupees(service.tatkalFeeInr)}</dd>
                </>
              ) : null}
              <dt>{t('services.processing')}</dt>
              <dd>
                {service.processingDays} {t('services.days')}
              </dd>
            </dl>

            {service.seniorConcessionPercent > 0 ? (
              <p className="muted">
                {t('services.concession', { percent: service.seniorConcessionPercent })}
              </p>
            ) : null}

            <h3>{t('services.documents')}</h3>
            <ul>
              {service.documents.map((doc) => (
                <li key={doc.id}>
                  <strong>{doc.label}</strong>
                  <br />
                  <span className="muted">{doc.hint}</span>
                </li>
              ))}
            </ul>

            <Link className="btn btn--primary" to={`/applications/new?service=${service.id}`}>
              {t('services.choose')}
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}
