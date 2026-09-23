import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Alert } from '../components/Alert.jsx';
import { Field } from '../components/Field.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { api } from '../lib/api.js';
import { clockTime, longDate } from '../lib/format.js';

export function BookAppointmentPage() {
  const { id } = useParams();
  const { t, language } = useSettings();
  const navigate = useNavigate();

  const [centers, setCenters] = useState([]);
  const [dates, setDates] = useState([]);
  const [centerId, setCenterId] = useState('');
  const [date, setDate] = useState('');
  const [slotView, setSlotView] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([api.centers(), api.openDates(controller.signal)])
      .then(([centerData, dateData]) => {
        setCenters(centerData.centers);
        setDates(dateData.dates);
        setCenterId((current) => current || centerData.centers[0].id);
        setDate((current) => current || dateData.dates[0]);
      })
      .catch((apiError) => {
        if (apiError.name !== 'AbortError') setError(apiError.message);
      });
    return () => controller.abort();
  }, []);

  // Reload the times whenever the centre or the day changes.
  useEffect(() => {
    if (!centerId || !date) return undefined;
    const controller = new AbortController();
    setSlotView(null);
    setChosen(null);
    api
      .slots({ centerId, date }, controller.signal)
      .then(setSlotView)
      .catch((apiError) => {
        if (apiError.name !== 'AbortError') setError(apiError.message);
      });
    return () => controller.abort();
  }, [centerId, date]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api.bookAppointment({ applicationId: id, centerId, date, startTime: chosen });
      navigate(`/applications/${id}`, { replace: true });
    } catch (apiError) {
      setError(apiError.message);
      // The seat may have just gone; show the current picture rather than a stale one.
      api
        .slots({ centerId, date })
        .then(setSlotView)
        .catch(() => {});
      setChosen(null);
    } finally {
      setBusy(false);
    }
  }

  const center = centers.find((c) => c.id === centerId);

  return (
    <>
      <h1>{t('book.title')}</h1>
      {error ? <Alert kind="error">{error}</Alert> : null}

      <div className="card">
        <Field
          as="select"
          label={t('book.center')}
          value={centerId}
          onChange={(event) => setCenterId(event.target.value)}
        >
          {centers.map((option) => (
            <option key={option.id} value={option.id}>
              {language === 'hi' ? option.nameHi : option.name}
            </option>
          ))}
        </Field>

        {center ? (
          <p className="muted">
            {center.address}
            <br />
            {center.stepFreeAccess ? `✓ ${t('book.stepFree')}` : `• ${t('book.noStepFree')}`}
            {' · '}
            {center.wheelchairsAvailable
              ? `✓ ${t('book.wheelchairs')}`
              : `• ${t('book.noWheelchairs')}`}
          </p>
        ) : null}

        <Field
          as="select"
          label={t('book.date')}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        >
          {dates.map((option) => (
            <option key={option} value={option}>
              {longDate(option, language)}
            </option>
          ))}
        </Field>
      </div>

      <div className="card">
        <h2 id="slots-heading">{t('book.slots')}</h2>

        {!slotView ? (
          <p role="status" aria-live="polite">
            {t('common.loading')}
          </p>
        ) : !slotView.bookable ? (
          <Alert kind="warning">{slotView.reason}</Alert>
        ) : slotView.slots.every((slot) => !slot.available) ? (
          <Alert kind="warning">{t('book.noSlots')}</Alert>
        ) : (
          <ul className="slot-grid" aria-labelledby="slots-heading">
            {slotView.slots.map((slot) => {
              const note =
                slot.seatsLeft === 0
                  ? t('book.full')
                  : slot.seniorOnly && !slot.available
                    ? t('book.seniorOnly')
                    : slot.seniorOnly
                      ? t('book.seniorYours')
                      : t('book.seatsLeft', { count: slot.seatsLeft });

              return (
                <li key={slot.startTime}>
                  <button
                    type="button"
                    className="slot"
                    disabled={!slot.available}
                    aria-pressed={chosen === slot.startTime}
                    onClick={() => setChosen(slot.startTime)}
                  >
                    <span className="slot-time">{clockTime(slot.startTime)}</span>
                    <span className="slot-note">{note}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="btn-row">
          <button
            type="button"
            className="btn btn--primary"
            disabled={!chosen || busy}
            onClick={confirm}
          >
            {busy ? t('book.booking') : t('book.confirm')}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => navigate(`/applications/${id}`)}
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    </>
  );
}
