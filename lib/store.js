// Saves and loads the dashboard's data in Vercel Blob storage.
// Works with the current connection method (BLOB_STORE_ID + automatic OIDC tokens)
// and with older read-write tokens, for both private and public stores.
// Falls back to the bundled seed files until the first refresh has run.
import { put, get } from '@vercel/blob';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const FILES = {
  professions: 'data/professions.json',
  achievements: 'data/achievements.json',
  status: 'data/status.json',
};

// New stores are private by default; older ones may be public. Try the likely one first.
let accessOrder = [process.env.BLOB_ACCESS === 'public' ? 'public' : 'private'];
accessOrder.push(accessOrder[0] === 'private' ? 'public' : 'private');

export const storageConfigured = () => !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);

async function readSeed(name) {
  try {
    const p = path.join(process.cwd(), 'seed', `${name}.json`);
    return JSON.parse(await readFile(p, 'utf8'));
  } catch {
    return null;
  }
}

async function readBlob(pathname) {
  let lastErr;
  for (const access of accessOrder) {
    try {
      const result = await get(pathname, { access, useCache: false });
      if (!result) return null; // not saved yet
      if (result.statusCode !== 200 || !result.stream) return null;
      return JSON.parse(await new Response(result.stream).text());
    } catch (e) {
      if (e && /not.?found/i.test(`${e.name} ${e.message}`)) return null;
      lastErr = e;
    }
  }
  throw lastErr;
}

export async function load(name) {
  if (storageConfigured()) {
    try {
      const data = await readBlob(FILES[name]);
      if (data) return data;
    } catch (e) {
      console.error(`load ${name} failed`, e);
    }
  }
  return readSeed(name);
}

export async function save(name, data) {
  let lastErr;
  for (const access of accessOrder) {
    try {
      await put(FILES[name], JSON.stringify(data), {
        access,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        cacheControlMaxAge: 60,
      });
      // Remember what worked so later calls go straight to it.
      if (accessOrder[0] !== access) accessOrder = [access, accessOrder[0]];
      return;
    } catch (e) {
      lastErr = e;
      // Only retry with the other access type if the error is about access.
      if (!/access|private|public/i.test(`${e && e.message}`)) break;
    }
  }
  throw lastErr;
}

// For the health check: can we write and read back a tiny file?
export async function selfTest() {
  await save('status', { ...(await load('status')), checkedAt: new Date().toISOString() });
  return accessOrder[0];
}
