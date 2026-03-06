import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { supabase } from '../../../lib/supabase';
import LoginScreen from '../login';

jest.spyOn(Alert, 'alert');

const mockSignIn = supabase.auth.signInWithPassword as jest.Mock;

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title, subtitle, and inputs', () => {
    render(<LoginScreen />);

    expect(screen.getByText('MotoLearn')).toBeTruthy();
    expect(screen.getByText('Learn Your Bike. Fix Your Bike.')).toBeTruthy();
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Password')).toBeTruthy();
    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  it('renders sign-up link', () => {
    render(<LoginScreen />);

    expect(screen.getByText("Don't have an account? Sign Up")).toBeTruthy();
  });

  it('calls signInWithPassword on submit', async () => {
    mockSignIn.mockResolvedValueOnce({ data: {}, error: null });

    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'rider@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret123');
    fireEvent.press(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'rider@test.com',
        password: 'secret123',
      });
    });
  });

  it('shows alert on login error', async () => {
    mockSignIn.mockResolvedValueOnce({
      data: {},
      error: { message: 'Invalid credentials' },
    });

    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'bad@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'wrong');
    fireEvent.press(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Invalid credentials');
    });
  });

  it('shows loading text while signing in', async () => {
    // Never resolve so we can observe the loading state
    mockSignIn.mockReturnValueOnce(new Promise(() => {}));

    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'rider@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret123');
    fireEvent.press(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeTruthy();
    });
  });
});
