import { db } from './dexie';
import { repository } from './dexieRepository';
import { RawImportPayloadSchema } from '../import/schema';

let initialization: Promise<void> | undefined;
export function initializeExtractedBank(): Promise<void> {
  // A shared promise also handles React StrictMode's repeated mount.
  initialization ??= (async () => {
    const response = await fetch('/extracted-question-bank.json');
    if (!response.ok) throw new Error('The question bank could not be loaded. Please retry.');
    const text = await response.text();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const previous = await db.metadata.get('pdf-bank-content');
    if (previous?.value === fingerprint) return;
    const payload = RawImportPayloadSchema.parse(JSON.parse(text));
    const earlierExtraction = previous || await db.metadata.get('pdf-bank-v3') || await db.metadata.get('pdf-bank-v2') || await db.metadata.get('pdf-bank-v1');
    await repository.importPayload(payload, earlierExtraction ? 'overwrite' : 'skip');
    await db.metadata.put({ key: 'pdf-bank-content', value: fingerprint });
  })().catch((error) => { initialization = undefined; throw error; });
  return initialization;
}
