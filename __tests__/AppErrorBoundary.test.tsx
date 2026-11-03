import React from 'react';
import renderer, { act } from 'react-test-renderer';
import AppErrorBoundary from '../src/components/AppErrorBoundary';

describe('AppErrorBoundary', () => {
  it('renders a friendly recovery fallback when a child throws', () => {
    const ThrowingComponent = () => {
      throw new Error('Boom');
    };

    let testRenderer: renderer.ReactTestRenderer | undefined;

    act(() => {
      testRenderer = renderer.create(
        <AppErrorBoundary>
          <ThrowingComponent />
        </AppErrorBoundary>,
      );
    });

    const fallback = testRenderer?.root.findByProps({ testID: 'app-error-boundary-fallback' });
    const retryButton = testRenderer?.root.findByProps({ testID: 'app-error-boundary-retry' });

    expect(fallback).toBeTruthy();
    expect(retryButton).toBeTruthy();
  });
});
