import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Alert } from '../components/Alert.jsx';
import { Field } from '../components/Field.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { ApiError } from '../lib/api.js';

const EMPTY = { fullName: '', email: '', phone: '', password: '', dateOfBirth: '' };

export function RegisterPage() {
  const { t, language } = useSettings();
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
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
      await register({ ...form, preferredLanguage: language });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setFormError(Object.keys(error.fieldErrors).length ? t('common.fixErrors') : error.message);
      } else {
        setFormError(t('common.somethingWrong'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: '42rem' }}>
      <h1>{t('auth.register')}</h1>

      {formError ? <Alert kind="error">{formError}</Alert> : null}

      <form onSubmit={onSubmit} noValidate>
        <Field
          label={t('auth.fullName')}
          name="fullName"
          autoComplete="name"
          value={form.fullName}
          onChange={set('fullName')}
          error={errors.fullName}
          required
        />
        <Field
          label={t('auth.email')}
          hint={t('auth.emailHint')}
          type="email"
          name="email"
          autoComplete="email"
          value={form.email}
          onChange={set('email')}
          error={errors.email}
          required
        />
        <Field
          label={t('auth.phone')}
          hint={t('auth.phoneHint')}
          type="tel"
          name="phone"
          inputMode="numeric"
          autoComplete="tel"
          value={form.phone}
          onChange={set('phone')}
          error={errors.phone}
          required
        />
        <Field
          label={t('auth.dob')}
          hint={t('auth.dobHint')}
          type="date"
          name="dateOfBirth"
          autoComplete="bday"
          max={new Date().toISOString().slice(0, 10)}
          value={form.dateOfBirth}
          onChange={set('dateOfBirth')}
          error={errors.dateOfBirth}
          required
        />
        <Field
          label={t('auth.password')}
          hint={t('auth.passwordHint')}
          type="password"
          name="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          required
        />
        <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
          {busy ? t('auth.creating') : t('auth.register')}
        </button>
      </form>

      <p style={{ marginTop: '1.5rem' }}>
        {t('auth.haveAccount')} <Link to="/sign-in">{t('nav.signIn')}</Link>
      </p>
    </div>
  );
}
