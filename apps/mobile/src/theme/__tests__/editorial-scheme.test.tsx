import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import {
  EDITORIAL_SCHEME,
  EditorialSchemeProvider,
  editorialThemes,
  useEditorialTheme,
} from '../editorial';

let mockScheme: string = EDITORIAL_SCHEME.LIGHT;
jest.mock('nativewind', () => ({ useColorScheme: () => ({ colorScheme: mockScheme }) }));

const pinnedDark = ({ children }: { children: ReactNode }) => (
  <EditorialSchemeProvider value={EDITORIAL_SCHEME.DARK}>{children}</EditorialSchemeProvider>
);

describe('useEditorialTheme', () => {
  it('follows the system scheme by default', async () => {
    const { result } = await renderHook(() => useEditorialTheme());
    expect(result.current.isDark).toBe(false);
    expect(result.current.t).toBe(editorialThemes.light);
  });

  it('a pinned scheme wins over a light system scheme', async () => {
    const { result } = await renderHook(() => useEditorialTheme(), { wrapper: pinnedDark });
    expect(result.current.isDark).toBe(true);
    expect(result.current.t).toBe(editorialThemes.dark);
  });

  it('a dark system scheme stays dark without a pin', async () => {
    mockScheme = EDITORIAL_SCHEME.DARK;
    const { result } = await renderHook(() => useEditorialTheme());
    expect(result.current.isDark).toBe(true);
  });
});
