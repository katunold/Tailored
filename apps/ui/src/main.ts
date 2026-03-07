import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.message}\n${err.stack ?? ''}`;
  }

  try {
    return JSON.stringify(err, null, 2);
  } catch {
    return String(err);
  }
}

window.addEventListener('error', (event) => {
  console.error('window.error', event.error, event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('window.unhandledrejection', event.reason);
});

bootstrapApplication(App, appConfig)
  .catch((err) => {
    const details = formatError(err);
    console.error('bootstrapApplication failed', err, details);

    const host = document.createElement('pre');
    host.style.whiteSpace = 'pre-wrap';
    host.style.padding = '16px';
    host.style.margin = '0';
    host.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    host.textContent = `Tailored UI failed to bootstrap:\n\n${details}`;
    document.body.replaceChildren(host);
  });
