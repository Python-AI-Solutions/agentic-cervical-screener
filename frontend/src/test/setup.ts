/**
 * Test setup file for Vitest
 * Configures global test environment and suppresses console noise
 */

import { vi } from 'vitest';

// Mock window.__ENV__ if not already set
if (typeof window !== 'undefined' && !(window as any).__ENV__) {
  (window as any).__ENV__ = { API_BASE: '' };
}

// Suppress console warnings/errors in tests unless explicitly needed
// Keep console.log for debugging but suppress noisy warnings
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

// Track if we're in a test that needs real console output
let suppressConsole = true;

// Suppress warnings that are expected in test environment
console.warn = (...args: any[]) => {
  const message = args.join(' ');
  // Suppress expected warnings in test environment
  if (
    suppressConsole &&
    (
      message.includes('fitOverlayToImage skipped') ||
      message.includes('renderOverlays skipped') ||
      message.includes('container has zero size') ||
      message.includes('fixedCanvasPixelSize not set') ||
      message.includes('recalculateTransform: container has zero size') ||
      message.includes('recalculateTransform: image dimensions not set') ||
      message.includes('recalculateTransform: glCanvas not available') ||
      message.includes('Failed to detect browser zoom')
    )
  ) {
    return; // Suppress these expected warnings
  }
  originalConsoleWarn(...args);
};

console.error = (...args: any[]) => {
  const message = args.join(' ');
  // Suppress expected errors in test environment
  if (
    suppressConsole &&
    (
      message.includes('Failed to load image') && message.includes('invalid.png')
    )
  ) {
    return; // Suppress expected test errors
  }
  originalConsoleError(...args);
};

// Suppress debug console.log statements in tests
console.log = (...args: any[]) => {
  const message = args.join(' ');
  // Suppress debug logs that are just informational
  if (
    suppressConsole &&
    (
      message.includes('Transform recalculated:') ||
      message.includes('Zoom updated:') ||
      message.includes('renderOverlays called:') ||
      message.includes('Image canvas rendered') ||
      message.includes('Canvas size updated:') ||
      message.includes('Canvas size and transform FROZEN') ||
      message.includes('Canvas size and transform initialized') ||
      message.includes('Image redraw complete:') ||
      message.includes('All layers processed')
    )
  ) {
    return; // Suppress debug logs
  }
  originalConsoleLog(...args);
};

// Export function to enable/disable console suppression
export function setConsoleSuppression(enabled: boolean) {
  suppressConsole = enabled;
}

// Restore original console methods after tests
if (typeof afterAll !== 'undefined') {
  afterAll(() => {
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });
}


