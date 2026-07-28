import { useEffect, useRef } from 'react';
import { Download, X } from 'lucide-react';
import { useAppUpdate } from '../hooks/useAppUpdate';
import './SideMenu.css';
import { FAQ } from './FAQ';
import logoCoroa from '../assets/Coroa2.png';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SideMenu({ isOpen, onClose }: SideMenuProps) {
  const { installedApp, update, installUpdate } = useAppUpdate();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')
      );
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  return (
    <div
      id="app-side-menu"
      className={`sidemenu-container ${isOpen ? 'open' : ''}`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        className="sidemenu-backdrop"
        onClick={onClose}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        className="sidemenu-content"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        tabIndex={-1}
      >

        <div className="sidemenu-header">
          <button
            ref={closeButtonRef}
            type="button"
            className="sidemenu-close"
            onClick={onClose}
            aria-label="Fechar menu"
            title="Fechar"
          >
            <X size={22} aria-hidden="true" />
          </button>
          <img src={logoCoroa} alt="Logo Meu Kingdom" className="sidemenu-logo" />
          {installedApp && (
            <div className="app-version-status">
              <span>Versão {installedApp.versionName}</span>
              {update && (
                <button type="button" onClick={() => void installUpdate()}>
                  <Download size={17} aria-hidden="true" />
                  Atualizar para {update.versionName}
                </button>
              )}
            </div>
          )}
        </div>
      
        <FAQ />
      </div>
    </div>
  );
}
