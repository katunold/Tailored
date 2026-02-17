# Tailor Desktop MVP

## Dev

- `npm install`
- `npm run desktop:dev`

This starts:
- API (Express)
- UI (Angular)
- Electron desktop app

## Desktop Build + Run

- `npm run start:desktop`

This builds API, UI, and Electron main process, then starts the desktop shell.

### Environment

- `UI_DEV_URL` (set by root dev script)
- `API_DEV=1` (set by root dev script)
- `API_PORT` (optional)
