import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

/**
 * Optional roster persistence endpoint.
 *
 *   GET /api/roster?id=my-guild            -> { id, data, updatedAt }
 *   PUT /api/roster?id=my-guild            -> save { data } (upsert)
 *
 * The whole roster document is stored as one JSONB blob, which is plenty for a
 * guild roster of a few hundred members and keeps reads to a single round trip.
 *
 * Requires DATABASE_URL (Neon connection string) in the Vercel project env.
 * See DEPLOY.md — a single file per project instead of a row per member keeps
 * this comfortably inside the Neon free plan.
 */

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_BODY_BYTES = 512 * 1024;

function getConnectionString(): string {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not configured for this deployment.');
  }
  return url;
}

function asString(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const rawId = asString(req.query.id);
  if (!rawId || !ID_PATTERN.test(rawId)) {
    res.status(400).json({
      error: 'Pass a roster id of 1-64 lowercase letters, digits or dashes, e.g. ?id=my-guild',
    });
    return;
  }
  const id = rawId;

  let sql: ReturnType<typeof neon>;
  try {
    sql = neon(getConnectionString());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
    return;
  }

  try {
    if (req.method === 'GET') {
      const rows = (await sql`
        select data, updated_at
        from roster_snapshots
        where id = ${id}
      `) as Array<{ data: unknown; updated_at: string }>;

      if (rows.length === 0) {
        res.status(404).json({ error: 'No saved roster with that id.' });
        return;
      }

      res.status(200).json({
        id,
        data: rows[0].data,
        updatedAt: rows[0].updated_at,
      });
      return;
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = req.body as { data?: unknown; token?: string } | undefined;
      if (!body || typeof body !== 'object' || body.data === undefined) {
        res.status(400).json({ error: 'Expected a JSON body of the shape { "data": ... }.' });
        return;
      }

      const serialized = JSON.stringify(body.data);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) {
        res.status(413).json({ error: 'Roster payload is too large (limit 512 KB).' });
        return;
      }

      // A roster whose write_token is null is an open edit link. When a token is
      // set, writes must present the same token in the x-roster-token header.
      const token = asString(req.headers['x-roster-token']) ?? body.token ?? null;

      const rows = (await sql`
        insert into roster_snapshots (id, data, write_token)
        values (${id}, ${serialized}::jsonb, ${token})
        on conflict (id) do update
          set data = excluded.data, updated_at = now()
          where roster_snapshots.write_token is null
             or roster_snapshots.write_token = ${token}
        returning updated_at
      `) as Array<{ updated_at: string }>;

      if (rows.length === 0) {
        res.status(403).json({ error: 'This roster is locked with a different write token.' });
        return;
      }

      res.status(200).json({ id, updatedAt: rows[0].updated_at });
      return;
    }

    res.setHeader('Allow', 'GET, PUT, POST');
    res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    const message = (error as Error).message;
    // 42P01 = table does not exist yet (schema.sql was not run).
    if (message.includes('roster_snapshots')) {
      res.status(500).json({ error: 'roster_snapshots table is missing — run db/schema.sql once.' });
      return;
    }
    res.status(500).json({ error: message });
  }
}
