import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Alert } from '../components/Alert.jsx';
import { Field } from '../components/Field.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { ApiError } from '../lib/api.js';

export function SignInPage() {
  const { t } = useSettings();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (name) => (event) => setForm((f) => ({ ...f, [name]: event.target.value }));

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      await signIn(form);
      navigate(location.state?.from ?? '/dashboard', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError(t('common.somethingWrong'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: '38rem' }}>
      <h1>{t('auth.signIn')}</h1>

      {formError ? <Alert kind="error">{formError}</Alert> : null}

      <form onSubmit={onSubmit} noValidate>
        <Field
          label={t('auth.email')}
          type="email"
          name="email"
          autoComplete="email"
          value={form.email}
          onChange={set('email')}
          error={errors.email}
          required
        />
        <Field
          label={t('auth.password')}
          type="password"
          name="password"
          autoComplete="current-password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          required
        />
        <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
          {busy ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>

      <p style={{ marginTop: '1.5rem' }}>
        {t('auth.noAccount')} <Link to="/register">{t('nav.register')}</Link>
      </p>
    </div>
  );
}
