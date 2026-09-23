import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApplicationPage } from '../pages/ApplicationPage.jsx';
import { api } from '../lib/api.js';
import { renderApp } from './utils.jsx';

const DOCS = [
  { id: 'old-passport', label: 'Your current passport', hint: 'Bring the original.', ready: false },
  { id: 'aadhaar', label: 'Aadhaar card', hint: 'Original plus a photocopy.', ready: false },
];

const draft = (overrides = {}) => ({
  id: 'app-1',
  reference: 'SP-QWER5678',
  status: 'draft',
  statusLabel: { en: 'Not submitted yet', hi: 'अभी जमा नहीं हुआ' },
  service: { id: 'renewal', name: 'Renew a passport', nameHi: 'पासपोर्ट नवीनीकरण' },
  applicant: {
    fullName: 'Kamala Devi',
    dateOfBirth: '1953-07-19',
    address: { line1: '14 Rose Lane', city: 'New Delhi', state: 'Delhi', pincode: '110024' },
  },
  documents: DOCS,
  documentsReady: 0,
  documentsTotal: 2,
  fee: { baseInr: 1500, concessionInr: 150, payableInr: 1350 },
  history: [{ at: '2026-09-01T10:00:00.000Z', status: 'draft', note: 'Application started.' }],
  canSubmit: false,
  isTerminal: false,
  ...overrides,
});

const renderPage = () =>
  renderApp(
    <Routes>
      <Route path="/applications/:id" element={<ApplicationPage />} />
    </Routes>,
    { route: '/applications/app-1' },
  );

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, 'listAppointments').mockResolvedValue({ appointments: [] });
});

describe('document checklist', () => {
  it('sends ready:true when a document is ticked', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getApplication').mockResolvedValue({ application: draft() });
    const setDocument = vi.spyOn(api, 'setDocument').mockResolvedValue({
      application: draft({
        documents: [{ ...DOCS[0], ready: true }, DOCS[1]],
        documentsReady: 1,
      }),
    });

    renderPage();

    const box = await screen.findByRole('checkbox', { name: /your current passport/i });
    expect(box).not.toBeChecked();

    await user.click(box);

    await waitFor(() =>
      expect(setDocument).toHaveBeenCalledWith('app-1', {
        documentId: 'old-passport',
        ready: true,
      }),
    );
    expect(await screen.findByRole('checkbox', { name: /your current passport/i })).toBeChecked();
    expect(screen.getByText('1 of 2 documents ready')).toBeInTheDocument();
  });

  it('sends ready:false when a document is unticked', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getApplication').mockResolvedValue({
      application: draft({
        documents: [{ ...DOCS[0], ready: true }, DOCS[1]],
        documentsReady: 1,
      }),
    });
    const setDocument = vi.spyOn(api, 'setDocument').mockResolvedValue({
      application: draft({ documentsReady: 0 }),
    });

    renderPage();

    await user.click(await screen.findByRole('checkbox', { name: /your current passport/i }));

    await waitFor(() =>
      expect(setDocument).toHaveBeenCalledWith('app-1', {
        documentId: 'old-passport',
        ready: false,
      }),
    );
  });

  it('keeps submit unavailable until every document is ready', async () => {
    vi.spyOn(api, 'getApplication').mockResolvedValue({ application: draft() });
    renderPage();

    expect(await screen.findByRole('button', { name: /submit this application/i })).toBeDisabled();
  });

  it('enables submit once the server says the application is ready', async () => {
    vi.spyOn(api, 'getApplication').mockResolvedValue({
      application: draft({
        documents: DOCS.map((d) => ({ ...d, ready: true })),
        documentsReady: 2,
        canSubmit: true,
      }),
    });
    renderPage();

    expect(await screen.findByRole('button', { name: /submit this application/i })).toBeEnabled();
  });

  it('shows the fee with the senior concession worked out', async () => {
    vi.spyOn(api, 'getApplication').mockResolvedValue({ application: draft() });
    renderPage();

    expect(await screen.findByText('₹1,350')).toBeInTheDocument();
    expect(screen.getByText(/₹1,500 - ₹150/)).toBeInTheDocument();
  });

  it('locks the checklist once the application is closed', async () => {
    vi.spyOn(api, 'getApplication').mockResolvedValue({
      application: draft({
        status: 'cancelled',
        statusLabel: { en: 'Cancelled', hi: 'रद्द' },
        isTerminal: true,
      }),
    });
    renderPage();

    expect(await screen.findByRole('checkbox', { name: /your current passport/i })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: /submit this application/i }),
    ).not.toBeInTheDocument();
  });

  it('reports a failed update instead of pretending it worked', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getApplication').mockResolvedValue({ application: draft() });
    vi.spyOn(api, 'setDocument').mockRejectedValue(
      Object.assign(new Error('This application is closed.'), { name: 'ApiError' }),
    );

    renderPage();
    await user.click(await screen.findByRole('checkbox', { name: /aadhaar card/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This application is closed.');
  });
});
