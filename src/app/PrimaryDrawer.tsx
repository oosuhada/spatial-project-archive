import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from './useFocusTrap';

type Props = {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
};

export function PrimaryDrawer({ title, eyebrow, children, onClose, wide = false }: Props) {
  const ref = useRef<HTMLElement>(null);
  useFocusTrap(ref, true, onClose);

  return (
    <aside ref={ref} className={`primary-drawer ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="drawer-head">
        <div>
          {eyebrow ? <span>{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label={`Close ${title}`}>
          <X size={18} />
        </button>
      </div>
      <div className="drawer-body">{children}</div>
    </aside>
  );
}

