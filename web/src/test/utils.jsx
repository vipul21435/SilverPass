import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AuthProvider } from '../context/AuthContext.jsx';
import { SettingsProvider } from '../context/SettingsContext.jsx';

/** Renders a component inside the same providers the real app uses. */
export function renderApp(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter
      initialEntries={[route]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <SettingsProvider>
        <AuthProvider>{ui}</AuthProvider>
      </SettingsProvider>
    </MemoryRouter>,
  );
}

/** Renders without AuthProvider, for components that do not need a session. */
export function renderWithSettings(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter
      initialEntries={[route]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <SettingsProvider>{ui}</SettingsProvider>
    </MemoryRouter>,
  );
}
