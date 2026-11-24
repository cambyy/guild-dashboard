// Setup check: open /api/health in a browser to see what's working.
// Shows no secrets; tests storage and reads one Armory page.
import { characterUrl, fetchCharacter } from '../lib/armory.js';
import { storageConfigured, selfTest } from '../lib/store.js';

export default async function handler(req, res) {
  const checks = {};

  checks.cronSecretSet = !!process.env.CRON_SECRET;
  checks.storageConnected = storageConfigured();
  checks.storageMethod = process.env.BLOB_STORE_ID ? 'store id + automatic OIDC' : (process.env.BLOB_READ_WRITE_TOKEN ? 'read-write token' : 'none');

  if (checks.storageConnected) {
    try {
      const access = await selfTest();
      checks.storageWorks = `yes (${access} store)`;
    } catch (e) {
      checks.storageWorks = `no: ${e && e.message}`;
    }
  }

  const testSlug = (req.query && req.query.character) || 'arnu-ashvane';
  const t0 = Date.now();
  try {
    const raw = await fetch(characterUrl(testSlug), {
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; GuildDashboard/1.0)', accept: 'text/html' },
    });
    checks.armoryStatus = raw.status;
    checks.armoryMs = Date.now() - t0;
    const parsed = raw.status === 200 ? await fetchCharacter(testSlug) : null;
    checks.armoryParsed = parsed
      ? `ok: ${parsed.character}, level ${parsed.level}, ${parsed.professions.length} professions`
      : 'could not read professions from the page';
  } catch (e) {
    checks.armoryStatus = 'error';
    checks.armoryError = e && (e.name === 'TimeoutError' ? 'timed out after 8 seconds' : e.message);
  }

  const problems = [];
  if (!checks.storageConnected) problems.push('Connect the Blob store to this project under Storage, then redeploy.');
  else if (!String(checks.storageWorks).startsWith('yes')) problems.push('Storage is connected but saving failed (see storageWorks).');
  if (!checks.cronSecretSet) problems.push('Add CRON_SECRET in the project environment variables, then redeploy.');
  if (checks.armoryStatus !== 200) problems.push('The Armory did not return the character page. Blizzard may be blocking Vercel.');
  else if (!String(checks.armoryParsed).startsWith('ok')) problems.push('The Armory page loaded but its layout may have changed.');

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: problems.length === 0, problems, checks });
}
