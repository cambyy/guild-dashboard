// Re-reads every member's Armory page, saves the new data and records new milestones.
// Runs daily via Vercel Cron (see vercel.json) and when someone presses Refresh on the dashboard.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchCharacter, mapLimit, slugFromName } from '../lib/armory.js';
import { load, save } from '../lib/store.js';

const LEVEL_MILESTONES = [10, 20, 30, 40, 50, 60];
const SKILL_MILESTONES = [75, 150, 225, 300];
const PUBLIC_COOLDOWN_MIN = 30; // visitors can refresh at most this often

async function configuredMembers() {
  try {
    const p = path.join(process.cwd(), 'seed', 'members.json');
    return JSON.parse(await readFile(p, 'utf8')).members || [];
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  const key = (req.query && req.query.key) || '';
  const trusted = !!secret && (auth === `Bearer ${secret}` || key === secret);

  const prevProfs = (await load('professions')) || { rows: [] };
  const prevAch = (await load('achievements')) || { rows: [] };
  const status = (await load('status')) || {};

  // Visitors (the Refresh button) are rate-limited; the daily cron and the secret link are not.
  if (!trusted) {
    const last = Date.parse(status.updated || prevProfs.updated || 0) || 0;
    const waitMin = PUBLIC_COOLDOWN_MIN - (Date.now() - last) / 60000;
    if (waitMin > 0) {
      return res.status(429).json({ ok: false, message: `Data was refreshed recently. Try again in ${Math.ceil(waitMin)} minutes.` });
    }
  }

  // Members = the configured list plus everyone already in the saved data.
  const slugs = new Set(await configuredMembers());
  for (const r of prevProfs.rows || []) slugs.add(slugFromName(r.character));
  for (const s of status.skipped || []) slugs.add(s);
  const list = [...slugs].sort();

  const results = await mapLimit(list, 4, (slug) => fetchCharacter(slug));
  const NOW = new Date().toISOString();
  const rows = [];
  const skipped = [];
  results.forEach((c, i) => {
    if (!c) { skipped.push(list[i]); return; }
    for (const p of c.professions) {
      rows.push({ character: c.character, cls: c.cls, level: c.level, ...p, updated: NOW });
    }
  });

  // If Blizzard blocked us or changed the page, don't wipe the dashboard.
  const readCount = results.filter(Boolean).length;
  if (readCount === 0) {
    return res.status(502).json({ ok: false, message: 'Could not read any character pages from the Armory. Nothing was changed.', skipped });
  }

  // New milestones, only for characters seen in both the previous and the new data.
  const prevLevel = new Map(), prevSkill = new Map();
  for (const r of prevProfs.rows || []) {
    prevLevel.set(r.character, r.level);
    prevSkill.set(`${r.character}|${r.profession}`, r.skill);
  }
  const newLevel = new Map();
  for (const r of rows) newLevel.set(r.character, r.level);

  const fresh = [];
  for (const [character, lvl] of newLevel) {
    if (!prevLevel.has(character)) continue;
    for (const t of LEVEL_MILESTONES) {
      if (prevLevel.get(character) < t && t <= lvl) fresh.push({ at: NOW, character, kind: 'level', profession: '', milestone: t });
    }
  }
  for (const r of rows) {
    if (!prevLevel.has(r.character)) continue;
    const before = prevSkill.get(`${r.character}|${r.profession}`) || 0;
    for (const t of SKILL_MILESTONES) {
      if (before < t && t <= r.skill) fresh.push({ at: NOW, character: r.character, kind: 'profession', profession: r.profession, milestone: t });
    }
  }

  await save('professions', { updated: NOW, rows });
  await save('achievements', { rows: [...(prevAch.rows || []), ...fresh] });
  await save('status', { updated: NOW, read: readCount, skipped });

  return res.status(200).json({
    ok: true,
    updated: NOW,
    charactersRead: readCount,
    skipped,
    newAchievements: fresh.map((a) => (a.kind === 'level'
      ? `${a.character} reached level ${a.milestone}`
      : `${a.character} reached ${a.milestone} in ${a.profession.toLowerCase()}`)),
  });
}
