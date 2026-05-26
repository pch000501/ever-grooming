# EVER Grooming

EVER Grooming demo web app for reservation, grooming status, and customer status tracking.

## Stack

- Vite
- React
- React Router
- Netlify Functions
- Google Sheets API
- Solapi Kakao AlimTalk

## Local Development

Vite only, with mockData fallback:

```bash
npm install
npm run dev
```

Netlify Functions included:

```bash
npm run dev:netlify
```

If Google environment variables are not configured, the app falls back to `src/mockData.js`.

## Google Sheets

The app is configured for this sheet:

```text
GOOGLE_SHEET_ID=1HlckP33CABh5ulGTnykeOyYqPfyxUMSmP7RQgg08ZlU
```

Required Netlify environment variables:

```text
GOOGLE_SHEET_ID
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
```

See `GOOGLE_SHEETS_SETUP.md` for the sheet structure and setup details.

Optional Solapi environment variables for Kakao status notifications:

```text
SOLAPI_API_KEY
SOLAPI_API_SECRET
SOLAPI_FROM
SOLAPI_PFID
SOLAPI_TEMPLATE_ID
SOLAPI_DISABLE_SMS
```

## Netlify

`netlify.toml` contains the build configuration:

```text
Build command: npm run build
Publish directory: dist
Functions directory: netlify/functions
```

Google Sheets integration requires Netlify Functions, so deploy through GitHub integration or Netlify CLI rather than uploading only the `dist` folder.

## Scripts

```bash
npm run dev
npm run dev:netlify
npm run lint
npm run build
npm run preview
```
