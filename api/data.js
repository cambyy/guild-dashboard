// Serves the dashboard's current data to the page.
import { load } from '../lib/store.js';

export default async function handler(req, res) {
  const [professions, achievements, status] = await Promise.all([
    load('professions'),
    load('achievements'),
    load('status'),
  ]);
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.status(200).json({
    professions: professions || { rows: [] },
    achievements: achievements || { rows: [] },
    status: status || {},
  });
}
