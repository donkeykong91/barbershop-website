import type { ReactNode } from 'react';

import { FooterCopyright } from './FooterCopyright';
import { FooterIconList } from './FooterIconList';

type ICenteredFooterProps = {
  logo: ReactNode;
  iconList: ReactNode;
  children: ReactNode;
};

const CenteredFooter = (props: ICenteredFooterProps) => (
  <div className="w-full min-w-0 max-w-full overflow-x-hidden text-center">
    {props.logo}

    <nav
      className="w-full min-w-0 max-w-full overflow-x-hidden"
      aria-label="Footer links"
    >
      <ul className="footer-links m-0 mt-5 flex w-full min-w-0 max-w-full list-none flex-col flex-wrap items-stretch gap-y-2 overflow-x-hidden p-0 text-base font-medium text-gray-800 sm:flex-row sm:justify-center sm:gap-x-6 sm:text-xl">
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
