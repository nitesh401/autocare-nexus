import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App, NAV } from '../src/app/App';
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
describe('shell', () => {
  it('renders all 14 navigation destinations and the overview', () => {
    const { container } = render(<App />);
    expect(NAV).toHaveLength(14);
    expect(container.querySelectorAll('nav[aria-label="Main"] a')).toHaveLength(14);
    expect(screen.getAllByText(/Overview/).length).toBeGreaterThan(0);
  });
});
