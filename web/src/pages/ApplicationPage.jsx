import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Alert } from '../components/Alert.jsx';
import { StatusPill, StatusTimeline } from '../components/StatusTimeline.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { api } from '../lib/api.js';
import { clockTime, longDate, rupees, shortDate } from '../lib/format.js';

export function ApplicationPage() {
  const { id } = useParams();
  const { t, language } = useSettings();
  const navigate = useNavigate();

  const [application, setApplication] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadAppointment = useCallback(
    async (signal) => {
      const { appointments } = await api.listAppointments(signal);
      setAppointment(
        appointments.find((a) => a.applicationId === id && a.status === 'booked') ?? null,
      );
    },
    [id],
  );

  useEffect(() => {
    const controller = new AbortController();
    api
      .getApplication(id, controller.signal)
      .then((data) => setApplication(data.application))
      .then(() => loadAppointment(controller.signal))
      .catch((apiError) => {
        if (apiError.name !== 'AbortError') setError(apiError.message);
      });
    return () => controller.abort();
  }, [id, loadAppointment]);

  async function run(action, successMessage) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      if (result?.application) setApplication(result.application);
      if (successMessage) setNotice(successMessage);
      return result;
    } catch (apiError) {
      setError(apiError.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (error && !application) return <Alert kind="error">{error}</Alert>;
  if (!application) {
    return (
      <p role="status" aria-live="polite">
        {t('common.loading')}
      </p>
    );
  }

  const serviceName = language === 'hi' ? application.service.nameHi : application.service.name;
  const isDraft = application.status === 'draft';

  return (
    <>
      <h1>
        {serviceName} <StatusPill status={application.status} label={application.statusLabel} />
      </h1>
      <p className="big-number">{application.reference}</p>

      {error ? <Alert kind="error">{error}</Alert> : null}
      {notice ? <Alert kind="success">{notice}</Alert> : null}

      <div className="card">
        <h2>{t('app.applicant')}</h2>
        <dl className="detail-list">
          <dt>{t('auth.fullName')}</dt>
          <dd>{application.applicant.fullName}</dd>
          <dt>{t('auth.dob')}</dt>
          <dd>{shortDate(application.applicant.dateOfBirth, language)}</dd>
          <dt>{t('new.address')}</dt>
          <dd>
            {application.applicant.address.line1}
            {application.applicant.address.line2
              ? `, ${application.applicant.address.line2}`
              : ''}, {application.applicant.address.city}, {application.applicant.address.state}{' '}
            {application.applicant.address.pincode}
          </dd>
          <dt>{t('app.fee')}</dt>
          <dd>
            <strong>{rupees(application.fee.payableInr)}</strong>
            {application.fee.concessionInr > 0 ? (
              <>
                {' '}
                <span className="muted">
                  ({rupees(application.fee.baseInr)} − {rupees(application.fee.concessionInr)})
                </span>
              </>
            ) : null}
          </dd>
        </dl>
      </div>

      <div className="card">
        <h2>{t('app.checklist')}</h2>
        <p className="muted">{t('app.checklistHelp')}</p>

        <ul className="checklist">
          {application.documents.map((doc) => (
            <li key={doc.id} data-ready={String(doc.ready)}>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={doc.ready}
                  disabled={busy || application.isTerminal}
                  onChange={(event) => {
                    const ready = event.target.checked;
                    run(() => api.setDocument(application.id, { documentId: doc.id, ready }));
                  }}
                />
                <span>
                  <strong>{doc.label}</strong>
                  <br />
                  <span className="muted">{doc.hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        <p role="status" aria-live="polite">
          {t('dash.documentsReady', {
            ready: application.documentsReady,
            total: application.documentsTotal,
          })}
        </p>

        {isDraft ? (
          <div className="btn-row">
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy || !application.canSubmit}
              onClick={() => run(() => api.submitApplication(application.id), t('app.submitted'))}
            >
              {t('app.submit')}
            </button>
          </div>
        ) : null}
      </div>

      <div className="card">
        <h2>{t('app.status')}</h2>
        <StatusTimeline status={application.status} history={application.history} />
      </div>

      <div className="card">
        <h2>{t('dash.appointments')}</h2>
        {appointment ? (
          <>
            <h3>{language === 'hi' ? appointment.center.nameHi : appointment.center.name}</h3>
            <p>
              <strong>{longDate(appointment.date, language)}</strong>
              <br />
              <span className="big-number">{clockTime(appointment.startTime)}</span>
            </p>
            <p className="muted">{appointment.center.address}</p>
            <Alert kind="info">{t('book.arrive')}</Alert>
            <button
              type="button"
              className="btn btn--danger"
              disabled={busy}
              onClick={async () => {
                // eslint-disable-next-line no-alert -- a deliberate, plain confirmation
                if (!window.confirm(t('book.cancelConfirm'))) return;
                await run(() => api.cancelAppointment(appointment.id));
                setAppointment(null);
              }}
            >
              {t('book.cancel')}
            </button>
          </>
        ) : (
          <>
            <p>{t('dash.noAppointments')}</p>
            {!isDraft && !application.isTerminal ? (
              <Link className="btn btn--primary" to={`/applications/${application.id}/book`}>
                {t('app.book')}
              </Link>
            ) : null}
          </>
        )}
      </div>

      {!application.isTerminal ? (
        <div className="btn-row">
          <button
            type="button"
            className="btn btn--danger"
            disabled={busy}
            onClick={async () => {
              // eslint-disable-next-line no-alert -- a deliberate, plain confirmation
              if (!window.confirm(t('app.cancelConfirm'))) return;
              const result = await run(() => api.cancelApplication(application.id));
              if (result) navigate('/dashboard');
            }}
          >
            {t('app.cancel')}
          </button>
        </div>
      ) : null}
    </>
  );
}
