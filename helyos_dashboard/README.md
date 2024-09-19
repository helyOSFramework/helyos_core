# HelyOS Admin Dashboard

An Angular-based admin dashboard for the HelyOS core, built with [Angular 17](https://v17.angular.io/docs/), [Bootstrap 5](https://getbootstrap.com/docs/5.0/), and [NG Bootstrap 16](https://ng-bootstrap.github.io/releases/16.x/#/home).

This project is originally derived from the [SB Admin rewritten in Angular 17 and Bootstrap 5](https://github.com/start-angular/SB-Admin-BS4-Angular-8) (Commit: [b812a1bb1692050e299e904973e578090bc50393](https://github.com/start-angular/SB-Admin-BS4-Angular-8/tree/b812a1bb1692050e299e904973e578090bc50393)).

## Getting Started

### Prerequisites

Make sure you have the following versions installed:

| Technology | Version |
| ---------- | ------- |
| Node.js    | 18.18.2 |
| npm        | 9.8.1   |

- Ensure that Node.js and npm versions are compatible with Angular 17. Refer to [Angular Version Compatibility](https://angular.dev/reference/versions) for details.
- [Download Node.js](https://nodejs.org/download/release/) if needed.
- Follow the [Node.js and npm installation guide](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) for setup instructions.

### Installation

1. Clone this repository or download and unzip the project archive.
2. Open a terminal and navigate to the project’s root directory (`helyos_dashboard`).
3. Install the required dependencies by running:
   ```bash
   npm install
   ```

### Development

#### Start Development Server

To run the development server, execute:

```bash
npm run start
```

The server will start on a local port, and the app will be accessible via your browser.

#### Linting

##### Check for Linting Issues

This project uses:

- **[ESLint](https://eslint.org/)** for HTML and TypeScript linting (`.eslintrc.json`).
- **[Stylelint](https://stylelint.io/)** for CSS, SCSS linting (`.stylelintrc.json`).
- **[Prettier](https://prettier.io/)** for CSS, SCSS linting (`.prettierrc.json`).

To check for linting issues across JavaScript/TypeScript, CSS/SCSS and HTML files, run the following command:

```bash
npm run lint
```

##### Auto-Fix Issues

To auto-fix linting issues, run:

```bash
npm run lint:fix
```

#### Running Tests

Execute the following command to run the test cases:

```bash
npm run test
```

### Building the Project

- For a development build:
  ```bash
  npm run build:dev
  ```
- For a production build:
  ```bash
  npm run build
  ```

---
