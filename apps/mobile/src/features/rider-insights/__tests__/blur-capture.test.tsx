// BlurCapture when its key changes (theme, font scale or teaser data) while a
// capture is in flight: the old capture never shows under the new key, and the
// new picture is captured without waiting for a layout that will not come.
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
const mockCaptureRef = jest.fn();
jest.mock('react-native-view-shot', () => ({
  captureRef: (...args: unknown[]) => mockCaptureRef(...args),
}));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return {
    Image: (props: { testID?: string; source: { uri: string }; blurRadius?: number }) => (
      <View
        testID={props.testID}
        accessibilityHint={props.source.uri}
        accessibilityValue={{ now: props.blurRadius }}
      />
    ),
  };
});

import { act, render, screen } from '@testing-library/react-native';
import { PixelRatio, Text } from 'react-native';
import { BlurCapture, clearBlurCaptures } from '../blur-capture';

const HIDDEN = { includeHiddenElements: true };

function deferred() {
  let resolve: (uri: string) => void = () => {};
  const promise = new Promise<string>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/** The source view's first layout; the capture it starts is not awaited here. */
async function laidOut() {
  const source = screen.getByTestId('blur-capture-source', HIDDEN);
  await act(async () => {
    void source.props.onLayout();
  });
}

function teaser(cacheKey: string) {
  return (
    <BlurCapture cacheKey={cacheKey} width={120} height={30} blurRadius={14}>
      <Text>48 km</Text>
    </BlurCapture>
  );
}

beforeEach(() => {
  clearBlurCaptures();
  mockCaptureRef.mockReset();
});

it('a capture that lands after the key changed is not shown for the new key, and the new key is captured', async () => {
  const light = deferred();
  const dark = deferred();
  mockCaptureRef.mockReturnValueOnce(light.promise).mockReturnValueOnce(dark.promise);

  const view = await render(teaser('summary|abc|light|1'));
  await laidOut();
  expect(mockCaptureRef).toHaveBeenCalledTimes(1);

  // The scheme flips while the light capture is still in flight.
  await view.rerender(teaser('summary|abc|dark|1'));
  expect(mockCaptureRef).toHaveBeenCalledTimes(2);

  await act(async () => {
    light.resolve('file:///light.png');
  });
  expect(screen.queryByTestId('blur-capture-image', HIDDEN)).toBeNull();
  expect(screen.getByTestId('blur-capture-placeholder', HIDDEN)).toBeTruthy();

  await act(async () => {
    dark.resolve('file:///dark.png');
  });
  expect(screen.getByTestId('blur-capture-image', HIDDEN).props.accessibilityHint).toBe(
    'file:///dark.png',
  );
});

it('going back to a key captured earlier shows its picture at once', async () => {
  mockCaptureRef
    .mockResolvedValueOnce('file:///light.png')
    .mockResolvedValueOnce('file:///dark.png');
  const view = await render(teaser('summary|abc|light|1'));
  await laidOut();
  expect(screen.getByTestId('blur-capture-image', HIDDEN).props.accessibilityHint).toBe(
    'file:///light.png',
  );

  await view.rerender(teaser('summary|abc|dark|1'));
  await laidOut();
  expect(screen.getByTestId('blur-capture-image', HIDDEN).props.accessibilityHint).toBe(
    'file:///dark.png',
  );

  await view.rerender(teaser('summary|abc|light|1'));
  expect(screen.getByTestId('blur-capture-image', HIDDEN).props.accessibilityHint).toBe(
    'file:///light.png',
  );
  expect(mockCaptureRef).toHaveBeenCalledTimes(2);
});

it('blurs in points: the capture is at device pixels, so the radius scales with the pixel ratio', async () => {
  jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
  mockCaptureRef.mockResolvedValueOnce('file:///teaser.png');
  await render(teaser('summary|ratio|light|1'));
  await laidOut();
  expect(screen.getByTestId('blur-capture-image', HIDDEN).props.accessibilityValue).toEqual({
    now: 42,
  });
});
