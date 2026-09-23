import { useState } from 'react';

import { Alert } from '../components/Alert.jsx';
import { Field } from '../components/Field.jsx';
import { StatusPill, StatusTimeline } from '../components/StatusTimeline.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { api } from '../lib/api.js';
import { shortDate } from '../lib/format.js';

export function TrackPage() {
  const { t, language } = useSettings();
  const [reference, setReference] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.trackApplication(reference.trim());
      setResult(data.application);
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>{t('track.title')}</h1>
      <p className="lede">{t('track.lede')}</p>

      <div className="card" style={{ maxWidth: '38rem' }}>
        <form onSubmit={onSubmit} noValidate>
          <Field
            label={t('track.reference')}
            hint={t('track.referenceHint')}
            name="reference"
            value={reference}
            onChange={(event) => setReference(event.target.value.toUpperCase())}
            placeholder="SP-ABCD1234"
            required
          />
          <button className="btn btn--primary" type="submit" disabled={busy || !reference.trim()}>
            {busy ? t('track.checking') : t('track.check')}
          </button>
        </form>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      {result ? (
        <div className="card">
          <h2>
            {language === 'hi' ? result.service.nameHi : result.service.name}{' '}
            <StatusPill status={result.status} label={result.statusLabel} />
          </h2>
          <p className="big-number">{result.reference}</p>

          <dl className="detail-list">
            {result.submittedAt ? (
              <>
                <dt>{t('track.submittedOn')}</dt>
                <dd>{shortDate(result.submittedAt.slice(0, 10), language)}</dd>
              </>
            ) : null}
            <dt>{t('track.expected')}</dt>
            <dd>
              {result.expectedByDays} {t('services.days')}
            </dd>
            {result.daysSinceSubmission !== null ? (
              <>
                <dt>{t('track.daysSince')}</dt>
                <dd>{result.daysSinceSubmission}</dd>
              </>
            ) : null}
          </dl>

          <h3>{t('app.status')}</h3>
          <StatusTimeline status={result.status} />
        </div>
      ) : null}
    </>
  );
}
