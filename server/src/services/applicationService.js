import {
  ALLOWED_TRANSITIONS,
  STATUS_LABELS,
  TERMINAL_STATUSES,
  canTransition,
} from '../models/application.js';
import { SENIOR_AGE, getService, quoteFee } from './catalog.js';
import { ageInYears, todayIso } from '../utils/dates.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { newId, referenceNumber } from '../utils/ids.js';

/** Adds the derived fields the UI needs but the store should not duplicate. */
export function decorateApplication(application) {
  const service = getService(application.serviceId);
  const outstanding = application.documents.filter((d) => !d.ready);
  return {
    ...application,
    service: {
      id: service.id,
      name: service.name,
      nameHi: service.nameHi,
      processingDays: service.processingDays,
    },
    statusLabel: STATUS_LABELS[application.status],
    documentsReady: application.documents.length - outstanding.length,
    documentsTotal: application.documents.length,
    outstandingDocuments: outstanding.map((d) => d.id),
    canSubmit: application.status === 'draft' && outstanding.length === 0,
    isTerminal: TERMINAL_STATUSES.has(application.status),
    nextStatuses: ALLOWED_TRANSITIONS[application.status] ?? [],
  };
}

export function createApplicationService(store) {
  /** Loads an application and proves it belongs to the caller. */
  async function loadOwned(id, userId) {
    const application = await store.applications.findById(id);
    if (!application) throw notFound('We could not find that application.');
    if (application.userId !== userId) {
      throw forbidden('That application belongs to a different account.');
    }
    return application;
  }

  function priceFor(serviceId, scheme, applicantDob) {
    const senior = ageInYears(applicantDob) >= SENIOR_AGE;
    try {
      return { ...quoteFee(serviceId, { tatkal: scheme === 'tatkal', senior }), senior, scheme };
    } catch (error) {
      throw badRequest(error.message);
    }
  }

  return {
    async create(userId, input) {
      const service = getService(input.serviceId);
      const now = new Date().toISOString();

      const application = {
        id: newId(),
        reference: referenceNumber(),
        userId,
        serviceId: service.id,
        scheme: input.scheme,
        status: 'draft',
        applicant: input.applicant,
        assistance: input.assistance,
        documents: service.documents.map((doc) => ({
          id: doc.id,
          label: doc.label,
          hint: doc.hint,
          ready: false,
        })),
        fee: priceFor(service.id, input.scheme, input.applicant.dateOfBirth),
        history: [{ at: now, status: 'draft', note: 'Application started.' }],
        submittedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      await store.applications.create(application);
      return decorateApplication(application);
    },

    async list(userId) {
      const rows = await store.applications.listByUser(userId);
      return rows.map(decorateApplication);
    },

    async get(id, userId) {
      return decorateApplication(await loadOwned(id, userId));
    },

    async update(id, userId, patch) {
      const application = await loadOwned(id, userId);
      if (application.status !== 'draft') {
        throw conflict(
          'This application has already been submitted, so it can no longer be edited.',
        );
      }

      const applicant = patch.applicant
        ? {
            ...application.applicant,
            ...patch.applicant,
            address: { ...application.applicant.address, ...(patch.applicant.address ?? {}) },
          }
        : application.applicant;
      const scheme = patch.scheme ?? application.scheme;

      const updated = await store.applications.update(id, {
        applicant,
        scheme,
        assistance: patch.assistance ?? application.assistance,
        fee: priceFor(application.serviceId, scheme, applicant.dateOfBirth),
        updatedAt: new Date().toISOString(),
      });
      return decorateApplication(updated);
    },

    async setDocument(id, userId, { documentId, ready }) {
      const application = await loadOwned(id, userId);
      if (!application.documents.some((d) => d.id === documentId)) {
        throw notFound(`This application does not ask for a document called "${documentId}".`);
      }
      if (TERMINAL_STATUSES.has(application.status)) {
        throw conflict('This application is closed, so its checklist can no longer change.');
      }

      const documents = application.documents.map((doc) =>
        doc.id === documentId ? { ...doc, ready } : doc,
      );
      const updated = await store.applications.update(id, {
        documents,
        updatedAt: new Date().toISOString(),
      });
      return decorateApplication(updated);
    },

    async submit(id, userId) {
      const application = await loadOwned(id, userId);
      if (application.status !== 'draft') {
        throw conflict('This application has already been submitted.');
      }
      const missing = application.documents.filter((d) => !d.ready);
      if (missing.length > 0) {
        throw badRequest('Tick every document on the checklist before you submit.', {
          outstandingDocuments: missing.map((d) => ({ id: d.id, label: d.label })),
        });
      }

      const now = new Date().toISOString();
      const updated = await store.applications.update(id, {
        status: 'submitted',
        submittedAt: now,
        updatedAt: now,
        history: [
          ...application.history,
          { at: now, status: 'submitted', note: 'Application submitted.' },
        ],
      });
      return decorateApplication(updated);
    },

    async changeStatus(id, userId, { status, note }) {
      const application = await loadOwned(id, userId);
      if (!canTransition(application.status, status)) {
        throw conflict(
          `An application that is "${application.status}" cannot move to "${status}".`,
          { allowed: ALLOWED_TRANSITIONS[application.status] ?? [] },
        );
      }

      const now = new Date().toISOString();
      const updated = await store.applications.update(id, {
        status,
        updatedAt: now,
        history: [...application.history, { at: now, status, note: note ?? null }],
      });
      return decorateApplication(updated);
    },

    async cancel(id, userId) {
      return this.changeStatus(id, userId, {
        status: 'cancelled',
        note: 'Cancelled by the applicant.',
      });
    },

    /** Public status lookup by reference number - no account needed. */
    async trackByReference(reference) {
      const application = await store.applications.findByReference(reference.toUpperCase());
      if (!application) throw notFound('No application has that reference number.');
      const service = getService(application.serviceId);
      return {
        reference: application.reference,
        service: { id: service.id, name: service.name, nameHi: service.nameHi },
        status: application.status,
        statusLabel: STATUS_LABELS[application.status],
        submittedAt: application.submittedAt,
        updatedAt: application.updatedAt,
        expectedByDays: service.processingDays,
        daysSinceSubmission: application.submittedAt
          ? Math.max(
              0,
              Math.round(
                (Date.parse(todayIso()) - Date.parse(application.submittedAt.slice(0, 10))) /
                  86_400_000,
              ),
            )
          : null,
      };
    },
  };
}
