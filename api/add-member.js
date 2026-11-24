// Adds a guild member (officers only), reads their Armory page right away,
// and records a "joined the guild" achievement.
// POST JSON: { "name": "Arnette Fizzlebeef", "password": "..." }
import { timingSafeEqual } from 'node:crypto';
import { readCharacter, nameFromSlug, slugFromName } from '../lib/armory.js';
import { load, save, storageConfigured } from '../lib/store.js';

const GUILD_SLUG = 'thrall-dressed';

function passwordOk(given) {
  const expected = process.env.OFFICER_PASSWORD || '';
  if (!expected || typeof given !== 'string') return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Accepts "Arnette Fizzlebeef", "arnette-fizzlebeef" or a full Armory link.
function toSlug(input) {
  let s = String(input || '').trim();
  const m = s.match(/\/character\/(?:us\/)?([^/?#]+)/i);
  if (m) s = decodeURIComponent(m[1]);
  s = slugFromName(s.replace(/-/g, ' '));
  return /^[\p{L}\p{M}]+(?:-[\p{L}\p{M}]+)*$/u.test(s) ? s : '';
}

const fail = (res, code, message) => res.status(code).json({ ok: false, message });

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return fail(res, 405, 'Use the Add member form on the dashboard.');
    if (!process.env.OFFICER_PASSWORD) return fail(res, 500, 'The officer password has not been set up yet (OFFICER_PASSWORD in Vercel).');
    if (!storageConfigured()) return fail(res, 500, "Storage isn't connected, so members can't be saved.");

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};

    if (!passwordOk(body.password)) {
      await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
      return fail(res, 401, 'Incorrect officer password. Nothing was added.');
    }

    const slug = toSlug(body.name);
    if (!slug) return fail(res, 400, 'Enter the character name, e.g. "Arnette Fizzlebeef".');

    const prevProfs = (await load('professions')) || { rows: [] };
    const memberData = (await load('members')) || { members: [] };
    const members = new Set(memberData.members || []);
    const tracked = new Set((prevProfs.rows || []).map((r) => slugFromName(r.character)));
    if (members.has(slug) || tracked.has(slug)) {
      return fail(res, 409, `${nameFromSlug(slug)} is already on the roster.`);
    }

    // Check the Armory before adding.
    let page;
    try {
      page = await readCharacter(slug);
    } catch {
      return fail(res, 502, "Couldn't reach the Armory to check this character. Try again in a minute.");
    }
    if (page.status === 404) return fail(res, 404, `No character called ${nameFromSlug(slug)} was found on the WoW: Forever Armory. Check the spelling.`);
    if (page.data && page.data.guild && page.data.guild.slug && page.data.guild.slug !== GUILD_SLUG) {
      return fail(res, 400, `${nameFromSlug(slug)} is in ${page.data.guild.name || 'another guild'}, not Thrall Dressed.`);
    }

    const NOW = new Date().toISOString();
    const character = page.data ? page.data.character : nameFromSlug(slug);

    // 1. Add to the member list.
    members.add(slug);
    await save('members', { members: [...members].sort() });

    // 2. Add their professions now, so they show up without waiting for the nightly refresh.
    if (page.data) {
      const newRows = page.data.professions.map((p) => ({
        character, cls: page.data.cls, level: page.data.level, ...p, updated: NOW,
      }));
      await save('professions', { ...prevProfs, rows: [...(prevProfs.rows || []), ...newRows] });
    }

    // 3. Record the "joined the guild" achievement.
    const ach = (await load('achievements')) || { rows: [] };
    ach.rows = [...(ach.rows || []), { at: NOW, character, kind: 'joined', profession: '', milestone: 0 }];
    await save('achievements', ach);

    return res.status(200).json({
      ok: true,
      character,
      message: page.data
        ? `${character} was added to the roster.`
        : `${character} was added. Their Armory page isn't readable yet, so their professions will appear once it is.`,
    });
  } catch (err) {
    console.error('add-member failed', err);
    return fail(res, 500, `Adding the member failed: ${err && err.message ? err.message : String(err)}`);
  }
}
