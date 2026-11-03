import {
  AdminScheduleItem,
  ExamPackage,
  ExamResultSummary,
} from '../types/cbt';
import { ProctorParticipantRow } from '../components/ProctorDashboardView';
import { AdminProctorItem } from '../components/AdminViews';

export interface CBTCloudPayload {
  packages?: ExamPackage[];
  schedules?: AdminScheduleItem[];
  participants?: ProctorParticipantRow[];
  proctors?: AdminProctorItem[];
  activeToken?: string;
  resultsHistory?: ExamResultSummary[];
  updatedAt?: number;
}

export interface VercelStorageResponse {
  ok: boolean;
  engine: 'vercel-kv' | 'vercel-serverless' | 'local';
  updatedAt?: number;
  data: CBTCloudPayload | null;
}

export async function fetchVercelStorage(): Promise<VercelStorageResponse> {
  try {
    const res = await fetch('/api/storage', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      return { ok: false, engine: 'local', data: null };
    }
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
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { ok: false, engine: 'local', data: null };
    }
    const json = (await res.json()) as VercelStorageResponse;
    return json;
  } catch {
    return { ok: false, engine: 'local', data: null };
  }
}
