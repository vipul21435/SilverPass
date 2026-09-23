import { useSettings } from '../context/SettingsContext.jsx';
import { LANGUAGES } from '../context/strings.js';

const TEXT_SIZES = [
  { value: 'normal', labelKey: 'a11y.textNormal', glyph: 'A', className: 'a11y-option--sm' },
  { value: 'large', labelKey: 'a11y.textLarge', glyph: 'A', className: 'a11y-option--md' },
  { value: 'largest', labelKey: 'a11y.textLargest', glyph: 'A', className: 'a11y-option--lg' },
];

/**
 * Always the first thing after the skip link. Someone who cannot read the page
 * needs these controls before they need anything else, so they are never
 * hidden behind a menu or a settings page.
 */
export function AccessibilityBar() {
  const { textSize, contrast, language, update, t } = useSettings();

  return (
    <div className="a11y-bar">
      <div className="shell">
        <div className="a11y-group" role="group" aria-label={t('a11y.textSize')}>
          <span aria-hidden="true">{t('a11y.textSize')}</span>
          {TEXT_SIZES.map((size) => (
            <button
              key={size.value}
              type="button"
              className={`a11y-option ${size.className}`}
              aria-pressed={textSize === size.value}
              onClick={() => update({ textSize: size.value })}
            >
              <span aria-hidden="true">{size.glyph}</span>
              <span className="visually-hidden">{t(size.labelKey)}</span>
            </button>
          ))}
        </div>

        <div className="a11y-group" role="group" aria-label={t('a11y.contrast')}>
          <span aria-hidden="true">{t('a11y.contrast')}</span>
          <button
            type="button"
            className="a11y-option"
            aria-pressed={contrast === 'high'}
            onClick={() => update({ contrast: contrast === 'high' ? 'normal' : 'high' })}
          >
            {t(contrast === 'high' ? 'a11y.contrastHigh' : 'a11y.contrastNormal')}
          </button>
        </div>

        <div className="a11y-group" role="group" aria-label={t('a11y.language')}>
          <span aria-hidden="true">{t('a11y.language')}</span>
          {LANGUAGES.map((option) => (
            <button
              key={option.code}
              type="button"
              lang={option.code}
              className="a11y-option"
              aria-pressed={language === option.code}
              onClick={() => update({ language: option.code })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
