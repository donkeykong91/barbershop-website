import Link from 'next/link';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

type INavbarProps = {
  logo: ReactNode;
  children: ReactNode;
};

const NavbarTwoColumns = (props: INavbarProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !panelRef.current) {
      return;
    }

    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])',
    );
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable.item(focusable.length - 1);

    if (!first || !last) {
      return;
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <Link href="/">{props.logo}</Link>
      </div>

      <button
        type="button"
        className="rounded-md border border-gray-400 px-3 py-2 text-sm font-medium text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 md:hidden"
        aria-expanded={mobileOpen}
        aria-controls="primary-mobile-nav"
        onClick={() => setMobileOpen((prev) => !prev)}
      >
        {mobileOpen ? 'Close menu' : 'Menu'}
      </button>

      <nav className="hidden md:block" aria-label="Primary">
        <ul className="navbar flex items-center text-xl font-medium text-gray-800">
          {props.children}
        </ul>
      </nav>

      {mobileOpen ? (
        <div
          id="primary-mobile-nav"
          className="fixed inset-0 z-50 bg-black/45 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="ml-auto flex size-full max-w-sm flex-col bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={onPanelKeyDown}
          >
            <button
              type="button"
              className="mb-4 self-end rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              onClick={() => setMobileOpen(false)}
            >
              Close
            </button>
            <nav aria-label="Primary mobile">
              <ul
                className="mobile-navbar flex flex-col gap-2 text-lg font-semibold text-gray-800"
                onClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest('a')) {
                    setMobileOpen(false);
                  }
                }}
              >
                {props.children}
              </ul>
            </nav>
          </div>
        </div>
      ) : null}

      <style jsx>
        {`
          .navbar :global(li:not(:first-child)) {
            @apply mt-0;
          }

          .navbar :global(li:not(:last-child)) {
            @apply mr-5;
          }

          .mobile-navbar :global(li a) {
            @apply block rounded-md px-3 py-3;
            min-height: 44px;
          }
        `}
      </style>
    </div>
  );
};

export { NavbarTwoColumns };
