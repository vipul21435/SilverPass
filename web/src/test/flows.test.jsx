import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProtectedRoute } from '../components/ProtectedRoute.jsx';
import { DashboardPage } from '../pages/DashboardPage.jsx';
import { SignInPage } from '../pages/SignInPage.jsx';
import { TrackPage } from '../pages/TrackPage.jsx';
import { ApiError, api, tokenStore } from '../lib/api.js';
import { renderApp, renderWithSettings } from './utils.jsx';

const apiError = (status, code, message, details) =>
  new ApiError(status, { error: { code, message, details } });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('signing in', () => {
  it('shows the message from the server when the details are wrong', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'login').mockRejectedValue(
      apiError(401, 'UNAUTHORIZED', 'That email address and password do not match.'),
    );

    renderApp(<SignInPage />);

    await user.type(screen.getByLabelText(/email/i), 'someone@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('That email address and password do not match.');
  });

  it('puts a field-level message next to the field it belongs to', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'login').mockRejectedValue(
      apiError(400, 'BAD_REQUEST', 'Some of the details need fixing.', {
        fields: [{ field: 'email', message: 'Enter a valid email address.' }],
      }),
    );

    renderApp(<SignInPage />);

    await user.type(screen.getByLabelText(/email/i), 'nope');
    await user.type(screen.getByLabelText(/password/i), 'something');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() =>
      expect(screen.getByLabelText(/email/i)).toHaveAccessibleDescription(
        expect.stringContaining('Enter a valid email address.'),
      ),
    );
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables the button and says what is happening while it works', async () => {
    const user = userEvent.setup();
    let reject;
    vi.spyOn(api, 'login').mockReturnValue(
      new Promise((_resolve, rejectRequest) => {
        reject = rejectRequest;
      }),
    );

    renderApp(<SignInPage />);
    await user.type(screen.getByLabelText(/email/i), 'someone@example.com');
    await user.type(screen.getByLabelText(/password/i), 'a password');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByRole('button', { name: /signing you in/i })).toBeDisabled();

    // Let the request settle so the component finishes its work inside the
    // test rather than after it has been torn down.
    reject(apiError(401, 'UNAUTHORIZED', 'That email address and password do not match.'));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeEnabled();
  });
});

describe('tracking without an account', () => {
  it('shows the status for a real reference number', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'trackApplication').mockResolvedValue({
      application: {
        reference: 'SP-ABCD1234',
        service: { id: 'renewal', name: 'Renew a passport', nameHi: 'पासपोर्ट नवीनीकरण' },
        status: 'police_verification',
        statusLabel: { en: 'Police verification', hi: 'पुलिस सत्यापन' },
        submittedAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-10T10:00:00.000Z',
        expectedByDays: 21,
        daysSinceSubmission: 12,
      },
    });

    renderWithSettings(<TrackPage />);

    await user.type(screen.getByLabelText(/reference number/i), 'sp-abcd1234');
    await user.click(screen.getByRole('button', { name: /^check$/i }));

    expect(await screen.findByText('SP-ABCD1234')).toBeInTheDocument();
    expect(screen.getAllByText(/police verification/i).length).toBeGreaterThan(0);
    expect(api.trackApplication).toHaveBeenCalledWith('SP-ABCD1234');
  });

  it('explains an unknown reference instead of showing a blank page', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'trackApplication').mockRejectedValue(
      apiError(404, 'NOT_FOUND', 'No application has that reference number.'),
    );

    renderWithSettings(<TrackPage />);
    await user.type(screen.getByLabelText(/reference number/i), 'SP-ZZZZZZZZ');
    await user.click(screen.getByRole('button', { name: /^check$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No application has that reference number.',
    );
  });

  it('keeps the check button disabled until something is typed', () => {
    renderWithSettings(<TrackPage />);
    expect(screen.getByRole('button', { name: /^check$/i })).toBeDisabled();
  });
});

describe('protected pages', () => {
  // A real route table, because ProtectedRoute redirects. Rendered on its own
  // it would only ever redirect back to itself.
  const routes = (
    <Routes>
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <p>Your applications</p>
          </ProtectedRoute>
        }
      />
      <Route path="/sign-in" element={<p>Please sign in</p>} />
    </Routes>
  );

  it('sends a signed-out visitor to the sign-in page', async () => {
    renderApp(routes, { route: '/dashboard' });

    expect(await screen.findByText('Please sign in')).toBeInTheDocument();
    expect(screen.queryByText('Your applications')).not.toBeInTheDocument();
  });

  it('lets a signed-in visitor through', async () => {
    tokenStore.set('a-valid-looking-token');
    vi.spyOn(api, 'me').mockResolvedValue({
      user: { id: 'u1', fullName: 'Kamala Devi', preferences: { language: 'en' } },
    });

    renderApp(routes, { route: '/dashboard' });

    expect(await screen.findByText('Your applications')).toBeInTheDocument();
  });

  it('drops a token the server no longer accepts', async () => {
    tokenStore.set('an-expired-token');
    vi.spyOn(api, 'me').mockRejectedValue(
      apiError(401, 'UNAUTHORIZED', 'Your session has expired. Please sign in again.'),
    );

    renderApp(routes, { route: '/dashboard' });

    expect(await screen.findByText('Please sign in')).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
  });
});

describe('dashboard', () => {
  it('invites a first application when there is nothing yet', async () => {
    vi.spyOn(api, 'listApplications').mockResolvedValue({ applications: [] });
    vi.spyOn(api, 'listAppointments').mockResolvedValue({ appointments: [] });

    renderApp(<DashboardPage />);

    expect(await screen.findByText(/have not started an application/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start an application/i })).toBeInTheDocument();
  });

  it('lists an application with its reference and what is still outstanding', async () => {
    vi.spyOn(api, 'listApplications').mockResolvedValue({
      applications: [
        {
          id: 'a1',
          reference: 'SP-QWER5678',
          service: { id: 'fresh', name: 'New passport', nameHi: 'नया पासपोर्ट' },
          status: 'draft',
          statusLabel: { en: 'Not submitted yet', hi: 'अभी जमा नहीं हुआ' },
          documentsReady: 2,
          documentsTotal: 4,
          fee: { payableInr: 1350 },
        },
      ],
    });
    vi.spyOn(api, 'listAppointments').mockResolvedValue({ appointments: [] });

    renderApp(<DashboardPage />);

    expect(await screen.findByText('SP-QWER5678')).toBeInTheDocument();
    expect(screen.getByText('2 of 4 documents ready')).toBeInTheDocument();
    expect(screen.getByText('₹1,350')).toBeInTheDocument();
    expect(screen.getByText('Not submitted yet')).toBeInTheDocument();
  });

  it('reports a failure rather than spinning forever', async () => {
    vi.spyOn(api, 'listApplications').mockRejectedValue(
      apiError(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.'),
    );
    vi.spyOn(api, 'listAppointments').mockResolvedValue({ appointments: [] });

    renderApp(<DashboardPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');
  });
});
