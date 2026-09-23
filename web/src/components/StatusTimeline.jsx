import { useSettings } from '../context/SettingsContext.jsx';

/** The happy path, so someone can see where they are and what is still to come. */
const MAIN_PATH = [
  'submitted',
  'document_verification',
  'police_verification',
  'printing',
  'dispatched',
  'delivered',
];

const LABELS = {
  submitted: { en: 'Submitted', hi: 'जमा किया गया' },
  document_verification: { en: 'Checking your documents', hi: 'दस्तावेज़ों की जाँच' },
  police_verification: { en: 'Police verification', hi: 'पुलिस सत्यापन' },
  printing: { en: 'Your passport is being printed', hi: 'पासपोर्ट छप रहा है' },
  dispatched: { en: 'Sent by post', hi: 'डाक से भेजा गया' },
  delivered: { en: 'Delivered', hi: 'पहुँच गया' },
};

export function StatusTimeline({ status, history = [] }) {
  const { language, t } = useSettings();
  const currentIndex = MAIN_PATH.indexOf(status);
  const reachedAt = new Map(history.map((entry) => [entry.status, entry.at]));

  // Off the happy path (on hold, rejected, cancelled) a progress ladder would
  // mislead, so show what actually happened instead.
  if (currentIndex === -1) {
    return (
      <ol className="timeline">
        {history.map((entry) => (
          <li key={`${entry.status}-${entry.at}`} data-state="done">
            <span className="timeline-title">{entry.status.replaceAll('_', ' ')}</span>
            <span className="timeline-meta">
              {new Date(entry.at).toLocaleDateString()}
              {entry.note ? ` — ${entry.note}` : ''}
            </span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol className="timeline">
      {MAIN_PATH.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
        const at = reachedAt.get(step);
        return (
          <li key={step} data-state={state}>
            <span className="timeline-title">
              {LABELS[step][language] ?? LABELS[step].en}
              {state === 'current' ? (
                <span className="visually-hidden"> — {t('app.status')}</span>
              ) : null}
            </span>
            {at ? <span className="timeline-meta">{new Date(at).toLocaleDateString()}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

const PILL_KIND = {
  draft: 'draft',
  on_hold: 'draft',
  delivered: 'done',
  rejected: 'stopped',
  cancelled: 'stopped',
};

export function StatusPill({ status, label }) {
  const { language } = useSettings();
  return (
    <span className={`pill pill--${PILL_KIND[status] ?? 'progress'}`}>
      {label?.[language] ?? label?.en ?? status}
    </span>
  );
}
