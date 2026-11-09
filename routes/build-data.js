// Shared public projection for showcase, detail, and profile. No account secrets.
const { COVER_PATH } = require('./approved-assets');
const buildSelect = `SELECT b.id, b.owner_id, b.game_id, b.title, b.description,
  b.image_urls, b.budget_tier, b.build_type, b.is_pinned, b.created_at, b.updated_at,
  g.name AS game_name, g.slug AS game_slug, u.username AS owner, p.display_name,
  COALESCE(bs.avg_rating,0)::float8 AS avg_rating,
  COALESCE(bs.like_count,0)::int AS like_count,
  ARRAY(SELECT bt.tag FROM build_tags bt WHERE bt.build_id=b.id ORDER BY bt.tag) AS tags
  FROM builds b JOIN games g ON g.id=b.game_id JOIN users u ON u.id=b.owner_id
  LEFT JOIN profiles p ON p.user_id=u.id
  LEFT JOIN build_stats bs ON bs.build_id=b.id`;
const types = ['freeform', 'interior', 'renovation', 'city-planning', 'sandbox'];
const budgets = ['starter', 'mid', 'luxury', 'unlimited'];
const validId = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const failure = (status, errors) => Object.assign(new Error('Build request rejected'), { status, errors });

async function validateBuild(client, body, current) {
  const errors = {};
  const data = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if (!title) errors.title = 'Enter a build title.';
  if (!Number.isInteger(data.game_id) || data.game_id < 1 || data.game_id > 2147483647) errors.game_id = 'Choose a valid game.';
  if (data.description !== undefined && typeof data.description !== 'string') errors.description = 'Description must be text.';
  if (!budgets.includes(data.budget_tier)) errors.budget_tier = 'Choose a valid budget tier.';
  if (!types.includes(data.build_type)) errors.build_type = 'Choose a valid build type.';
  const image_urls = data.image_urls === undefined ? [] : data.image_urls;
  if (!Array.isArray(image_urls) || image_urls.some(value => {
    if (value === COVER_PATH) return false;
    if (typeof value !== 'string') return true;
    try {
      const url = new URL(value);
      return !['http:', 'https:'].includes(url.protocol) || !!url.username || !!url.password;
    } catch { return true; }
  })) errors.image_urls = 'Use full HTTP(S) URLs without credentials, or the approved Construction Site image path.';
  const tags = data.tags === undefined ? [] : data.tags;
  if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string' || !tag.trim()) || new Set(tags).size !== tags.length) {
    errors.tags = 'Choose unique tags from this game’s vocabulary.';
  }
  const is_pinned = data.is_pinned === undefined ? (current?.is_pinned ?? false) : data.is_pinned;
  if (typeof is_pinned !== 'boolean') errors.is_pinned = 'Pin must be true or false.';
  // Reject null bytes before pg can turn a validation failure into a SQL error.
  if ([title, data.description ?? '', ...(Array.isArray(tags) ? tags : []), ...(Array.isArray(image_urls) ? image_urls : [])]
    .some(value => typeof value === 'string' && value.includes('\0'))) errors._general = 'Text cannot contain null characters.';
  if (Object.keys(errors).length) throw failure(400, errors);
  const game = await client.query('SELECT id FROM games WHERE id=$1', [data.game_id]);
  if (!game.rows.length) throw failure(400, { game_id: 'Game not found.' });
  const vocabulary = await client.query('SELECT tag FROM game_tags WHERE game_id=$1', [data.game_id]);
  const allowed = new Set(vocabulary.rows.map(row => row.tag));
  if (tags.some(tag => !allowed.has(tag))) throw failure(400, { tags: 'Choose tags from the selected game’s vocabulary.' });
  return { title, game_id: data.game_id, description: (data.description ?? '').trim(), image_urls, budget_tier: data.budget_tier, build_type: data.build_type, tags, is_pinned };
}

module.exports = { buildSelect, types, budgets, validId, failure, validateBuild };
