/** Every state an application can be in, in the order an applicant sees them. */
export const APPLICATION_STATUSES = [
  'draft',
  'submitted',
  'document_verification',
  'police_verification',
  'printing',
  'dispatched',
  'delivered',
  'on_hold',
  'rejected',
  'cancelled',
];

/** Statuses from which nothing further can happen. */
export const TERMINAL_STATUSES = new Set(['delivered', 'rejected', 'cancelled']);

/**
 * Which status may follow which. Enforced centrally so an application can
 * never jump from, say, `draft` straight to `delivered`.
 */
export const ALLOWED_TRANSITIONS = {
  draft: ['submitted', 'cancelled'],
  submitted: ['document_verification', 'on_hold', 'cancelled'],
  document_verification: ['police_verification', 'on_hold', 'rejected', 'cancelled'],
  police_verification: ['printing', 'on_hold', 'rejected', 'cancelled'],
  printing: ['dispatched', 'on_hold'],
  dispatched: ['delivered'],
  delivered: [],
  on_hold: ['document_verification', 'police_verification', 'rejected', 'cancelled'],
  rejected: [],
  cancelled: [],
};

export const canTransition = (from, to) => (ALLOWED_TRANSITIONS[from] ?? []).includes(to);

/** Plain-language labels, so the UI never has to show a raw enum value. */
export const STATUS_LABELS = {
  draft: { en: 'Not submitted yet', hi: 'अभी जमा नहीं हुआ' },
  submitted: { en: 'Submitted', hi: 'जमा किया गया' },
  document_verification: { en: 'Checking your documents', hi: 'दस्तावेज़ों की जाँच' },
  police_verification: { en: 'Police verification', hi: 'पुलिस सत्यापन' },
  printing: { en: 'Your passport is being printed', hi: 'पासपोर्ट छप रहा है' },
  dispatched: { en: 'Sent by post', hi: 'डाक से भेजा गया' },
  delivered: { en: 'Delivered', hi: 'पहुँच गया' },
  on_hold: { en: 'On hold, we need something from you', hi: 'रोका गया' },
  rejected: { en: 'Not approved', hi: 'अस्वीकृत' },
  cancelled: { en: 'Cancelled', hi: 'रद्द' },
};
