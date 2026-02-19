import type { ReactNode } from 'react';

import { FooterCopyright } from './FooterCopyright';
import { FooterIconList } from './FooterIconList';

type ICenteredFooterProps = {
  logo: ReactNode;
  iconList: ReactNode;
  children: ReactNode;
};

const CenteredFooter = (props: ICenteredFooterProps) => (
  <div className="w-full min-w-0 max-w-full overflow-x-hidden overflow-x-clip text-center">
    {props.logo}

    <nav className="w-full min-w-0 max-w-full overflow-x-hidden overflow-x-clip" aria-label="Footer links">
      <ul className="footer-links mt-5 m-0 flex flex-wrap w-full min-w-0 max-w-full list-none flex-col items-stretch gap-y-2 overflow-x-hidden overflow-x-clip p-0 text-base font-medium text-gray-800 sm:flex-row sm:justify-center sm:gap-x-6 sm:text-xl">
        {props.children}
      </ul>
    </nav>

    <div className="mt-8 flex justify-center">
      <FooterIconList>{props.iconList}</FooterIconList>
    </div>

    <div className="mt-8 text-sm">
      <FooterCopyright />
    </div>

    <style jsx>
      {`
        .footer-links :global(li) {
          @apply min-w-0 max-w-full;
          overflow-wrap: anywhere;
        }

        .footer-links :global(a) {
          @apply block min-h-11 min-w-0 max-w-full rounded-md px-3 py-3 whitespace-normal break-words hover:bg-primary-100;
          overflow-wrap: anywhere;
        }
      `}
    </style>
  </div>
);

export { CenteredFooter };
