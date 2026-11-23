// Saves and loads the dashboard's data in Vercel Blob storage.
// Falls back to the bundled seed files until the first refresh has run.
import { put, head } from '@vercel/blob';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const FILES = {
  professions: 'data/professions.json',
  achievements: 'data/achievements.json',
  status: 'data/status.json',
};

async function readSeed(name) {
  try {
    const p = path.join(process.cwd(), 'seed', `${name}.json`);
    return JSON.parse(await readFile(p, 'utf8'));
  } catch {
    return null;
  }
}

export async function load(name) {
  try {
    const meta = await head(FILES[name]);
    const res = await fetch(`${meta.url}?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch {
    // not saved yet, or storage not connected
  }
  return readSeed(name);
}

export async function save(name, data) {
  await put(FILES[name], JSON.stringify(data), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
}
