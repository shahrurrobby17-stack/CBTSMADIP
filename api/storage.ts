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
  'sch1',
  'sch2',
  'sch3',
  'sch4',
  'sch5',
  'sch_1',
  'sch_2',
  'sch_3',
  'sch_4',
  'sch_5',
  's1',
  's2',
  's3',
  's4',
  's5',
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
  deletedScheduleIdsInput?: unknown,
  forceReplace?: boolean
): Record<string, any>[] | undefined {
  const hasExisting = Array.isArray(existingList) && existingList.length > 0;
  const hasIncoming = Array.isArray(incomingList) && incomingList.length > 0;

  if (!hasIncoming) {
    return hasExisting ? (existingList as Record<string, any>[]) : undefined;
  }

  const deletedIds = new Set<string>(
    Array.isArray(deletedScheduleIdsInput)
      ? deletedScheduleIdsInput
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      : []
  );

  const existingHasActiveOrCustom =
    hasExisting && !isDefaultInactiveSchedulesList(existingList);
  const incomingIsDefaultInactive = isDefaultInactiveSchedulesList(incomingList);
  const incomingHasAnyTimestamp =
    hasIncoming &&
    (incomingList as any[]).some(
      (s) => s && typeof s === 'object' && typeof s.updatedAt === 'number' && s.updatedAt > 0
    );

  // Never allow an unhydrated tab's default inactive schedules (with no updatedAt timestamp) to wipe out active schedules or custom schedules
  if (
    existingHasActiveOrCustom &&
    incomingIsDefaultInactive &&
    (!forceReplace || !incomingHasAnyTimestamp)
  ) {
    return existingList as Record<string, any>[];
  }

  if (hasExisting) {
    const existingById = new Map<string, Record<string, any>>();
    const customExistingRows: Record<string, any>[] = [];
    const incomingIds = new Set<string>(
      (incomingList as any[])
        .filter((s) => s && typeof s === 'object')
        .map((s) => String(s.id || '').trim())
    );

    for (const row of existingList as any[]) {
      if (!row || typeof row !== 'object') continue;
      const id = String(row.id || '').trim();
      if (!id || deletedIds.has(id)) continue;

      existingById.set(id, row);
      // Preserve custom schedules (sch_...) that were not explicitly deleted
      if (!DEFAULT_DEMO_SCHEDULE_IDS.has(id) && !incomingIds.has(id)) {
        customExistingRows.push(row);
      }
    }

    const merged = (incomingList as any[])
      .filter((s) => {
        if (!s || typeof s !== 'object') return false;
        const id = String(s.id || '').trim();
        return !id || !deletedIds.has(id);
      })
      .map((s) => {
        const id = String(s.id || '').trim();
        const existRow = id ? existingById.get(id) : undefined;
        if (!existRow) return s;

        const incTs = typeof s.updatedAt === 'number' ? s.updatedAt : 0;
        const existTs =
          typeof existRow.updatedAt === 'number' ? existRow.updatedAt : 0;

        if (incTs > 0 || existTs > 0) {
          if (existTs > incTs) {
            return existRow;
          }
          return s;
        }

        if (!forceReplace && existRow.isActive) {
          return { ...s, isActive: true };
        }
        return s;
      });

    return [...merged, ...customExistingRows];
  }

  return (incomingList as any[]).filter((s) => {
    if (!s || typeof s !== 'object') return false;
    const id = String(s.id || '').trim();
    return !id || !deletedIds.has(id);
  });
}

function getPackageMatchKey(pkg: Record<string, any>): string {
  const title = String(pkg.title || '')
    .replace(/^Simulasi TKA\s*-\s*/i, '')
    .trim()
    .toLowerCase();
  const targetClass = normalizeServerKelas(pkg.targetClass || '');
  return `${title}__${targetClass}`;
}

function resolveIncomingPackages(
  incomingList: unknown,
  existingList: unknown,
  deletedPackageIdsInput?: unknown,
  forceReplace?: boolean
): Record<string, any>[] | undefined {
  const hasExisting = Array.isArray(existingList) && existingList.length > 0;
  const hasIncoming = Array.isArray(incomingList) && incomingList.length > 0;

  if (!hasIncoming) {
    return hasExisting ? (existingList as Record<string, any>[]) : undefined;
  }
  if (!hasExisting) {
    return incomingList as Record<string, any>[];
  }

  const deletedSet = new Set<string>(
    Array.isArray(deletedPackageIdsInput)
      ? deletedPackageIdsInput
          .map((id) => String(id || '').trim().toUpperCase())
          .filter(Boolean)
      : []
  );

  const existingById = new Map<string, Record<string, any>>();
  const existingByCode = new Map<string, Record<string, any>>();
  const existingByTitleClass = new Map<string, Record<string, any>>();

  for (const item of existingList as any[]) {
    if (!item || typeof item !== 'object') continue;
    const id = String(item.id || '').trim();
    const code = String(item.code || '')
      .trim()
      .toUpperCase();
    const tk = getPackageMatchKey(item);
    if (id) existingById.set(id, item);
    if (code) existingByCode.set(code, item);
    if (tk) existingByTitleClass.set(tk, item);
  }

  const matchedExistingIds = new Set<string>();
  const mergedIncoming = (incomingList as any[])
    .filter((pkg) => pkg && typeof pkg === 'object')
    .map((pkg) => {
      const id = String(pkg.id || '').trim();
      const code = String(pkg.code || '')
        .trim()
        .toUpperCase();
      const tk = getPackageMatchKey(pkg);

      const existMatch =
        (id ? existingById.get(id) : undefined) ||
        (code ? existingByCode.get(code) : undefined) ||
        (tk ? existingByTitleClass.get(tk) : undefined);

      if (existMatch) {
        const existId = String(existMatch.id || '').trim();
        if (existId) matchedExistingIds.add(existId);

        const incQuestions = Array.isArray(pkg.questions)
          ? pkg.questions.filter(
              (q: any) => !String(q?.id || '').startsWith('q_default_')
            )
          : [];
        const existQuestions = Array.isArray(existMatch.questions)
          ? existMatch.questions.filter(
              (q: any) => !String(q?.id || '').startsWith('q_default_')
            )
          : [];

        // NEVER allow a 0-question package from a student/unhydrated browser to wipe out uploaded questions
        // unless the Admin explicitly deleted questions (forceReplace === true)
        if (
          !forceReplace &&
          existQuestions.length > 0 &&
          incQuestions.length < existQuestions.length
        ) {
          return {
            ...pkg,
            questions: existQuestions,
          };
        }
      }
      return pkg;
    });

  // Also preserve any existing packages that have uploaded questions (or custom packages) and were not deleted
  const preservedExisting: Record<string, any>[] = [];
  for (const existPkg of existingList as any[]) {
    if (!existPkg || typeof existPkg !== 'object') continue;
    const existId = String(existPkg.id || '').trim();
    const existCode = String(existPkg.code || '')
      .trim()
      .toUpperCase();
    if (
      (existId && deletedSet.has(existId.toUpperCase())) ||
      (existCode && deletedSet.has(existCode))
    ) {
      continue;
    }
    if (existId && matchedExistingIds.has(existId)) {
      continue;
    }
    const tk = getPackageMatchKey(existPkg);
    const alreadyInMerged = mergedIncoming.some((m) => {
      const mCode = String(m.code || '')
        .trim()
        .toUpperCase();
      return (
        (existCode && mCode === existCode) ||
        (tk && getPackageMatchKey(m) === tk)
      );
    });
    if (alreadyInMerged) continue;

    const existQuestions = Array.isArray(existPkg.questions)
      ? existPkg.questions.filter(
          (q: any) => !String(q?.id || '').startsWith('q_default_')
        )
      : [];
    if (existQuestions.length > 0 || !forceReplace) {
      preservedExisting.push(existPkg);
    }
  }

  return [...mergedIncoming, ...preservedExisting];
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

function normalizeServerKelas(raw?: unknown): string {
  if (typeof raw !== 'string' || !raw) return '';
  const s = raw
    .replace(/^kelas\s+/i, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (!s) return '';
  if (/^XII\b/.test(s)) {
    if (s.includes('IPS')) return 'XII IPS';
    if (s.includes('IPA') || s.includes('MIPA')) return 'XII IPA';
    return s;
  }
  if (/^XI\b/.test(s)) {
    if (s.includes('IPS')) return 'XI IPS';
    if (s.includes('IPA') || s.includes('MIPA')) return 'XI IPA';
    return s;
  }
  if (/^X\b/.test(s)) {
    return 'X';
  }
  return s;
}

function getServerParticipantNameKelasKey(row: unknown): string {
  if (!row || typeof row !== 'object') return '';
  const r = row as Record<string, any>;
  const name = String(r.namaPeserta || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
  if (!name) return '';
  const kelas = normalizeServerKelas(r.kelas);
  return `${name}__${kelas}`;
}

function getServerLoginPriority(state?: unknown): number {
  if (state === 'Selesai') return 4;
  if (state === 'Terkunci (Pelanggaran)') return 3;
  if (state === 'Sedang Mengerjakan') return 2;
  return 1;
}

function mergeServerDuplicateRows(
  existing: Record<string, any>,
  incoming: Record<string, any>
): Record<string, any> {
  const existingPriority = getServerLoginPriority(existing.loginState);
  const incomingPriority = getServerLoginPriority(incoming.loginState);
  const existingDraftCount =
    existing.draftAnswers && typeof existing.draftAnswers === 'object'
      ? Object.keys(existing.draftAnswers).length
      : 0;
  const incomingDraftCount =
    incoming.draftAnswers && typeof incoming.draftAnswers === 'object'
      ? Object.keys(incoming.draftAnswers).length
      : 0;

  const existingIsActive =
    String(existing.status || '')
      .trim()
      .toLowerCase() === 'active';
  const incomingIsActive =
    String(incoming.status || '')
      .trim()
      .toLowerCase() === 'active';

  const existMetaTs =
    typeof existing.metaUpdatedAt === 'number' ? existing.metaUpdatedAt : 0;
  const incMetaTs =
    typeof incoming.metaUpdatedAt === 'number' ? incoming.metaUpdatedAt : 0;
  const maxMetaUpdatedAt = Math.max(existMetaTs, incMetaTs);

  const existLoginTs =
    typeof existing.loginUpdatedAt === 'number' ? existing.loginUpdatedAt : 0;
  const incLoginTs =
    typeof incoming.loginUpdatedAt === 'number' ? incoming.loginUpdatedAt : 0;
  const maxLoginUpdatedAt = Math.max(existLoginTs, incLoginTs);

  const existDraftTs =
    typeof existing.draftUpdatedAt === 'number' ? existing.draftUpdatedAt : 0;
  const incDraftTs =
    typeof incoming.draftUpdatedAt === 'number' ? incoming.draftUpdatedAt : 0;
  const maxDraftUpdatedAt = Math.max(existDraftTs, incDraftTs);

  const existViolationTs =
    existing.violationSchema === 3 &&
    typeof existing.violationTimestamp === 'number'
      ? existing.violationTimestamp
      : 0;
  const incViolationTs =
    incoming.violationSchema === 3 &&
    typeof incoming.violationTimestamp === 'number'
      ? incoming.violationTimestamp
      : 0;
  const maxViolationTs = Math.max(existViolationTs, incViolationTs);

  const existResetAt =
    typeof existing.lastResetAt === 'number' ? existing.lastResetAt : 0;
  const incResetAt =
    typeof incoming.lastResetAt === 'number' ? incoming.lastResetAt : 0;
  const maxResetAt = Math.max(existResetAt, incResetAt);

  const preferIncomingIdentity =
    incMetaTs > existMetaTs ||
    incLoginTs > existLoginTs ||
    incViolationTs > existViolationTs ||
    incomingPriority > existingPriority ||
    (incomingPriority === existingPriority &&
      incomingDraftCount > existingDraftCount) ||
    (incomingPriority === existingPriority &&
      !existingIsActive &&
      incomingIsActive);

  const primary = preferIncomingIdentity ? incoming : existing;
  const secondary = preferIncomingIdentity ? existing : incoming;

  let resolvedStatus: string;
  if (incMetaTs !== existMetaTs) {
    resolvedStatus =
      incMetaTs > existMetaTs ? incoming.status : existing.status;
  } else {
    resolvedStatus =
      existingIsActive || incomingIsActive ? 'Active' : primary.status || 'Non Active';
  }

  const existingRuang = String(
    existing.ruang || existing.kelompok || 'Ruang 1'
  ).trim();
  const incomingRuang = String(
    incoming.ruang || incoming.kelompok || 'Ruang 1'
  ).trim();
  let resolvedRuang: string;
  if (incMetaTs !== existMetaTs) {
    resolvedRuang = incMetaTs > existMetaTs ? incomingRuang : existingRuang;
  } else {
    resolvedRuang =
      existingRuang && existingRuang !== 'Ruang 1' && existingRuang !== '1'
        ? existingRuang
        : incomingRuang && incomingRuang !== 'Ruang 1' && incomingRuang !== '1'
        ? incomingRuang
        : primary.ruang || 'Ruang 1';
  }

  const preferIncomingDraft =
    incDraftTs > existDraftTs ||
    (incDraftTs === existDraftTs && incomingDraftCount >= existingDraftCount);
  const draftSource = preferIncomingDraft ? incoming : existing;
  const fallbackDraftSource = preferIncomingDraft ? existing : incoming;

  const bestDraftAnswers =
    draftSource.draftAnswers &&
    typeof draftSource.draftAnswers === 'object' &&
    Object.keys(draftSource.draftAnswers).length > 0
      ? draftSource.draftAnswers
      : fallbackDraftSource.draftAnswers;
  const bestDraftPackageId =
    draftSource.draftPackageId || fallbackDraftSource.draftPackageId;
  const bestDraftRemainingSeconds =
    typeof draftSource.draftRemainingSeconds === 'number'
      ? draftSource.draftRemainingSeconds
      : fallbackDraftSource.draftRemainingSeconds;

  const finishedAfterViolation =
    (existing.loginState === 'Selesai' && existLoginTs > maxViolationTs) ||
    (incoming.loginState === 'Selesai' && incLoginTs > maxViolationTs);

  const isLocked =
    !finishedAfterViolation &&
    maxViolationTs > 0 &&
    maxViolationTs > maxResetAt;

  let resolvedLoginState = 'Belum Login';
  let resolvedRequestReset = false;
  let resolvedViolationReason: string | undefined = undefined;
  let resolvedViolationAt: string | undefined = undefined;
  let resolvedViolationSchema: number | undefined = undefined;
  let resolvedViolationTimestamp: number | undefined = undefined;
  let resolvedViolationCount: number | undefined = undefined;

  if (isLocked) {
    const vSource = incViolationTs >= existViolationTs ? incoming : existing;
    const vFallback = incViolationTs >= existViolationTs ? existing : incoming;
    resolvedLoginState = 'Terkunci (Pelanggaran)';
    resolvedRequestReset = true;
    resolvedViolationSchema = 3;
    resolvedViolationTimestamp = maxViolationTs;
    resolvedViolationReason =
      vSource.violationReason ||
      vFallback.violationReason ||
      'Pelanggaran keamanan ujian CBT';
    resolvedViolationAt = vSource.violationAt || vFallback.violationAt;
    resolvedViolationCount = Math.max(
      typeof existing.violationCount === 'number' ? existing.violationCount : 0,
      typeof incoming.violationCount === 'number' ? incoming.violationCount : 0,
      1
    );
  } else {
    resolvedRequestReset = false;
    if (maxResetAt > 0 && maxResetAt >= maxLoginUpdatedAt) {
      resolvedLoginState = 'Belum Login';
    } else if (maxLoginUpdatedAt > 0) {
      const loginSource = incLoginTs >= existLoginTs ? incoming : existing;
      const loginFallback = incLoginTs >= existLoginTs ? existing : incoming;
      const candidateState =
        loginSource.loginState &&
        loginSource.loginState !== 'Terkunci (Pelanggaran)'
          ? loginSource.loginState
          : loginFallback.loginState &&
            loginFallback.loginState !== 'Terkunci (Pelanggaran)'
          ? loginFallback.loginState
          : 'Belum Login';
      resolvedLoginState = candidateState;
    } else {
      const candidateA =
        incoming.loginState === 'Terkunci (Pelanggaran)'
          ? 'Belum Login'
          : incoming.loginState || 'Belum Login';
      const candidateB =
        existing.loginState === 'Terkunci (Pelanggaran)'
          ? 'Belum Login'
          : existing.loginState || 'Belum Login';
      resolvedLoginState =
        getServerLoginPriority(candidateA) >= getServerLoginPriority(candidateB)
          ? candidateA
          : candidateB;
    }
    const maxVCount = Math.max(
      typeof existing.violationCount === 'number' ? existing.violationCount : 0,
      typeof incoming.violationCount === 'number' ? incoming.violationCount : 0
    );
    if (resolvedLoginState === 'Selesai') {
      resolvedViolationCount = 0;
    } else if (maxVCount > 0) {
      resolvedViolationCount = maxVCount;
    }
  }

  const result: Record<string, any> = {
    ...secondary,
    ...primary,
    id: primary.id || secondary.id,
    username: primary.username || secondary.username,
    password: primary.password || secondary.password,
    status: resolvedStatus,
    ruang: resolvedRuang,
    kelompok:
      resolvedRuang !== 'Ruang 1'
        ? resolvedRuang
        : primary.kelompok || secondary.kelompok || 'Ruang 1',
    loginState: resolvedLoginState,
    requestReset: resolvedRequestReset,
  };

  if (isLocked) {
    result.violationReason = resolvedViolationReason;
    result.violationAt = resolvedViolationAt;
    result.violationSchema = resolvedViolationSchema;
    result.violationTimestamp = resolvedViolationTimestamp;
    result.violationCount = resolvedViolationCount;
  } else {
    delete result.violationReason;
    delete result.violationAt;
    delete result.violationSchema;
    delete result.violationTimestamp;
    if (resolvedViolationCount !== undefined) {
      result.violationCount = resolvedViolationCount;
    } else {
      delete result.violationCount;
    }
  }

  if (resolvedLoginState === 'Selesai') {
    delete result.draftAnswers;
    delete result.draftPackageId;
    delete result.draftRemainingSeconds;
  } else {
    if (bestDraftAnswers) result.draftAnswers = bestDraftAnswers;
    if (bestDraftPackageId) result.draftPackageId = bestDraftPackageId;
    if (typeof bestDraftRemainingSeconds === 'number') {
      result.draftRemainingSeconds = bestDraftRemainingSeconds;
    }
  }

  if (maxResetAt > 0) result.lastResetAt = maxResetAt;
  if (maxLoginUpdatedAt > 0) result.loginUpdatedAt = maxLoginUpdatedAt;
  if (maxMetaUpdatedAt > 0) result.metaUpdatedAt = maxMetaUpdatedAt;
  if (maxDraftUpdatedAt > 0) result.draftUpdatedAt = maxDraftUpdatedAt;

  return result;
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

  const existingById = new Map<string, Record<string, any>>();
  const existingByUser = new Map<string, Record<string, any>>();
  const existingByNameKelas = new Map<string, Record<string, any>>();
  if (Array.isArray(existingList)) {
    for (const item of existingList) {
      if (item && typeof item === 'object') {
        const id = String((item as any).id || '').trim();
        if (id) existingById.set(id, item as Record<string, any>);
        const u = String((item as any).username || '')
          .trim()
          .toUpperCase();
        if (u) existingByUser.set(u, item as Record<string, any>);
        const nk = getServerParticipantNameKelasKey(item);
        if (nk) existingByNameKelas.set(nk, item as Record<string, any>);
      }
    }
  }

  const normalizedList = baseList
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const rawRow = { ...(item as Record<string, any>) };
      const cleanId = String(rawRow.id || '').trim();
      const cleanUser =
        typeof rawRow.username === 'string'
          ? rawRow.username.trim().toUpperCase()
          : '';
      const nk = getServerParticipantNameKelasKey(rawRow);
      const prevRow =
        (cleanUser ? existingByUser.get(cleanUser) : undefined) ||
        (cleanId ? existingById.get(cleanId) : undefined) ||
        (nk ? existingByNameKelas.get(nk) : undefined);

      // Reconcile against prevRow using CRDT timestamps so neither violations nor resets are ever lost
      const row = prevRow
        ? mergeServerDuplicateRows(prevRow, rawRow)
        : rawRow;

      const maxResetAt =
        typeof row.lastResetAt === 'number' ? row.lastResetAt : 0;
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

  // Deduplicate by (namaPeserta + kelas) and by username
  const dedupedList: Record<string, any>[] = [];
  const indexByNameKelas = new Map<string, number>();
  const indexByUsername = new Map<string, number>();

  for (const row of normalizedList) {
    const nameKelasKey = getServerParticipantNameKelasKey(row);
    const userKey = String(row.username || '')
      .trim()
      .toUpperCase();

    const existingIdxByName =
      nameKelasKey && indexByNameKelas.has(nameKelasKey)
        ? indexByNameKelas.get(nameKelasKey)
        : undefined;
    const existingIdxByUser =
      userKey && indexByUsername.has(userKey)
        ? indexByUsername.get(userKey)
        : undefined;

    const matchIdx =
      existingIdxByName !== undefined ? existingIdxByName : existingIdxByUser;

    if (matchIdx !== undefined) {
      const merged = mergeServerDuplicateRows(dedupedList[matchIdx], row);
      dedupedList[matchIdx] = merged;
      const mergedNameKey = getServerParticipantNameKelasKey(merged);
      const mergedUserKey = String(merged.username || '')
        .trim()
        .toUpperCase();
      if (mergedNameKey) indexByNameKelas.set(mergedNameKey, matchIdx);
      if (mergedUserKey) indexByUsername.set(mergedUserKey, matchIdx);
    } else {
      const newIdx = dedupedList.length;
      dedupedList.push(row);
      if (nameKelasKey) indexByNameKelas.set(nameKelasKey, newIdx);
      if (userKey) indexByUsername.set(userKey, newIdx);
    }
  }

  return dedupedList;
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
      const existingRow = baseList[matchIndex];
      const patchedCandidate = { ...existingRow };
      for (const [key, val] of Object.entries(patch)) {
        if (val === undefined || val === null) {
          delete patchedCandidate[key];
        } else {
          patchedCandidate[key] = val;
        }
      }
      baseList[matchIndex] = mergeServerDuplicateRows(
        existingRow,
        patchedCandidate
      );
    } else if (patchUser && patch.namaPeserta) {
      // Only append if the list is currently empty (do not pollute uploaded rows with unknown demo rows)
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
  const incomingByNameKelas = new Map<string, Record<string, any>>();

  for (const row of sanitizedIncoming) {
    const id = String(row.id || '').trim();
    const user = String(row.username || '')
      .trim()
      .toUpperCase();
    const nk = getServerParticipantNameKelasKey(row);
    if (id) incomingById.set(id, row);
    if (user) incomingByUser.set(user, row);
    if (nk) incomingByNameKelas.set(nk, row);
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
    const existNk = getServerParticipantNameKelasKey(existRow);

    if (existId && deletedIds.has(existId)) {
      continue;
    }

    const foundInIncoming =
      (existId && incomingById.has(existId)) ||
      (existUser && incomingByUser.has(existUser)) ||
      (existNk && incomingByNameKelas.has(existNk));

    if (!foundInIncoming && isCustomUploadedRow(existRow)) {
      preservedMissingExisting.push(existRow);
    }
  }

  if (preservedMissingExisting.length > 0 && !forceReplace) {
    return sanitizeParticipantsList(
      [...sanitizedIncoming, ...preservedMissingExisting],
      existingList
    );
  }

  // Even when forceReplace is true (e.g. Admin action), if deletedIds is empty and incoming suddenly dropped >50% of custom rows,
  // still preserve the missing custom rows to prevent unhydrated admin tab accidents
  if (
    preservedMissingExisting.length > 0 &&
    deletedIds.size === 0 &&
    sanitizedIncoming.length < sanitizedExisting.length
  ) {
    return sanitizeParticipantsList(
      [...sanitizedIncoming, ...preservedMissingExisting],
      existingList
    );
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

    let sinceParam = 0;
    try {
      const rawSince =
        req.query?.since ??
        (typeof req.url === 'string' && req.url.includes('since=')
          ? new URL(req.url, 'http://localhost').searchParams.get('since')
          : undefined);
      const parsedSince = Number(rawSince);
      if (Number.isFinite(parsedSince) && parsedSince > 0) {
        sinceParam = parsedSince;
      }
    } catch {
      sinceParam = 0;
    }

    // Only skip full payload when server updatedAt matches client's since timestamp exactly.
    // If server updatedAt < since (stale serverless instance), return full data so Admin/Proctor can heal it.
    if (
      sinceParam > 0 &&
      data &&
      typeof data.updatedAt === 'number' &&
      data.updatedAt === sinceParam
    ) {
      return res.status(200).json({
        ok: true,
        engine,
        updatedAt: data.updatedAt,
        unchanged: true,
        data: null,
      });
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

      const combinedDeletedParticipantIds = Array.from(
        new Set([
          ...(Array.isArray(existing.deletedParticipantIds)
            ? existing.deletedParticipantIds
            : []),
          ...(Array.isArray(body.deletedParticipantIds)
            ? body.deletedParticipantIds
            : []),
        ])
      );

      const combinedDeletedScheduleIds = Array.from(
        new Set([
          ...(Array.isArray(existing.deletedScheduleIds)
            ? existing.deletedScheduleIds
            : []),
          ...(Array.isArray(body.deletedScheduleIds)
            ? body.deletedScheduleIds
            : []),
        ])
      );

      const combinedDeletedPackageIds = Array.from(
        new Set([
          ...(Array.isArray(existing.deletedPackageIds)
            ? existing.deletedPackageIds
            : []),
          ...(Array.isArray(body.deletedPackageIds)
            ? body.deletedPackageIds
            : []),
        ])
      );

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
          combinedDeletedParticipantIds,
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
          combinedDeletedScheduleIds,
          Boolean(body.forceReplaceSchedules)
        );
      } else if (Array.isArray(existing.schedules)) {
        nextSchedules = existing.schedules as Record<string, any>[];
      }

      let nextPackages: Record<string, any>[] | undefined;
      if (Array.isArray(body.packages)) {
        nextPackages = resolveIncomingPackages(
          body.packages,
          existing.packages,
          combinedDeletedPackageIds,
          Boolean(body.forceReplacePackages)
        );
      } else if (Array.isArray(existing.packages)) {
        nextPackages = existing.packages as Record<string, any>[];
      }

      const existResultsClearedAt =
        typeof existing.resultsClearedAt === 'number'
          ? existing.resultsClearedAt
          : 0;
      const incResultsClearedAt =
        typeof body.resultsClearedAt === 'number' ? body.resultsClearedAt : 0;
      const resolvedResultsClearedAt = Math.max(
        existResultsClearedAt,
        incResultsClearedAt
      );

      let nextResultsHistory: Record<string, any>[] | undefined;
      if (incResultsClearedAt > 0 && incResultsClearedAt >= existResultsClearedAt) {
        nextResultsHistory = [];
      } else {
        const baseExistingHistory = Array.isArray(existing.resultsHistory)
          ? (existing.resultsHistory as Record<string, any>[])
          : [];
        const incomingHistory = Array.isArray(body.resultsHistory)
          ? (body.resultsHistory as Record<string, any>[])
          : [];
        const appendedItem =
          body.resultAppend && typeof body.resultAppend === 'object'
            ? (body.resultAppend as Record<string, any>)
            : null;

        if (appendedItem || incomingHistory.length > 0 || baseExistingHistory.length > 0) {
          const seenIds = new Set<string>();
          const combinedHistory: Record<string, any>[] = [];
          const candidates = [
            ...(appendedItem ? [appendedItem] : []),
            ...incomingHistory,
            ...baseExistingHistory,
          ];
          for (const item of candidates) {
            if (!item || typeof item !== 'object') continue;
            const id = String((item as any).id || '').trim();
            if (id && seenIds.has(id)) continue;
            if (id) seenIds.add(id);
            combinedHistory.push(item);
          }
          nextResultsHistory = combinedHistory;
        }
      }

      // Resolve activeToken by tokenUpdatedAt so stale instances never revert token rotation,
      // and guard against two dashboards double-rotating automatically within 30 seconds
      const existTokenTs =
        typeof existing.tokenUpdatedAt === 'number'
          ? existing.tokenUpdatedAt
          : 0;
      const incTokenTs =
        typeof body.tokenUpdatedAt === 'number' ? body.tokenUpdatedAt : 0;
      let resolvedActiveToken = existing.activeToken;
      let resolvedTokenUpdatedAt = existTokenTs;
      if (typeof body.activeToken === 'string' && body.activeToken.trim()) {
        const cleanIncToken = body.activeToken.trim().toUpperCase();
        const isDuplicateAutoRotate =
          !body.forceTokenUpdate &&
          Boolean(existing.activeToken) &&
          existTokenTs > 0 &&
          incTokenTs > 0 &&
          Math.abs(incTokenTs - existTokenTs) < 30_000 &&
          cleanIncToken !== String(existing.activeToken).trim().toUpperCase();

        if (!isDuplicateAutoRotate && (incTokenTs >= existTokenTs || !existing.activeToken)) {
          resolvedActiveToken = cleanIncToken;
          resolvedTokenUpdatedAt = Math.max(incTokenTs, existTokenTs, Date.now());
        }
      }

      // Resolve adminSettings (deleted/custom mapel config) by updatedAt timestamp
      const existAdminSettings =
        existing.adminSettings && typeof existing.adminSettings === 'object'
          ? (existing.adminSettings as Record<string, any>)
          : undefined;
      const incAdminSettings =
        body.adminSettings && typeof body.adminSettings === 'object'
          ? (body.adminSettings as Record<string, any>)
          : undefined;
      let resolvedAdminSettings = existAdminSettings;
      if (incAdminSettings) {
        const existCfgTs =
          typeof existAdminSettings?.updatedAt === 'number'
            ? existAdminSettings.updatedAt
            : 0;
        const incCfgTs =
          typeof incAdminSettings.updatedAt === 'number'
            ? incAdminSettings.updatedAt
            : 0;
        if (!existAdminSettings || incCfgTs >= existCfgTs) {
          resolvedAdminSettings = {
            ...incAdminSettings,
            updatedAt: Math.max(incCfgTs, Date.now()),
          };
        }
      }

      // Strip transient transport keys before persisting
      const {
        participantPatch: _ignorePatch,
        forceReplaceParticipants: _ignoreForce,
        forceReplaceSchedules: _ignoreForceSchedules,
        forceReplacePackages: _ignoreForcePackages,
        resultAppend: _ignoreResultAppend,
        forceTokenUpdate: _ignoreForceToken,
        ...cleanBody
      } = body as Record<string, unknown>;

      const merged: Record<string, unknown> = {
        ...existing,
        ...cleanBody,
        ...(resolvedActiveToken
          ? {
              activeToken: resolvedActiveToken,
              tokenUpdatedAt: resolvedTokenUpdatedAt,
            }
          : {}),
        ...(resolvedAdminSettings
          ? { adminSettings: resolvedAdminSettings }
          : {}),
        ...(nextPackages !== undefined ? { packages: nextPackages } : {}),
        ...(nextSchedules !== undefined ? { schedules: nextSchedules } : {}),
        ...(nextParticipants !== undefined
          ? { participants: nextParticipants }
          : {}),
        ...(nextResultsHistory !== undefined
          ? { resultsHistory: nextResultsHistory }
          : {}),
        ...(resolvedResultsClearedAt > 0
          ? { resultsClearedAt: resolvedResultsClearedAt }
          : {}),
        deletedParticipantIds: combinedDeletedParticipantIds,
        deletedScheduleIds: combinedDeletedScheduleIds,
        deletedPackageIds: combinedDeletedPackageIds,
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
