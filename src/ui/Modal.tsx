// Своя модалка вместо confirm(): затемнение, карточка, кнопки. Только для родительского экрана.
import type { ReactNode } from 'react';
import './modal.css';

export interface ModalProps {
  readonly children: ReactNode;
  /** Кнопки внизу карточки. */
  readonly actions: ReactNode;
  readonly onClose: () => void;
}

export function Modal({ children, actions, onClose }: ModalProps) {
  return (
    <div className="modal-backdrop" onPointerDown={event => event.target === event.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
}
