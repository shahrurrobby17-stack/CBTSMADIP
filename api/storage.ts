import fs from 'fs';
import path from 'path';

const STORAGE_KEY = 'smadip_cbt_vercel_storage_v1';

// Global in-memory cache across warm serverless invocations
declare global {
  // eslint-disable-next-line no-var
  var __SMADIP_CBT_MEM_STORE__: Record<string, unknown> | null | undefined;
}

const DEFAULT_DEMO_PARTICIPANT_IDS = new Set([
  'ap1',
  'ap2',
  'ap3',
  'ap4',
  'ap5',
  'ap6',
  'ap7',
  'ap8',
  'p1',
  'p2',
  'p3',
  'p4',
  'p5',
  'p6',
  'p7',
  'p8',
]);

const DEFAULT_DEMO_USERNAMES = new Set([
  'SA20264821',
  'SA20267394',
  'SA20262918',
  'SA20268563',
  'SA20265147',
  'SA20269302',
  'SA20266475',
  'SA20261839',
  'P130100240',
  'K020500118',
  'TK1601',
  'TK1610',
]);

const DEFAULT_DEMO_SCHEDULE_IDS = new Set([
  'sch_1',
  'sch_2',
  'sch_3',
  'sch_4',
  'sch_5',
]);

function isDefaultDemoRow(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const id = String((item as Record<string, unknown>).id || '').trim();
  if (id.startsWith('excel_') || /^ap_\d+$/.test(id)) return false;
  const username = String((item as Record<string, unknown>).username || '')
    .trim()
    .toUpperCase();
  return (
    DEFAULT_DEMO_PARTICIPANT_IDS.has(id) || DEFAULT_DEMO_USERNAMES.has(username)
  );
}

function isCustomUploadedRow(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  if (!isDefaultDemoRow(item)) return true;
  const id = String((item as Record<string, unknown>).id || '').trim();
  return id.startsWith('excel_') || /^ap_\d+$/.test(id);
}

function isDefaultDemoParticipantsList(list: unknown): boolean {
  if (!Array.isArray(list) || list.length === 0) return true;
  if (list.length > 8) return false;
  return list.every((item) => isDefaultDemoRow(item));
}

function isDefaultInactiveSchedulesList(list: unknown): boolean {
  if (!Array.isArray(list) || list.length === 0) return true;
  const hasAnyActive = list.some(
    (s) => s && typeof s === 'object' && Boolean((s as any).isActive)
  );
  if (hasAnyActive) return false;
  return list.every(
    (s) =>
      s &&
      typeof s === 'object' &&
      DEFAULT_DEMO_SCHEDULE_IDS.has(String((s as any).id || '').trim())
  );
}

function resolveIncomingSchedules(
  incomingList: unknown,
  existingList: unknown,
  forceReplace?: boolean
): Record<string, any>[] | undefined {
  const hasExisting = Array.isArray(existingList) && existingList.length > 0;
  const hasIncoming = Array.isArray(incomingList) && incomingList.length > 0;

  if (!hasIncoming) {
    return hasExisting ? (existingList as Record<string, any>[]) : undefined;
  }

  const existingHasActiveOrCustom =
    hasExisting && !isDefaultInactiveSchedulesList(existingList);
  const incomingIsDefaultInactive = isDefaultInactiveSchedulesList(incomingList);

  // Never allow an unhydrated tab's default inactive schedules to wipe out active schedules or custom schedules
  // unless the Admin explicitly toggled/modified schedules (forceReplace = true)
  if (existingHasActiveOrCustom && incomingIsDefaultInactive && !forceReplace) {
    return existingList as Record<string, any>[];
  }

  if (!forceReplace && hasExisting) {
    const existingActiveIds = new Set<string>();
    const customExistingRows: Record<string, any>[] = [];
    const incomingIds = new Set<string>(
      (incomingList as any[])
        .filter((s) => s && typeof s === 'object')
        .map((s) => String(s.id || '').trim())
    );

    for (const row of existingList as any[]) {
      if (!row || typeof row !== 'object') continue;
      const id = String(row.id || '').trim();
      if (row.isActive && id) {
        existingActiveIds.add(id);
      }
      if (id && !DEFAULT_DEMO_SCHEDULE_IDS.has(id) && !incomingIds.has(id)) {
        customExistingRows.push(row);
      }
    }

    const merged = (incomingList as any[])
      .filter((s) => s && typeof s === 'object')
      .map((s) => {
        const id = String(s.id || '').trim();
        if (id && existingActiveIds.has(id)) {
          return { ...s, isActive: true };
        }
        return s;
      });

    return [...merged, ...customExistingRows];
  }

  return incomingList as Record<string, any>[];
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

function sanitizeParticipantsList(
  rawList: unknown,
  existingList?: unknown
): Record<string, any>[] {
  if (!Array.isArray(rawList)) return [];
  const hasCustomRows = rawList.some((item) => isCustomUploadedRow(item));
  const baseList = hasCustomRows
    ? rawList.filter((item) => !isDefaultDemoRow(item))
    : rawList;

  const existingMap = new Map<string, Record<string, any>>();
  if (Array.isArray(existingList)) {
    for (const item of existingList) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as any).username === 'string'
      ) {
        existingMap.set(
          (item as any).username.trim().toUpperCase(),
          item as Record<string, any>
        );
      }
    }
  }

  return baseList
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const row = { ...(item as Record<string, any>) };
      const cleanUser =
        typeof row.username === 'string'
          ? row.username.trim().toUpperCase()
          : '';
      const prevRow = cleanUser ? existingMap.get(cleanUser) : undefined;

      const maxResetAt = Math.max(
        typeof row.lastResetAt === 'number' ? row.lastResetAt : 0,
        typeof prevRow?.lastResetAt === 'number' ? prevRow.lastResetAt : 0
      );
      if (maxResetAt > 0) {
        row.lastResetAt = maxResetAt;
      }

      if (
        row.violationCount === undefined &&
        typeof prevRow?.violationCount === 'number'
      ) {
        row.violationCount = prevRow.violationCount;
      }
      if (
        row.draftAnswers === undefined &&
        prevRow?.draftAnswers &&
        typeof prevRow.draftAnswers === 'object'
      ) {
        row.draftAnswers = prevRow.draftAnswers;
      }
      if (
        row.draftPackageId === undefined &&
        typeof prevRow?.draftPackageId === 'string'
      ) {
        row.draftPackageId = prevRow.draftPackageId;
      }
      if (
        row.draftRemainingSeconds === undefined &&
        typeof prevRow?.draftRemainingSeconds === 'number'
      ) {
        row.draftRemainingSeconds = prevRow.draftRemainingSeconds;
      }

      const vTimestamp =
        typeof row.violationTimestamp === 'number' ? row.violationTimestamp : 0;
      const isValidViolation =
        row.violationSchema === 3 &&
        vTimestamp > 0 &&
        vTimestamp > maxResetAt &&
        (row.requestReset === true ||
          row.loginState === 'Terkunci (Pelanggaran)');

      if (!isValidViolation) {
        row.requestReset = false;
        if (row.loginState === 'Terkunci (Pelanggaran)') {
          row.loginState = 'Belum Login';
        }
        delete row.violationReason;
        delete row.violationAt;
        delete row.violationSchema;
        delete row.violationTimestamp;
      }

      return row;
    });
}

function applyParticipantPatches(
  existingList: unknown,
  patchesInput: unknown
): Record<string, any>[] {
  const baseList: Record<string, any>[] = Array.isArray(existingList)
    ? existingList
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({ ...(item as Record<string, any>) }))
    : [];

  const patches = (
    Array.isArray(patchesInput) ? patchesInput : [patchesInput]
  ).filter((p) => p && typeof p === 'object') as Record<string, any>[];

  for (const patch of patches) {
    const patchUser = String(patch.username || '')
      .trim()
      .toUpperCase();
    const patchId = String(patch.id || '').trim();
    if (!patchUser && !patchId) continue;

    const matchIndex = baseList.findIndex((row) => {
      const rowUser = String(row.username || '')
        .trim()
        .toUpperCase();
      const rowId = String(row.id || '').trim();
      return (
        (patchId && rowId === patchId) || (patchUser && rowUser === patchUser)
      );
    });

    if (matchIndex !== -1) {
      const target = { ...baseList[matchIndex] };
      for (const [key, val] of Object.entries(patch)) {
        if (val === undefined || val === null) {
          delete target[key];
        } else {
          target[key] = val;
        }
      }
      baseList[matchIndex] = target;
    } else if (patchUser && patch.namaPeserta) {
      // Only append if the list is currently empty (do not pollute 135 uploaded rows with unknown demo rows)
      if (baseList.length === 0) {
        baseList.push({
          id: patchId || `p_${Date.now()}`,
          selected: false,
          status: patch.status || 'Active',
          kodeTes: patch.kodeTes || 'SAS26SMADIP1',
          username: patchUser,
          namaPeserta: patch.namaPeserta,
          kelompok: patch.kelompok || '1',
          kelas: patch.kelas || 'X',
          loginState: patch.loginState || 'Belum Login',
          requestReset: Boolean(patch.requestReset),
          ...patch,
        });
      }
    }
  }

  return sanitizeParticipantsList(baseList, existingList);
}

function resolveIncomingParticipants(
  incomingList: unknown,
  existingList: unknown,
  deletedIdsInput?: unknown,
  forceReplace?: boolean
): Record<string, any>[] | undefined {
  const hasExisting = Array.isArray(existingList) && existingList.length > 0;
  const hasIncoming = Array.isArray(incomingList) && incomingList.length > 0;

  if (!hasIncoming) {
    return hasExisting
      ? sanitizeParticipantsList(existingList)
      : undefined;
  }

  const existingIsReal =
    hasExisting && !isDefaultDemoParticipantsList(existingList);
  const incomingIsDemo = isDefaultDemoParticipantsList(incomingList);

  // CRITICAL GUARD 1: Never allow the 8 default demo students to overwrite real uploaded/added students
  if (existingIsReal && incomingIsDemo) {
    return sanitizeParticipantsList(existingList);
  }

  const deletedIds = new Set<string>(
    Array.isArray(deletedIdsInput)
      ? deletedIdsInput.map((id) => String(id || '').trim()).filter(Boolean)
      : []
  );

  const sanitizedIncoming = sanitizeParticipantsList(
    incomingList,
    existingList
  );

  if (!hasExisting || !existingIsReal) {
    return sanitizedIncoming;
  }

  // CRITICAL GUARD 2: Preserve any uploaded/custom students in existingList that were not explicitly deleted
  // so an un-synced tab or partial list never drops existing uploaded classes
  const incomingById = new Map<string, Record<string, any>>();
  const incomingByUser = new Map<string, Record<string, any>>();

  for (const row of sanitizedIncoming) {
    const id = String(row.id || '').trim();
    const user = String(row.username || '')
      .trim()
      .toUpperCase();
    if (id) incomingById.set(id, row);
    if (user) incomingByUser.set(user, row);
  }

  const sanitizedExisting = sanitizeParticipantsList(existingList);

  // If incoming has fewer students than existing and did not explicitly delete the difference,
  // merge missing existing custom rows so data count never unexpectedly drops
  const preservedMissingExisting: Record<string, any>[] = [];
  for (const existRow of sanitizedExisting) {
    const existId = String(existRow.id || '').trim();
    const existUser = String(existRow.username || '')
      .trim()
      .toUpperCase();

    if (existId && deletedIds.has(existId)) {
      continue;
    }

    const foundInIncoming =
      (existId && incomingById.has(existId)) ||
      (existUser && incomingByUser.has(existUser));

    if (!foundInIncoming && isCustomUploadedRow(existRow)) {
      preservedMissingExisting.push(existRow);
    }
  }

  if (preservedMissingExisting.length > 0 && !forceReplace) {
    return [...sanitizedIncoming, ...preservedMissingExisting];
  }

  // Even when forceReplace is true (e.g. Admin action), if deletedIds is empty and incoming suddenly dropped >50% of custom rows,
  // still preserve the missing custom rows to prevent unhydrated admin tab accidents
  if (
    preservedMissingExisting.length > 0 &&
    deletedIds.size === 0 &&
    sanitizedIncoming.length < sanitizedExisting.length
  ) {
    return [...sanitizedIncoming, ...preservedMissingExisting];
  }

  return sanitizedIncoming;
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
    if (data && Array.isArray(data.participants)) {
      data = {
        ...data,
        participants: sanitizeParticipantsList(data.participants),
      };
    }
    return res.status(200).json({
      ok: true,
      engine,
      updatedAt:
        typeof data?.updatedAt === 'number' ? data.updatedAt : undefined,
      data: data || null,
    });
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const existing =
        (kv ? await readFromVercelKV(kv) : null) ||
        readFromFileOrMemory() ||
        {};

      // Ignore writes from stale un-refreshed browser tabs running older bundle versions
      if (body.schemaVersion !== 3) {
        const cleanExisting =
          existing && Array.isArray(existing.participants)
            ? {
                ...existing,
                participants: sanitizeParticipantsList(existing.participants),
              }
            : existing;
        return res.status(200).json({
          ok: true,
          engine,
          updatedAt: cleanExisting.updatedAt || Date.now(),
          data: cleanExisting,
        });
      }

      let nextParticipants: Record<string, any>[] | undefined;

      if (body.participantPatch !== undefined) {
        nextParticipants = applyParticipantPatches(
          existing.participants,
          body.participantPatch
        );
      } else if (Array.isArray(body.participants)) {
        nextParticipants = resolveIncomingParticipants(
          body.participants,
          existing.participants,
          body.deletedParticipantIds,
          Boolean(body.forceReplaceParticipants)
        );
      } else if (Array.isArray(existing.participants)) {
        nextParticipants = sanitizeParticipantsList(existing.participants);
      }

      let nextSchedules: Record<string, any>[] | undefined;
      if (Array.isArray(body.schedules)) {
        nextSchedules = resolveIncomingSchedules(
          body.schedules,
          existing.schedules,
          Boolean(body.forceReplaceSchedules)
        );
      } else if (Array.isArray(existing.schedules)) {
        nextSchedules = existing.schedules as Record<string, any>[];
      }

      // Strip transient transport keys before persisting
      const {
        participantPatch: _ignorePatch,
        deletedParticipantIds: _ignoreDeleted,
        forceReplaceParticipants: _ignoreForce,
        forceReplaceSchedules: _ignoreForceSchedules,
        ...cleanBody
      } = body as Record<string, unknown>;

      const merged: Record<string, unknown> = {
        ...existing,
        ...cleanBody,
        ...(nextSchedules !== undefined ? { schedules: nextSchedules } : {}),
        ...(nextParticipants !== undefined
          ? { participants: nextParticipants }
          : {}),
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
