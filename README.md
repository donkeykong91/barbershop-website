# Kevin's Barbershop Website

Production website for Kevin's Barbershop, built with Next.js + TypeScript + Tailwind CSS.

This repository started from a landing-page template and has been adapted for booking flows, admin integration, security hardening, and deployment workflows.

## Requirements

- Node.js and npm
- Turso database (libSQL URL + auth token)

## Kevin Barbershop backend setup

1. Copy env template and fill values:

```bash
cp .env.example .env.local
```

2. Run schema + seed against Turso:

```bash
npm run db:setup
```

3. For production deployment on Vercel, add:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `ADMIN_API_KEY`

See `docs/turso-migration.md` for full Turso provisioning, Vercel env commands, and rollback steps.

## Getting started

Run the following commands locally:

```
git clone git@github.com:donkeykong91/barbershop-website.git
cd barbershop-website
npm install
```

Then, you can run locally in development mode with live reload (for example, in [Warp](https://go.warp.dev/nextjs-bp)):

```
npm run dev
```

Open http://localhost:3000 with your favorite browser to see your project. For your information, Next JS need to take some time to compile the project for your first time.

```
.
├── README.md            # README file
├── next.config.js       # Next JS configuration
├── public               # Public folder
│   └── assets
│       └── images       # Image used by default template
├── src
│   ├── components
│   │   ├── templates    # Page-level composition/templates
│   │   └── ui           # Reusable UI components
│   ├── features         # Domain/business features
│   ├── lib              # Shared libraries/integration code
│   ├── pages            # Next.js pages and API routes
│   ├── styles           # Tailwind/PostCSS styling
│   └── utils            # Shared utility helpers
├── tailwind.config.js   # Tailwind CSS configuration
└── tsconfig.json        # TypeScript configuration
```

## VSCode information (optional)

If you are VSCode users, you can have a better integration with VSCode by installing the suggested extension in `.vscode/extension.json`. The starter code comes up with Settings for a seamless integration with VSCode. The Debug configuration is also provided for frontend and backend debugging experience.

Pro tips: if you need a project wide type checking with TypeScript, you can run a build with <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd> on Mac.

## Contributions

Everyone is welcome to contribute to this project. Feel free to open an issue if you have question or found a bug.

## License

Licensed under the MIT License, Copyright © 2026

See [LICENSE](LICENSE) for more information.


