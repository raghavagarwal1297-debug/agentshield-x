// Tiny JSON-file store for the sandbox. All "business data" lives in server/data.
// server/data/_seed holds a pristine copy; resetData() restores it.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, 'data');
export const SEED_DIR = path.join(DATA_DIR, '_seed');
export const DOCS_DIR = path.join(DATA_DIR, 'documents');
export const EXPORTS_DIR = path.join(DATA_DIR, 'exports');

export function readJSON(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
}

export function writeJSON(name, value) {
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(value, null, 2) + '\n');
}

// Restore every data file and document from _seed, and empty the exports folder.
export function resetData() {
  fs.cpSync(SEED_DIR, DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  for (const f of fs.readdirSync(EXPORTS_DIR)) {
    if (f !== '.gitkeep') fs.rmSync(path.join(EXPORTS_DIR, f), { recursive: true, force: true });
  }
}
