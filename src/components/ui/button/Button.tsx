import className from 'classnames';

type IButtonProps = {
  xl?: boolean;
  children: string;
};

const Button = (props: IButtonProps) => {
  const btnClass = className({
    btn: true,
    'btn-xl': props.xl,
    'btn-base': !props.xl,
    'btn-primary': true,
  });

  return (
    <span className={btnClass}>
      {props.children}

      <style jsx>
        {`
          .btn {
            @apply inline-flex min-h-11 items-center justify-center rounded-md text-center transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 active:scale-[0.99];
          }

          .btn-base {
            @apply px-4 py-2.5 text-lg font-semibold;
          }

          .btn-xl {
            @apply px-6 py-4 text-xl font-extrabold;
          }

          .btn-primary {
            @apply bg-primary-500 text-white;
          }

          .btn-primary:hover {
            @apply bg-primary-600;
          }
        `}
      </style>
    </span>
  );
};

export { Button };
