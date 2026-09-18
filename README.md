# ECO-ENGINE MRV

A working prototype for turning industrial operating records into human-approved, traceable emissions calculations.

**Status:** demonstrator with synthetic fixtures. Not a production compliance system. No UNICEF affiliation or endorsement is claimed.

## What works

- Facility registration and evidence uploads.
- Demonstration extraction suggestions, confidence scores and approve/edit/return workflow.
- Deterministic calculations using a versioned factor library.
- Calculation history, submission to review and hash-linked audit records.
- Manual entry and simulated failure-recovery paths.

The extraction implementation uses fixture/filename-based rules; it is not a deployed general-purpose AI/OCR service. Verification decisions and regulator report generation remain placeholders. Role labels do not enforce authentication or access control. Factors and regulatory statements displayed in the interface require independent validation.

## Run locally

Install Node.js 22 and npm, then run these commands inside this folder:

```sh
npm ci
npm start
```

Open http://localhost:3000/. Register a sample facility, open its workspace, load the operational fixtures, trigger extraction, review the suggestions and run the compiler. Only use fictional data.

The server creates `data/` and `uploads/` automatically. Neither folder is included in this repository. `PORT`, `DATA_DIR` and `UPLOADS_DIR` can be set as environment variables. The example environment file is documentation; this app does not automatically load `.env` files.

## Test

```sh
npm test
```

The suite starts a server and creates sample records. Run it against disposable storage, not an existing working dataset. GitHub Actions uses isolated temporary directories. The test port can be changed with the `PORT` environment variable.

## Deployment and application links

See [DEPLOY.md](DEPLOY.md) for GitHub upload and Render hosting instructions. GitHub stores the source; a Node web host runs the complete app. GitHub Pages alone cannot execute this Express backend.

Source repository: https://github.com/Jumi-2025/eco-engine-mrv

The earlier showcase URL supplied by the founder is https://eco-emrv.netlify.app/. It is a separate static showcase, not this server-backed platform.

## Architecture

`public/` contains the browser interface; `server.js` provides Express API endpoints; `lib/calculator.js` performs calculations; `lib/emission_factors.js` supplies the factor library. `fixtures/` contains demonstration evidence. Storage is a local JSON file plus uploaded files, intended for a single-process prototype.

## Public-demo limitations

All visitors to a hosted instance currently share its database. There is no enforced login, tenant isolation, upload privacy or production abuse protection. Uploaded evidence is served publicly. Do not upload company documents, personal information, credentials or child-level data. Ephemeral hosting can erase records on restart or redeployment. Use synthetic records only and address these limitations before a real-data pilot.

## Open-source status

The supplied package declares ISC in `package.json`. A standalone copyright/license grant was not supplied with the source. Before describing this as a fully licensed open-source release, the rights holder should confirm the intended license and add the corresponding LICENSE file. Publishing code alone does not complete that step. See [UNICEF_APPLICATION_NOTES.md](UNICEF_APPLICATION_NOTES.md).

## Contributions

Use GitHub issues for reproducible bugs and feature proposals. Pull requests should include relevant tests and avoid committing uploaded evidence, private data or credentials. Priorities are enforced identity/roles, isolated storage, validated factor provenance, real extraction integration, verification and report generation.


