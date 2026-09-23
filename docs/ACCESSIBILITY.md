# Accessibility notes

The target user is 70 or older, possibly using a government service online for
the first time, possibly with reduced vision, tremor, or no English. This file
records what was built for them and how to check it still works.

## Reading

**Base size is 20px (1.25rem), not 16px.** Every length downstream is in `rem`,
so the whole page scales from one custom property.

**A / A+ / A++ controls sit in a bar above the header** - the first thing after
the skip link, never behind a menu. They set `data-text-size` on `<html>`;
`:root` and the two override blocks in
[`global.css`](../web/src/styles/global.css) redefine the type scale. Largest is
1.8rem base, roughly 29px.

**Applicants aged 60 or over get large text switched on at registration.**
Someone who needs bigger type should not first have to read small type to find
the setting. It is computed server-side in `userService.register` from the date
of birth and returned with the account, and the client adopts it on sign-in.

**Line length is capped at 62 characters** on paragraphs. Long lines are hard to
track back from, and that gets harder with age.

## Contrast

A high-contrast mode sets `data-contrast="high"` on `<html>`: pure black on pure
white, every tinted background flattened, borders heavier, focus rings widened
from 4px to 5px, and shadows removed. The default palette already meets WCAG AA;
this mode is for people who need considerably more than AA.

## Targets and focus

Interactive elements are at least 48px on their smallest side (`--touch-target`),
which satisfies WCAG 2.2 target size and is realistic for an unsteady hand. Below
40rem viewport width, buttons go full width.

The focus ring is a 4px solid orange outline with a 3px offset, on every
focusable element, chosen to stand out against both the blue brand colour and
white. It is never removed.

## Screen readers and structure

- A skip link, first in the DOM, pointing at `<main id="main" tabindex="-1">`.
- Landmarks: `banner`, `navigation`, `main`, `contentinfo`.
- Each accessibility control group is a `role="group"` with an `aria-label`, so
  the three unlabelled "A" buttons are announced as text-size options.
- Toggle buttons carry `aria-pressed`, not a visual-only active state.
- `Field` generates its own ids and wires the hint and the error to the input
  with `aria-describedby`, and sets `aria-invalid` when there is an error. Two
  fields on one page can never collide, because the ids come from `useId`.
- Errors render as `role="alert"` with `aria-live="assertive"`; success and
  status messages use `role="status"` with `aria-live="polite"`.
- Loading states are announced, not just spun.
- `<html lang>` follows the language toggle, so a screen reader switches voice.

## Language

Full English and Hindi, switchable at any point without losing your place. All
135 strings exist in both - [`strings.test.js`](../web/src/test/strings.test.js)
fails the build if a key is missing from either, if one defines a key the other
does not, if a placeholder differs between them, or if any string is empty.

Service names, centre names, and status labels are translated server-side and
returned in both languages, so the API is not English-only.

## Words

Statuses are written as sentences, never as enum values: "Your passport is being
printed", not `PRINTING`. Validation messages name the field and say what to do:
"Please fill in your city or town", not "String must contain at least 1
character(s)". Scheme names are explained rather than assumed - "Fast-track -
quicker, but costs more" rather than "Tatkal".

## Beyond the screen

**Senior-priority slots.** The first two hours of every day at every centre
(09:30-11:00) are bookable only by applicants aged 60 or over. Queueing is the
single biggest barrier this application exists to remove, so the quietest slots
are allocated by need rather than to whoever books fastest.

**Access information before you commit.** Step-free access and wheelchair
availability are shown on the centre picker, not discovered on arrival.

**Assistance needs travel with the application.** Wheelchair and interpreter
needs, and the name and number of whoever is coming along, are collected when
the application is made and attached to the appointment, so the centre knows
in advance.

**Reference numbers avoid `0`, `O`, `1`, and `I`** - they get read aloud over the
phone, and misread otherwise.

**Tracking needs no account**, because an adult child checking on a parent's
application usually does not have the password.

## Reduced motion

`prefers-reduced-motion: reduce` collapses every animation and transition to
0.01ms. There is little motion to begin with; this makes sure nothing slips in.

## What is covered by tests

[`accessibility.test.jsx`](../web/src/test/accessibility.test.jsx) asserts the
text-size and contrast controls actually change `<html>`, that choices survive a
reload, that the language toggle changes both the copy and `<html lang>`, that
control groups have accessible names, that `Field` wires up labels, descriptions
and `aria-invalid` correctly and generates unique ids, and that the skip link
points at a real `main` landmark.

## What is not covered

Automated tests catch structure, not experience. The following still need a
person:

- A real screen-reader pass (VoiceOver, NVDA) through registration and booking.
- Keyboard-only navigation end to end, watching focus order across route changes.
- Testing with actual older users, which would likely change more than anything
  written above.
- Colour-contrast auditing of the high-contrast mode with a measuring tool.
- Zoom to 400% per WCAG 1.4.10, checking nothing is lost or clipped.
