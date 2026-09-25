/**
 * Users feature service.
 * Endpoint contract: GET /users (admin list), PATCH /admin/users/{id}/status
 * (verified against backend users + admin routers).
 */

import { apiGet, apiPatch } from '@/lib/api/client';
import { ApiError } from '@/lib/api/error';
import { parseWith, paginatedUsersSchema, userSchema, type UserDto } from '@/lib/api/schemas';

export interface UserListParams {
  page?: number;
  pageSize?: number;
  role?: string;
  search?: string;
  signal?: AbortSignal;
}

export interface UserListResult {
  users: UserDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchUsers(params: UserListParams = {}): Promise<UserListResult> {
  const { page = 1, pageSize = 20, role, search, signal } = params;
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (role && role !== 'all') query.set('role', role);
  if (search && search.trim()) query.set('search', search.trim());

  const data = await apiGet<unknown>(`/users?${query.toString()}`, { signal });
  const parsed = parseWith(paginatedUsersSchema, data);
  return {
    users: parsed.data,
    total: parsed.total,
    page: parsed.page,
    pageSize: parsed.page_size,
    totalPages: parsed.total_pages,
  };
}

/** Suspend or reactivate a user account (backend-authoritative, audited server-side). */
export async function updateUserStatus(userId: string, isActive: boolean, signal?: AbortSignal): Promise<UserDto> {
  const data = await apiPatch<unknown>(`/admin/users/${userId}/status`, { is_active: isActive }, { signal });
  return parseWith(userSchema, data);
}

/**
 * Fetch a single user by ID (`GET /users/{id}` — admin or self, verified).
 * Returns null when the backend answers 404 so detail pages can render a
 * not-found state instead of an error.
 */
export async function fetchUserDetail(userId: string, signal?: AbortSignal): Promise<UserDetail | null> {
  try {
    const data = await apiGet<unknown>(`/users/${userId}`, { signal });
    const parsed = parseWith(userSchema, data);
    return {
      ...parsed,
      /** Presentational display name derived once at the boundary (§10). */
      display_name:
        [parsed.first_name, parsed.last_name].filter(Boolean).join(' ') || parsed.email,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export type UserDetail = UserDto & { display_name: string };
