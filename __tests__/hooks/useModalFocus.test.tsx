import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useModalFocus } from '@/hooks/useModalFocus';

function ModalHarness() {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useModalFocus<HTMLDivElement>(isOpen, () => setIsOpen(false));

  return (
    <>
      <button onClick={() => setIsOpen(true)}>打开</button>
      {isOpen && (
        <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}>
          <button>第一个</button>
          <button>最后一个</button>
        </div>
      )}
    </>
  );
}

describe('useModalFocus', () => {
  it('moves focus inside, traps Tab, closes on Escape, and restores focus', async () => {
    render(<ModalHarness />);
    const trigger = screen.getByRole('button', { name: '打开' });
    trigger.focus();
    fireEvent.click(trigger);

    const first = screen.getByRole('button', { name: '第一个' });
    const last = screen.getByRole('button', { name: '最后一个' });
    await waitFor(() => expect(first).toHaveFocus());

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
