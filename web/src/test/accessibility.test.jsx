import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AccessibilityBar } from '../components/AccessibilityBar.jsx';
import { Field } from '../components/Field.jsx';
import { Layout } from '../components/Layout.jsx';
import { renderApp, renderWithSettings } from './utils.jsx';

describe('accessibility bar', () => {
  it('starts at the normal size and contrast', () => {
    renderWithSettings(<AccessibilityBar />);
    expect(document.documentElement).toHaveAttribute('data-text-size', 'normal');
    expect(document.documentElement).toHaveAttribute('data-contrast', 'normal');
  });

  it('scales the page when a bigger text size is chosen', async () => {
    const user = userEvent.setup();
    renderWithSettings(<AccessibilityBar />);

    await user.click(screen.getByRole('button', { name: /largest text size/i }));

    expect(document.documentElement).toHaveAttribute('data-text-size', 'largest');
    expect(screen.getByRole('button', { name: /largest text size/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /normal text size/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('turns high contrast on and off again', async () => {
    const user = userEvent.setup();
    renderWithSettings(<AccessibilityBar />);

    await user.click(screen.getByRole('button', { name: /normal contrast/i }));
    expect(document.documentElement).toHaveAttribute('data-contrast', 'high');

    await user.click(screen.getByRole('button', { name: /high contrast/i }));
    expect(document.documentElement).toHaveAttribute('data-contrast', 'normal');
  });

  it('switches the whole interface to Hindi and marks the document language', async () => {
    const user = userEvent.setup();
    renderWithSettings(<AccessibilityBar />);

    await user.click(screen.getByRole('button', { name: 'हिन्दी' }));

    expect(document.documentElement).toHaveAttribute('lang', 'hi');
    expect(screen.getByText('अक्षर का आकार')).toBeInTheDocument();
  });

  it('remembers the choices across a reload', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithSettings(<AccessibilityBar />);

    await user.click(screen.getByRole('button', { name: /large text size/i }));
    unmount();

    renderWithSettings(<AccessibilityBar />);
    expect(document.documentElement).toHaveAttribute('data-text-size', 'large');
  });

  it('groups each control with a name a screen reader can announce', () => {
    renderWithSettings(<AccessibilityBar />);
    expect(screen.getByRole('group', { name: /text size/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /contrast/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /language/i })).toBeInTheDocument();
  });
});

describe('Field', () => {
  it('links its label to its input', () => {
    renderWithSettings(<Field label="Mobile number" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Mobile number')).toBeInTheDocument();
  });

  it('announces the hint through aria-describedby', () => {
    renderWithSettings(
      <Field label="Mobile number" hint="10 digits" value="" onChange={() => {}} />,
    );
    expect(screen.getByLabelText('Mobile number')).toHaveAccessibleDescription('10 digits');
  });

  it('marks the input invalid and describes the problem', () => {
    renderWithSettings(
      <Field
        label="Mobile number"
        hint="10 digits"
        error="Enter a 10-digit number."
        value=""
        onChange={() => {}}
      />,
    );

    const input = screen.getByLabelText('Mobile number');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('10 digits Enter a 10-digit number.');
  });

  it('leaves aria-invalid off when there is no error', () => {
    renderWithSettings(<Field label="Mobile number" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Mobile number')).not.toHaveAttribute('aria-invalid');
  });

  it('gives each instance its own ids so two fields never collide', () => {
    renderWithSettings(
      <>
        <Field label="First" value="" onChange={() => {}} />
        <Field label="Second" value="" onChange={() => {}} />
      </>,
    );
    expect(screen.getByLabelText('First').id).not.toBe(screen.getByLabelText('Second').id);
  });
});

describe('page shell', () => {
  it('offers a skip link that points at the main landmark', () => {
    renderApp(
      <Layout>
        <p>Content</p>
      </Layout>,
    );

    const skip = screen.getByRole('link', { name: /skip to the main content/i });
    expect(skip).toHaveAttribute('href', '#main');
    expect(document.querySelector('main')).toHaveAttribute('id', 'main');
  });

  it('exposes the standard landmarks', () => {
    renderApp(
      <Layout>
        <p>Content</p>
      </Layout>,
    );

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('shows sign-in links when signed out and no sign-out button', () => {
    renderApp(
      <Layout>
        <p>Content</p>
      </Layout>,
    );

    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /my applications/i })).not.toBeInTheDocument();
  });
});
