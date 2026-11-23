// Reads public character pages from the WoW: Forever Armory.
// Each character page embeds its profession data as JSON in the HTML.

export const GUILD_URL = 'https://worldofwarcraft.blizzard.com/en-us/forever/us/armory/guild/thrall-dressed';
export const characterUrl = (slug) => `https://worldofwarcraft.blizzard.com/en-us/forever/us/armory/character/${slug}`;

// "arnu-ashvane" -> "Arnu Ashvane"
export const nameFromSlug = (slug) =>
  slug.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

// "Arnu Ashvane" -> "arnu-ashvane"
export const slugFromName = (name) => String(name).trim().toLowerCase().replace(/\s+/g, '-');

// Pull the JSON value that follows "key": out of a big HTML string by matching braces.
function grabJson(html, key) {
  const i = html.indexOf(`"${key}":`);
  if (i < 0) return null;
  const j = html.indexOf(':', i) + 1;
  const open = html[j];
  if (open !== '{' && open !== '[') return null;
  let depth = 0, inStr = false, esc = false;
  for (let k = j; k < html.length; k++) {
    const ch = html[k];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(html.slice(j, k + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

// Returns {character, cls, level, professions:[{profession, kind, skill, max}]} or null if the page isn't readable.
export async function fetchCharacter(slug) {
  const res = await fetch(characterUrl(slug), {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; GuildDashboard/1.0)',
      accept: 'text/html',
      'accept-language': 'en-US,en;q=0.9',
    },
  });
  if (res.status !== 200) return null;
  const html = await res.text();
  const prof = grabJson(html, 'professions');
  if (!prof || (!prof.primaries && !prof.secondaries)) return null;

  const lvl = html.match(/"level":(\d+),"name":"[^"]+","professions"/) || html.match(/"level":(\d+),"media"/);
  const cls = html.match(/"class":\{[^}]*?"name":"([^"]+)"/);
  const level = lvl ? Number(lvl[1]) : 0;

  const professions = [];
  for (const [kind, list] of [['Primary', prof.primaries], ['Secondary', prof.secondaries]]) {
    for (const p of list || []) {
      const t = p.tiers && p.tiers[0];
      if (!t || !(t.skillPoints > 1)) continue; // skill 1 = learned but never used
      professions.push({ profession: p.name, kind, skill: t.skillPoints, max: t.maxSkillPoints });
    }
  }
  return { character: nameFromSlug(slug), cls: cls ? cls[1] : 'Unknown', level, professions };
}

// Run fn over items with limited concurrency, politely.
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try { out[i] = await fn(items[i], i); } catch { out[i] = null; }
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
