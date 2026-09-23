import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Alert } from '../components/Alert.jsx';
import { Checkbox, Field } from '../components/Field.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { api, ApiError } from '../lib/api.js';
import { rupees } from '../lib/format.js';

const EMPTY = {
  serviceId: '',
  scheme: 'normal',
  fullName: '',
  dateOfBirth: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
  needsWheelchair: false,
  needsInterpreter: false,
  helperName: '',
  helperPhone: '',
};

export function NewApplicationPage() {
  const { t, language } = useSettings();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [services, setServices] = useState([]);
  const [form, setForm] = useState({ ...EMPTY, serviceId: searchParams.get('service') ?? '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .services()
      .then((data) => {
        setServices(data.services);
        setForm((f) => ({ ...f, serviceId: f.serviceId || data.services[0].id }));
      })
      .catch((error) => setFormError(error.message));
  }, []);

  const set = (name) => (event) =>
    setForm((f) => ({
      ...f,
      [name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    }));

  const selected = services.find((service) => service.id === form.serviceId);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const { application } = await api.createApplication({
        serviceId: form.serviceId,
        scheme: form.scheme,
        applicant: {
          fullName: form.fullName,
          dateOfBirth: form.dateOfBirth,
          address: {
            line1: form.line1,
            ...(form.line2 ? { line2: form.line2 } : {}),
            city: form.city,
            state: form.state,
            pincode: form.pincode,
          },
        },
        assistance: {
          needsWheelchair: form.needsWheelchair,
          needsInterpreter: form.needsInterpreter,
          ...(form.helperName ? { helperName: form.helperName } : {}),
          ...(form.helperPhone ? { helperPhone: form.helperPhone } : {}),
        },
      });
      navigate(`/applications/${application.id}`, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        // Server paths are nested ("applicant.address.pincode"); the form is
        // flat, so key the messages by the last segment.
        const flattened = Object.entries(error.fieldErrors).reduce((acc, [path, message]) => {
          const key = path.split('.').pop();
          if (!(key in acc)) acc[key] = message;
          return acc;
        }, {});
        setErrors(flattened);
        setFormError(Object.keys(flattened).length ? t('common.fixErrors') : error.message);
      } else {
        setFormError(t('common.somethingWrong'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>{t('new.title')}</h1>
      {formError ? <Alert kind="error">{formError}</Alert> : null}

      <form onSubmit={onSubmit} noValidate className="card" style={{ maxWidth: '48rem' }}>
        <Field
          as="select"
          label={t('new.service')}
          name="serviceId"
          value={form.serviceId}
          onChange={set('serviceId')}
          error={errors.serviceId}
          required
        >
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {language === 'hi' ? service.nameHi : service.name} - {rupees(service.feeInr)}
            </option>
          ))}
        </Field>

        {selected?.tatkalFeeInr ? (
          <Field
            as="select"
            label={t('new.scheme')}
            name="scheme"
            value={form.scheme}
            onChange={set('scheme')}
            error={errors.scheme}
          >
            <option value="normal">
              {t('new.schemeNormal')} - {rupees(selected.feeInr)}
            </option>
            <option value="tatkal">
              {t('new.schemeTatkal')} - {rupees(selected.tatkalFeeInr)}
            </option>
          </Field>
        ) : null}

        <fieldset className="fieldset">
          <legend>{t('new.applicant')}</legend>
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
            label={t('auth.dob')}
            type="date"
            name="dateOfBirth"
            autoComplete="bday"
            max={new Date().toISOString().slice(0, 10)}
            value={form.dateOfBirth}
            onChange={set('dateOfBirth')}
            error={errors.dateOfBirth}
            required
          />
        </fieldset>

        <fieldset className="fieldset">
          <legend>{t('new.address')}</legend>
          <Field
            label={t('new.line1')}
            name="line1"
            autoComplete="address-line1"
            value={form.line1}
            onChange={set('line1')}
            error={errors.line1}
            required
          />
          <Field
            label={t('new.line2')}
            name="line2"
            autoComplete="address-line2"
            value={form.line2}
            onChange={set('line2')}
            error={errors.line2}
          />
          <div className="field-row">
            <Field
              label={t('new.city')}
              name="city"
              autoComplete="address-level2"
              value={form.city}
              onChange={set('city')}
              error={errors.city}
              required
            />
            <Field
              label={t('new.state')}
              name="state"
              autoComplete="address-level1"
              value={form.state}
              onChange={set('state')}
              error={errors.state}
              required
            />
          </div>
          <Field
            label={t('new.pincode')}
            name="pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            value={form.pincode}
            onChange={set('pincode')}
            error={errors.pincode}
            required
          />
        </fieldset>

        <fieldset className="fieldset">
          <legend>{t('new.assistance')}</legend>
          <p className="muted">{t('new.assistanceHelp')}</p>
          <Checkbox
            label={t('new.wheelchair')}
            name="needsWheelchair"
            checked={form.needsWheelchair}
            onChange={set('needsWheelchair')}
          />
          <Checkbox
            label={t('new.interpreter')}
            name="needsInterpreter"
            checked={form.needsInterpreter}
            onChange={set('needsInterpreter')}
          />
          <Field
            label={t('new.helperName')}
            name="helperName"
            value={form.helperName}
            onChange={set('helperName')}
            error={errors.helperName}
          />
          <Field
            label={`${t('new.helperPhone')} (${t('common.optional')})`}
            type="tel"
            name="helperPhone"
            inputMode="numeric"
            value={form.helperPhone}
            onChange={set('helperPhone')}
            error={errors.helperPhone}
          />
        </fieldset>

        <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
          {busy ? t('new.creating') : t('new.create')}
        </button>
      </form>
    </>
  );
}
