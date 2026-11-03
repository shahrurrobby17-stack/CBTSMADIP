import fs from 'fs';
import path from 'path';

const STORAGE_KEY = 'smadip_cbt_vercel_storage_v1';

// Global in-memory cache across warm serverless invocations
declare global {
  // eslint-disable-next-line no-var
  var __SMADIP_CBT_MEM_STORE__: Record<string, unknown> | null | undefined;
}

function getLocalFilePath(): string {
  // On Vercel Serverless environment, /tmp is writable
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join('/tmp', `${STORAGE_KEY}.json`);
  }
  const dataDir = path.join(process.cwd(), '.data');
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, `${STORAGE_KEY}.json`);
  } catch {
    return path.join('/tmp', `${STORAGE_KEY}.json`);
  }
}

function getKvConfig(): { url: string; token: string } | null {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (url && token) {
    return { url: url.replace(/\/$/, ''), token };
  }
  return null;
}

async function readFromVercelKV(kv: {
  url: string;
  token: string;
}): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(
      `${kv.url}/get/${encodeURIComponent(STORAGE_KEY)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${kv.token}`,
        },
      }
    );
    if (!response.ok) return null;
    const json = (await response.json()) as { result?: string | null };
    if (!json.result) return null;
    return typeof json.result === 'string'
      ? (JSON.parse(json.result) as Record<string, unknown>)
      : (json.result as Record<string, unknown>);
  } catch {
    return null;
  }
}

async function writeToVercelKV(
  kv: { url: string; token: string },
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    const response = await fetch(
      `${kv.url}/set/${encodeURIComponent(STORAGE_KEY)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kv.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

function readFromFileOrMemory(): Record<string, unknown> | null {
  try {
    const filePath = getLocalFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      globalThis.__SMADIP_CBT_MEM_STORE__ = parsed;
      return parsed;
    }
  } catch {
    // Fallback to memory store
  }
  return globalThis.__SMADIP_CBT_MEM_STORE__ || null;
}

function writeToFileAndMemory(payload: Record<string, unknown>): void {
  globalThis.__SMADIP_CBT_MEM_STORE__ = payload;
  try {
    const filePath = getLocalFilePath();
    fs.writeFileSync(filePath, JSON.stringify(payload), 'utf-8');
  } catch {
    // Ignore write errors in read-only filesystems
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const kv = getKvConfig();
  const engine = kv ? 'vercel-kv' : 'vercel-serverless';

  if (req.method === 'GET') {
    let data: Record<string, unknown> | null = null;
    if (kv) {
      data = await readFromVercelKV(kv);
    }
    if (!data) {
      data = readFromFileOrMemory();
    }
    return res.status(200).json({
      ok: true,
      engine,
      data: data || null,
    });
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const existing =
        (kv ? await readFromVercelKV(kv) : null) || readFromFileOrMemory() || {};

      const merged: Record<string, unknown> = {
        ...existing,
        ...body,
        updatedAt: Date.now(),
      };

      writeToFileAndMemory(merged);
      if (kv) {
        await writeToVercelKV(kv, merged);
      }

      return res.status(200).json({
        ok: true,
        engine,
        updatedAt: merged.updatedAt,
        data: merged,
      });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        engine,
        error: err instanceof Error ? err.message : 'Invalid payload',
      });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
