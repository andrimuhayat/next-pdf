# 📄 Next.js PDF Generator with TypeScript

This project is a **PDF generator** built using [Next.js](https://nextjs.org/) and **TypeScript**. It allows users to input a URL, generate a PDF from it (using Puppeteer), and view/download the result — all with a live loading spinner and cancel support.

> Fully tested using [Jest](https://jestjs.io/) and [React Testing Library](https://testing-library.com/)

---

## Features

-  Input any public webpage URL
-  Stream PDF generation response from `/api/generate-pdf`
-  Live spinner + cancel request via `AbortController`
-  Toast notifications for success & error
-  Fully unit-tested with mock
-  PDF preview using `<iframe>` and download link

---

##  Tech Stack

- [Next.js](https://nextjs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Jest](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/)

---

## Getting Started

### 1. Install dependencies

```sh
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the root of your project and add the following variables:

```env
# WebSocket endpoint provided by Browserless
WSS_BROWSERLESS=wss://chrome.browserless.io

# Your secret API token from Browserless
SECRET_API_KEY=your-browserless-token
```
### 3. Run the development server
```sh
npm run dev
```
### 4. Run Test
This service uses Jest for unit testing. Test cases are located in the `tests` directory.

To run the tests:

```sh
npm test
```

To run tests with coverage:

```sh
npm run test:coverage
```

## 📦 Folder Structure
```sh
next-pdf/
├── __tests__/             # Unit tests
├── public/
├── src/
│   └── pages/
│       └── index.tsx      # Main UI
├── jest.config.js
├── jest.setup.ts
├── tsconfig.json
├── tsconfig.test.json
└── README.md
```

## PUBLIC ACCESS URL

```
https://next-pdf-generator.vercel.app/
```

