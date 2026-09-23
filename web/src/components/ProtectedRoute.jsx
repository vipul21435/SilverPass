import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';

/** Sends signed-out visitors to sign in, remembering where they were headed. */
export function ProtectedRoute({ children }) {
  const { isSignedIn, isLoading } = useAuth();
  const { t } = useSettings();
  const location = useLocation();

  if (isLoading) {
    return (
      <p role="status" aria-live="polite">
        {t('common.loading')}
      </p>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" state={{ from: location.pathname }} replace />;
  }

  return children;
}
