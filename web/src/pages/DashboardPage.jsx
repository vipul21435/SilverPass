import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Alert } from '../components/Alert.jsx';
import { StatusPill } from '../components/StatusTimeline.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { api } from '../lib/api.js';
import { clockTime, longDate, rupees } from '../lib/format.js';

export function DashboardPage() {
  const { t, language } = useSettings();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([api.listApplications(controller.signal), api.listAppointments(controller.signal)])
      .then(([applications, appointments]) =>
        setData({
          applications: applications.applications,
          appointments: appointments.appointments.filter((a) => a.isUpcoming),
        }),
      )
      .catch((apiError) => {
        if (apiError.name !== 'AbortError') setError(apiError.message);
      });
    return () => controller.abort();
  }, []);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) {
    return (
      <p role="status" aria-live="polite">
        {t('common.loading')}
      </p>
    );
  }

  return (
    <>
      <h1>{t('dash.title')}</h1>
      {user ? <p className="lede">{user.fullName}</p> : null}

      <div className="btn-row" style={{ marginBottom: '2rem' }}>
        <Link className="btn btn--primary" to="/applications/new">
          {t('dash.start')}
        </Link>
      </div>

      {data.applications.length === 0 ? (
        <Alert kind="info">{t('dash.empty')}</Alert>
      ) : (
        <div className="card-grid">
          {data.applications.map((application) => (
            <article className="card" key={application.id}>
              <h2>
                {language === 'hi' ? application.service.nameHi : application.service.name}{' '}
                <StatusPill status={application.status} label={application.statusLabel} />
              </h2>
              <dl className="detail-list">
                <dt>{t('dash.reference')}</dt>
                <dd className="big-number">{application.reference}</dd>
                <dt>{t('services.documents')}</dt>
                <dd>
                  {t('dash.documentsReady', {
                    ready: application.documentsReady,
                    total: application.documentsTotal,
                  })}
                </dd>
                <dt>{t('app.fee')}</dt>
                <dd>{rupees(application.fee.payableInr)}</dd>
              </dl>
              <Link className="btn btn--secondary" to={`/applications/${application.id}`}>
                {t('dash.view')}
              </Link>
            </article>
          ))}
        </div>
      )}

      <h2 style={{ marginTop: '2.5rem' }}>{t('dash.appointments')}</h2>
      {data.appointments.length === 0 ? (
        <Alert kind="info">{t('dash.noAppointments')}</Alert>
      ) : (
        <div className="card-grid">
          {data.appointments.map((appointment) => (
            <article className="card" key={appointment.id}>
              <h3>{language === 'hi' ? appointment.center.nameHi : appointment.center.name}</h3>
              <p>
                <strong>{longDate(appointment.date, language)}</strong>
                <br />
                <span className="big-number">{clockTime(appointment.startTime)}</span>
              </p>
              <p className="muted">{appointment.center.address}</p>
              <Alert kind="info">{t('book.arrive')}</Alert>
              <Link
                className="btn btn--secondary"
                to={`/applications/${appointment.applicationId}`}
              >
                {t('dash.view')}
              </Link>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
