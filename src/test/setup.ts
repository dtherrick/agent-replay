import '@testing-library/jest-dom/vitest';

if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = () => {};
}
if (typeof window !== 'undefined') {
  window.scrollTo = () => {};
}
