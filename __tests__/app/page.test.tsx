import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import HomePage from '@/app/page';
import { useAuthStore } from '@/stores/authStore';
import { getCreditBalance } from '@/services/CreditService';

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/hooks/useScrollAnimation', () => ({
  useScrollAnimation: () => ({
    ref: jest.fn(),
    isVisible: true,
  }),
}));

jest.mock('@/components/ColorBends', () => function MockColorBends() {
  return React.createElement('div', { 'data-testid': 'color-bends' });
});

jest.mock('@/components/Galaxy', () => function MockGalaxy() {
  return React.createElement('div', { 'data-testid': 'galaxy' });
});

jest.mock('@/services/CreditService', () => ({
  getCreditBalance: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
  },
}));

const mockUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockGetCreditBalance = getCreditBalance as unknown as jest.Mock;

describe('home page user menu', () => {
  const userUuid = 'd3437b2e-7967-48bf-bc13-1a7dbfc1f45a';
  let writeText: jest.Mock;

  beforeEach(() => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    mockGetCreditBalance.mockReturnValue(new Promise(() => {}));
    writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: jest.fn(),
    });

    mockUseAuthStore.mockReturnValue({
      user: {
        id: userUuid,
        email: 'user@example.com',
      },
      isAuthenticated: true,
      isLoading: false,
      signOut: jest.fn(),
      checkAuth: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const openUserMenu = () => {
    render(React.createElement(HomePage));

    const avatarButton = screen.getByText('U').closest('button');
    expect(avatarButton).not.toBeNull();

    fireEvent.click(avatarButton as HTMLButtonElement);
  };

  it('hides the user uuid behind a copy button above the validity row', async () => {
    openUserMenu();

    const idLabel = screen.getByText('ID');
    const validityLabel = screen.getByText('有效期');
    const copyButton = screen.getByRole('button', { name: '复制' });

    expect(screen.queryByText(userUuid)).not.toBeInTheDocument();
    expect(idLabel.compareDocumentPosition(validityLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(copyButton);

    expect(writeText).toHaveBeenCalledWith(userUuid);
    expect(await screen.findByText('已复制')).toBeInTheDocument();
  });

  it('shows a failure hint instead of throwing when clipboard permission is denied', async () => {
    writeText.mockRejectedValueOnce(new DOMException('Write permission denied.', 'NotAllowedError'));
    jest.mocked(document.execCommand).mockReturnValueOnce(false);

    openUserMenu();

    fireEvent.click(screen.getByRole('button', { name: '复制' }));

    expect(await screen.findByText('复制失败')).toBeInTheDocument();
  });

  it('links the chapter learn more action to the authenticated canvas route', () => {
    render(React.createElement(HomePage));

    const learnMoreLink = screen.getByRole('link', { name: /了解更多/i });

    expect(learnMoreLink).toHaveAttribute('href', '/canvas');
  });
});
