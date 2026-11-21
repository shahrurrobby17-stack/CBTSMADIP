import {
  AdminScheduleItem,
  ExamPackage,
  ExamResultSummary,
  ParticipantProfile,
  StudentAnswer,
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
  participantPatch?:
    | Partial<ProctorParticipantRow>
    | Partial<ProctorParticipantRow>[];
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
  error?: string;
  data: CBTCloudPayload | null;
}

export interface AuthLoginRequest {
  role: 'admin' | 'proctor' | 'student';
  username: string;
  password: string;
  encryptionCode?: string;
}

export interface AuthLoginResponse {
  ok: boolean;
  status?: number;
  serverEmpty?: boolean;
  networkError?: boolean;
  error?: string;
  reason?: string;
  token?: string;
  role?: 'admin' | 'proctor' | 'student';
  account?: Record<string, any>;
}

export interface VerifyExamEntryResponse {
  ok: boolean;
  networkError?: boolean;
  status?: number;
  error?: string;
  reason?: 'non_active' | 'locked' | 'invalid_token' | 'no_schedule' | 'unauthorized';
  schedule?: AdminScheduleItem;
  participantStatus?: 'Active' | 'Non Active';
}

export interface SubmitExamServerResponse {
  ok: boolean;
  engine?: 'vercel-kv' | 'vercel-serverless' | 'local';
  networkError?: boolean;
  fallbackClientGrade?: boolean;
  status?: number;
  error?: string;
  updatedAt?: number;
  summary?: ExamResultSummary;
}

// Keep Bearer session token strictly in JS memory (never in localStorage/sessionStorage)
let authSessionToken: string | null = null;
let authSessionRole: 'admin' | 'proctor' | 'student' | null = null;

export function setAuthSessionToken(
  token: string | null,
  role?: 'admin' | 'proctor' | 'student' | null
): void {
  authSessionToken = token && token.trim() ? token.trim() : null;
  authSessionRole = authSessionToken ? role || authSessionRole : null;
}

export function getAuthSessionRole(): 'admin' | 'proctor' | 'student' | null {
  return authSessionToken ? authSessionRole : null;
}

export function clearAuthSessionToken(): void {
  authSessionToken = null;
  authSessionRole = null;
}

function buildAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Accept: 'application/json',
    ...(authSessionToken ? { Authorization: `Bearer ${authSessionToken}` } : {}),
    ...(extra || {}),
  };
}

let cooldownUntilMs = 0;
let consecutiveThrottleCount = 0;

function markThrottleBackoff(status: number): void {
  if (status === 403 || status === 429 || status === 503) {
    consecutiveThrottleCount = Math.min(consecutiveThrottleCount + 1, 4);
    const baseMs = 30_000 * Math.pow(2, consecutiveThrottleCount - 1);
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

export async function authenticateWithServer(
  req: AuthLoginRequest
): Promise<AuthLoginResponse> {
  try {
    const res = await fetch('/api/storage', {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        action: 'auth_login',
        role: req.role,
        username: req.username,
        password: req.password,
        encryptionCode: req.encryptionCode,
        schemaVersion: 3,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as AuthLoginResponse;
    if (res.ok && json.ok && json.token) {
      setAuthSessionToken(json.token, json.role || req.role);
      clearThrottleBackoff();
      return json;
    }
    return {
      ok: false,
      status: res.status,
      serverEmpty: Boolean(json.serverEmpty),
      error: json.error,
      reason: json.reason,
    };
  } catch {
    return { ok: false, networkError: true };
  }
}

export async function verifyExamEntryWithServer(params: {
  username: string;
  enteredToken: string;
  selectedScheduleId?: string;
}): Promise<VerifyExamEntryResponse> {
  try {
    const res = await fetch('/api/storage', {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        action: 'verify_exam_entry',
        username: params.username,
        enteredToken: params.enteredToken,
        selectedScheduleId: params.selectedScheduleId,
        schemaVersion: 3,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as VerifyExamEntryResponse;
    if (res.ok && json.ok) {
      clearThrottleBackoff();
      return json;
    }
    return {
      ok: false,
      status: res.status,
      error: json.error,
      reason: json.reason,
      participantStatus: json.participantStatus,
    };
  } catch {
    return { ok: false, networkError: true };
  }
}

export async function submitExamToServer(params: {
  packageId: string;
  packageTitle: string;
  answers: Record<string, StudentAnswer>;
  timeUsedSeconds: number;
  participant: ParticipantProfile;
  clientFallbackSummary?: ExamResultSummary;
}): Promise<SubmitExamServerResponse> {
  try {
    const res = await fetch('/api/storage', {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        action: 'submit_exam',
        packageId: params.packageId,
        packageTitle: params.packageTitle,
        answers: params.answers,
        timeUsedSeconds: params.timeUsedSeconds,
        participant: params.participant,
        clientFallbackSummary: params.clientFallbackSummary,
        schemaVersion: 3,
      }),
    });
    if (res.status === 429 || res.status === 503) {
      markThrottleBackoff(res.status);
    }
    const json = (await res.json().catch(() => ({}))) as SubmitExamServerResponse;
    if (res.ok && json.ok) {
      clearThrottleBackoff();
      return {
        ...json,
        engine: json.engine || 'vercel-serverless',
      };
    }
    return {
      ok: false,
      status: res.status,
      fallbackClientGrade: Boolean(json.fallbackClientGrade),
      error: json.error,
    };
  } catch {
    return { ok: false, networkError: true };
  }
}

export async function requestResetFromServer(username: string): Promise<boolean> {
  try {
    const res = await fetch('/api/storage', {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        action: 'request_reset',
        username,
        schemaVersion: 3,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
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
      headers: buildAuthHeaders(),
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
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
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
      const errJson = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        ok: false,
        engine: 'local',
        status: res.status,
        error: errJson.error,
        data: null,
      };
    }
    clearThrottleBackoff();
    const json = (await res.json()) as VercelStorageResponse;
    return json;
  } catch {
    return { ok: false, engine: 'local', data: null };
  }
}
