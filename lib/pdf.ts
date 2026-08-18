import { pathToFileURL } from 'node:url';
import { getPath } from 'pdf-parse/worker';
import { PDFParse } from 'pdf-parse';

let workerConfigured = false;

export function configurePdfWorker(): void {
  if (workerConfigured) {
    return;
  }

  PDFParse.setWorker(pathToFileURL(getPath()).href);
  workerConfigured = true;
}

export { PDFParse };
