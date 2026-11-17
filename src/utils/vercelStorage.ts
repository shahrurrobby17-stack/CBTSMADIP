import {
  AdminScheduleItem,
  ExamPackage,
  ExamResultSummary,
} from '../types/cbt';
import { ProctorParticipantRow } from '../components/ProctorDashboardView';
import { AdminProctorItem } from '../components/AdminViews';

export interface CBTCloudPayload {
  packages?: ExamPackage[];
  deletedPackageIds?: string[];
  forceReplacePackages?: boolean;
  packagesUpdatedAt?: number;
  schedules?: AdminScheduleItem[];
  deletedScheduleIds?: string[];
  forceReplaceSchedules?: boolean;
  schedulesUpdatedAt?: number;
  participants?: ProctorParticipantRow[];
  participantPatch?: Partial<ProctorParticipantRow> | Partial<ProctorParticipantRow>[];
  deletedParticipantIds?: string[];
  forceReplaceParticipants?: boolean;
  proctors?: AdminProctorItem[];
  activeToken?: string;
  tokenUpdatedAt?: number;
  forceTokenUpdate?: boolean;
  resultsHistory?: ExamResultSummary[];
  resultAppend?: ExamResultSummary;
  resultsClearedAt?: number;
  adminSettings?: Record<string, unknown> & { updatedAt?: number };
  updatedAt?: number;
  schemaVersion?: number;
}

export interface VercelStorageResponse {
  ok: boolean;
  engine: 'vercel-kv' | 'vercel-serverless' | 'local';
  updatedAt?: number;
  unchanged?: boolean;
  rateLimited?: boolean;
  status?: number;
  data: CBTCloudPayload | null;
}

let cooldownUntilMs = 0;
let consecutiveThrottleCount = 0;

function markThrottleBackoff(status: number): void {
  if (status === 403 || status === 429 || status === 503) {
    consecutiveThrottleCount = Math.min(consecutiveThrottleCount + 1, 4);
    const baseMs = 30_000 * Math.pow(2, consecutiveThrottleCount - 1); // 30s, 60s, 120s, 240s
    const jitterMs = Math.floor(Math.random() * 10_000);
    cooldownUntilMs = Date.now() + Math.min(240_000, baseMs) + jitterMs;
  }
}

function clearThrottleBackoff(): void {
  consecutiveThrottleCount = 0;
  cooldownUntilMs = 0;
}

export function isCloudSyncCoolingDown(): boolean {
  return Date.now() < cooldownUntilMs;
}

export async function fetchVercelStorage(options?: {
  since?: number;
  force?: boolean;
}): Promise<VercelStorageResponse> {
  if (!options?.force && Date.now() < cooldownUntilMs) {
    return {
      ok: false,
      engine: 'local',
      rateLimited: true,
      data: null,
    };
  }

  try {
    const sinceQuery =
      typeof options?.since === 'number' && options.since > 0
        ? `?since=${Math.floor(options.since)}`
        : '';
    const res = await fetch(`/api/storage${sinceQuery}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      if (res.status === 403 || res.status === 429 || res.status === 503) {
        markThrottleBackoff(res.status);
        return {
          ok: false,
          engine: 'local',
          rateLimited: true,
          status: res.status,
          data: null,
        };
      }
      return { ok: false, engine: 'local', status: res.status, data: null };
    }
    clearThrottleBackoff();
    const json = (await res.json()) as VercelStorageResponse;
    return json;
  } catch {
    return { ok: false, engine: 'local', data: null };
  }
}

export async function saveVercelStorage(
  payload: Partial<CBTCloudPayload>
): Promise<VercelStorageResponse> {
  try {
    const res = await fetch('/api/storage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        schemaVersion: 3,
      }),
    });
    if (!res.ok) {
      if (res.status === 403 || res.status === 429 || res.status === 503) {
        markThrottleBackoff(res.status);
        return {
          ok: false,
          engine: 'local',
          rateLimited: true,
          status: res.status,
          data: null,
        };
      }
      return { ok: false, engine: 'local', status: res.status, data: null };
    }
    clearThrottleBackoff();
    const json = (await res.json()) as VercelStorageResponse;
    return json;
  } catch {
    return { ok: false, engine: 'local', data: null };
  }
}
