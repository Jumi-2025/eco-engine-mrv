# Publish source and create an application demo link

## 1. Upload the source to GitHub

1. Sign in as `Jumi-2025` at https://github.com/.
2. Create a **public** repository called `eco-engine-mrv`.
3. Extract the supplied ZIP. Upload the **contents** of the ECO_ENGINE_GITHUB folder into the repository root. `package.json` and `server.js` must appear at the top level. Do not upload only the ZIP.
4. Commit the files. Include `.gitignore` and `.github/workflows/test.yml`; enable hidden files in your file picker if needed.
5. Open the repository URL while signed out to confirm public access. Check the Actions tab for test results.

After creation, your source-code URL will be:

`https://github.com/Jumi-2025/eco-engine-mrv`

That URL is not claimed to exist yet.

## 2. Deploy the working Node app

1. Sign in to Render at https://dashboard.render.com/.
2. Select **New → Web Service** and connect the GitHub repository.
3. Choose Node as the runtime and leave the root directory blank.
4. Set build command to `npm ci` and start command to `npm start`.
5. Set health check path to `/healthz`. Use a free plan if available and appropriate; no paid service is required by this package.
6. Deploy. Wait for the service to show **Live**. Copy the actual HTTPS address Render assigns; do not guess the hostname.
7. Open that address signed out. Register a fictional facility, load the sample records, approve fields and calculate before adding the address to the application.

The included `render.yaml` supports the same configuration through Render Blueprints. Do not point GitHub Pages or a static Netlify deploy at `public/` and expect the API to work.

Public demo data is shared and unauthenticated. Use only synthetic fixtures. Free hosting may sleep, and ephemeral storage may reset. Persistent storage and security hardening are required for real records.

## 3. Which link goes into UNICEF's form?

- **Source code / GitHub repository:** the public GitHub repository URL after upload.
- **Working prototype / demo:** the tested Render HTTPS URL after deployment.
- **Pitch deck:** a separately shared presentation URL if requested; the repository does not replace the pitch.

Never paste `localhost:3000`, a local Windows path, or a proposed hostname into an application field expecting a public demo.

Sources: https://render.com/docs/deploy-node-express-app and https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages (checked 18 September 2026).

