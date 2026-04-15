import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Search, Shield, UserX } from 'lucide-react';
import api from '../../../services/api';
import { useAnyPermission } from '../../../hooks/usePermission';

// ─── types ─────────────────────────────────────────────────────────────────

export interface RoleOut {
  role_id: number;
  name: string;
  display_name: string | null;
}

export interface AdminUserOut {
  user_id: number;
  full_name: string;
  email: string;
  status: string;
  roles: RoleOut[];
}


// ─── constants ─────────────────────────────────────────────────────────────

const ROLE_FILTER_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'FACULTY', label: 'Faculty' },
  { value: 'MENTOR', label: 'Mentor' },
  { value: 'HOD', label: 'HOD' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'PARENT', label: 'Parent' },
] as const;

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
] as const;

const createUserSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'At least 8 characters'),
  role_ids: z.array(z.number()).min(1, 'Select at least one role'),
});

const editUserSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  role_ids: z.array(z.number()).min(1, 'Select at least one role'),
});

type CreateUserForm = z.infer<typeof createUserSchema>;
type EditUserForm = z.infer<typeof editUserSchema>;

// ─── bits ──────────────────────────────────────────────────────────────────

function statusBadgeClass(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100';
    case 'INACTIVE':
      return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
    case 'SUSPENDED':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200';
  }
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const canManage = useAnyPermission(['USER_MANAGE']);
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUserOut | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, statusFilter]);

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', { debouncedSearch, roleFilter, statusFilter }],
    queryFn: () =>
      api
        .get<AdminUserOut[]>('/admin/users', {
          params: {
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
            ...(roleFilter ? { role: roleFilter } : {}),
            ...(statusFilter ? { status: statusFilter } : {}),
          },
        })
        .then((r) => r.data),
    enabled: canManage,
  });

  const rolesQuery = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => api.get<RoleOut[]>('/admin/roles').then((r) => r.data),
    enabled: canManage,
  });

  const roles = rolesQuery.data ?? [];

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { full_name: '', email: '', password: '', role_ids: [] },
  });

  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { full_name: '', email: '', role_ids: [] },
  });

  const openCreate = useCallback(() => {
    setEditingUser(null);
    setModalMode('create');
    createForm.reset({ full_name: '', email: '', password: '', role_ids: [] });
  }, [createForm]);

  useEffect(() => {
    const st = location.state as { openCreate?: boolean } | null;
    if (st?.openCreate) {
      openCreate();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, openCreate]);

  const openEdit = useCallback(
    (u: AdminUserOut) => {
      setEditingUser(u);
      setModalMode('edit');
      editForm.reset({
        full_name: u.full_name,
        email: u.email,
        role_ids: u.roles.map((r) => r.role_id),
      });
    },
    [editForm],
  );

  const closeModal = useCallback(() => {
    setModalMode(null);
    setEditingUser(null);
  }, []);

  const createMutation = useMutation({
    mutationFn: (body: CreateUserForm) =>
      api.post<AdminUserOut>('/admin/users', {
        full_name: body.full_name,
        email: body.email,
        password: body.password,
        role_ids: body.role_ids,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: EditUserForm }) =>
      api.put<AdminUserOut>(`/admin/users/${id}`, {
        full_name: body.full_name,
        email: body.email,
        role_ids: body.role_ids,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      closeModal();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: number) =>
      api.patch<AdminUserOut>(`/admin/users/${userId}/status`, { status: 'INACTIVE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const allUsers = usersQuery.data ?? [];

  const totalPages = useMemo(() => {
    const t = allUsers.length;
    return Math.max(1, Math.ceil(t / pageSize));
  }, [allUsers.length, pageSize]);

  const items = useMemo(() => {
    const start = (page - 1) * pageSize;
    return allUsers.slice(start, start + pageSize);
  }, [allUsers, page, pageSize]);

  if (!canManage) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-medium text-gray-900 dark:text-white">Access denied</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          You need the USER_MANAGE permission.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Search, filter, and manage accounts and roles.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Create user
        </button>
      </div>

      {/* A) Search & filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Search</label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name or email"
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
        </div>
        <div className="w-full lg:w-44">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Role</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
          >
            {ROLE_FILTER_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full lg:w-44">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* B) Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {usersQuery.isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading users…</div>
        ) : usersQuery.isError ? (
          <div className="p-12 text-center text-sm text-red-600 dark:text-red-400">
            Failed to load users. Check permissions and try again.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Name</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Email</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Roles</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                      No users match your filters.
                    </td>
                  </tr>
                ) : (
                  items.map((u) => (
                    <tr key={u.user_id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{u.full_name}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{u.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <span
                              key={r.role_id}
                              className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                            >
                              {r.display_name || r.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(u.status)}`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          {u.status === 'ACTIVE' ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  window.confirm(`Deactivate ${u.full_name}? They will be set to INACTIVE.`)
                                ) {
                                  deactivateMutation.mutate(u.user_id);
                                }
                              }}
                              disabled={deactivateMutation.isPending}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-950/40"
                            >
                              <UserX className="h-3.5 w-3.5" />
                              Deactivate
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              window.alert(
                                'Password reset will be available when the reset-password API is connected.',
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                          >
                            <Shield className="h-3.5 w-3.5" />
                            Reset password
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {allUsers.length > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400 sm:flex-row">
            <span>
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, allUsers.length)} of {allUsers.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:opacity-40 dark:border-gray-600"
              >
                Previous
              </button>
              <span className="text-xs">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:opacity-40 dark:border-gray-600"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Create modal */}
      {modalMode === 'create' ? (
        <Modal title="Create user" onClose={closeModal}>
          <form
            className="space-y-4"
            onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))}
          >
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Full name</label>
              <input
                {...createForm.register('full_name')}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              />
              {createForm.formState.errors.full_name ? (
                <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.full_name.message}</p>
              ) : null}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Email</label>
              <input
                type="email"
                {...createForm.register('email')}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              />
              {createForm.formState.errors.email ? (
                <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.email.message}</p>
              ) : null}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Password</label>
              <input
                type="password"
                autoComplete="new-password"
                {...createForm.register('password')}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              />
              {createForm.formState.errors.password ? (
                <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.password.message}</p>
              ) : null}
            </div>
            <RoleCheckboxes
              roles={roles}
              loading={rolesQuery.isLoading}
              value={createForm.watch('role_ids')}
              onChange={(ids) => createForm.setValue('role_ids', ids, { shouldValidate: true })}
              error={createForm.formState.errors.role_ids?.message}
            />
            {createMutation.isError ? (
              <p className="text-xs text-red-600">Could not create user (email may already exist).</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* Edit modal */}
      {modalMode === 'edit' && editingUser ? (
        <Modal title="Edit user" onClose={closeModal}>
          <form
            className="space-y-4"
            onSubmit={editForm.handleSubmit((data) =>
              updateMutation.mutate({ id: editingUser.user_id, body: data }),
            )}
          >
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Full name</label>
              <input
                {...editForm.register('full_name')}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              />
              {editForm.formState.errors.full_name ? (
                <p className="mt-1 text-xs text-red-600">{editForm.formState.errors.full_name.message}</p>
              ) : null}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Email</label>
              <input
                type="email"
                {...editForm.register('email')}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              />
              {editForm.formState.errors.email ? (
                <p className="mt-1 text-xs text-red-600">{editForm.formState.errors.email.message}</p>
              ) : null}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Password changes use the reset flow once the API is available.
            </p>
            <RoleCheckboxes
              roles={roles}
              loading={rolesQuery.isLoading}
              value={editForm.watch('role_ids')}
              onChange={(ids) => editForm.setValue('role_ids', ids, { shouldValidate: true })}
              error={editForm.formState.errors.role_ids?.message}
            />
            {updateMutation.isError ? (
              <p className="text-xs text-red-600">Update failed (email may be in use).</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function RoleCheckboxes({
  roles,
  loading,
  value,
  onChange,
  error,
}: {
  roles: RoleOut[];
  loading: boolean;
  value: number[];
  onChange: (ids: number[]) => void;
  error?: string;
}) {
  const toggle = (id: number) => {
    const set = new Set(value);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange([...set]);
  };

  return (
    <div>
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Roles</span>
      {loading ? (
        <p className="mt-2 text-sm text-gray-500">Loading roles…</p>
      ) : (
        <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          {roles.map((r) => (
            <li key={r.role_id} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`role-${r.role_id}`}
                checked={value.includes(r.role_id)}
                onChange={() => toggle(r.role_id)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor={`role-${r.role_id}`} className="text-sm text-gray-800 dark:text-gray-200">
                {r.display_name || r.name}{' '}
                <span className="text-gray-400">({r.name})</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
