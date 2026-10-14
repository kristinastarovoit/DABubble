# DABubble

DABubble is a team chat application (Slack clone) built with Angular and Firebase. Users can sign up or log in (email/password, Google, or as a guest), chat in channels and direct messages, reply in threads, react to messages, and search. It is a group project by Mathias Mayer, Kristina Starovoit, and Anne Manthey.

## Quickstart

### Prerequisites

- Node.js and npm (`npm@11.12.1` is pinned in `package.json`)
- A Firebase project with Authentication, Firestore, and Realtime Database enabled

### Setup

```bash
npm install
```

Create `src/environments/environment.ts` and `src/environments/environment.development.ts` (both are git-ignored) from the template in `src/environments/environments.template.ts`, and fill in your Firebase config:

```ts
export const environment = {
  production: false,
  firebase: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT_ID.firebasestorage.app',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID',
    measurementId: 'YOUR_MEASUREMENT_ID',
    databaseURL: 'YOUR_DATABASE_URL',
  },
};
```

## Usage

| Command | Description |
| --- | --- |
| `npm start` | Start the dev server and open `http://localhost:4200/` |
| `npm run build` | Production build into `dist/` |
| `npm run watch` | Rebuild on changes (development configuration) |

### Routes

- `/login`, `/signup`, `/password-recovery`, `/password-reset`: authentication
- `/legal-notice`, `/privacy-policy`: legal notice and privacy policy
- `/dashboard`: main workspace
- `/channels/:channelId`, `/dms/:dmId`: channel and direct message chats

## Notes

- The production build currently fails on the configured size budgets in `angular.json` (initial bundle and several component stylesheets). Use `npm run ng -- build --configuration development` to build without budget errors.
- The legal notice and privacy policy pages are linked from the landing-page footer.

## Tests

```bash
npm test
```

Unit tests run with [Vitest](https://vitest.dev/) through the Angular CLI.

## Authors

- Mathias Mayer
- Kristina Starovoit
- Anne Manthey
