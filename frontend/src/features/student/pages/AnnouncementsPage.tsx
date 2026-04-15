import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, isAfter, parseISO } from 'date-fns';
import { Megaphone, Search } from 'lucide-react';
import api from '../../../services/api';
import { useAuthStore, selectToken } from '../../../stores/authStore';

const READ_STORAGE_KEY = 'unimentee_announcement_read_ids';

type CategoryFilter = 'ALL' | 'ACADEMIC' | 'ADMINISTRATIVE' | 'EVENT' | 'URGENT';

interface AnnouncementRow {
  announcement_id: number;
  title: string;
  body: string;
  category: string;
  priority: string;
  posted_at: string;
  expiry_date: string | null;
  author_name: string;
}

function loadReadIds(): Set<number> {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<number>) {
  localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids]));
}

function categoryBadgeClass(cat: string): string {
  switch (cat) {
    case 'ACADEMIC':
      return 'bg-blue-100 text-blue-900 border-blue-200';
    case 'ADMINISTRATIVE':
      return 'bg-slate-100 text-slate-800 border-slate-200';
    case 'EVENT':
      return 'bg-violet-100 text-violet-900 border-violet-200';
    case 'URGENT':
      return 'bg-orange-100 text-orange-900 border-orange-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export default function AnnouncementsPage() {
  const token = useAuthStore(selectToken);
  const canView = !!token;
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [readIds, setReadIds] = useState<Set<number>>(loadReadIds);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const queryParams = useMemo(() => {
    const p: Record<string, string> = { limit: '100' };
    if (category !== 'ALL') p.category = category;
    if (debouncedSearch) p.search = debouncedSearch;
    if (dateFrom) p.posted_from = dateFrom;
    if (dateTo) p.posted_to = dateTo;
    return p;
  }, [category, debouncedSearch, dateFrom, dateTo]);

  const { data: rawItems = [], isLoading, error } = useQuery<AnnouncementRow[]>({
    queryKey: ['announcements', queryParams],
    queryFn: () => api.get('/announcements', { params: queryParams }).then(r => r.data),
    staleTime: 60_000,
    enabled: canView,
  });

  const items = rawItems;

  const stats = useMemo(() => {
    const total = items.length;
    const unread = items.filter(a => !readIds.has(a.announcement_id)).length;
    return { total, unread };
  }, [items, readIds]);

  const markRead = useCallback((id: number) => {
    setReadIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }, []);

  const toggleExpand = useCallback((id: number) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const handleCardInteract = useCallback(
    (id: number) => {
      markRead(id);
    },
    [markRead],
  );

  if (!canView) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 text-sm font-medium text-amber-900">
        Sign in to view announcements.
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-800">
        Could not load announcements. Try again or contact support.
      </div>
    );
  }

  const pills: { key: CategoryFilter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'ACADEMIC', label: 'Academic' },
    { key: 'ADMINISTRATIVE', label: 'Administrative' },
    { key: 'EVENT', label: 'Event' },
    { key: 'URGENT', label: 'Urgent' },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Announcements</h1>
        <p className="mt-1 text-sm text-gray-500">
          {stats.total} total
          {stats.unread > 0 ? ` · ${stats.unread} unread` : ''}
        </p>
      </div>

      {/* A) Filter bar */}
      <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {pills.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => setCategory(p.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                category === p.key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col text-xs font-bold text-gray-500">
              From
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="mt-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col text-xs font-bold text-gray-500">
              To
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="mt-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search title or body…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>
      </div>

      {/* B) Feed */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 px-6 py-16 text-center">
          <Megaphone className="mb-3 h-12 w-12 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">No announcements yet</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map(a => {
            const unread = !readIds.has(a.announcement_id);
            const isExpanded = expanded.has(a.announcement_id);
            let expiryFuture: string | null = null;
            if (a.expiry_date) {
              const exp = parseISO(a.expiry_date.includes('T') ? a.expiry_date : `${a.expiry_date}T23:59:59`);
              if (isAfter(exp, new Date())) {
                expiryFuture = exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              }
            }
            let relativePosted = '';
            try {
              relativePosted = formatDistanceToNow(parseISO(a.posted_at), { addSuffix: true });
            } catch {
              relativePosted = a.posted_at;
            }

            return (
              <li key={a.announcement_id}>
                <article
                  role="button"
                  tabIndex={0}
                  onClick={() => handleCardInteract(a.announcement_id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCardInteract(a.announcement_id);
                    }
                  }}
                  className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
                    unread ? 'border-l-4 border-l-blue-500 border-gray-100' : 'border-gray-100'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.priority === 'URGENT' && (
                        <span className="rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-800">
                          Urgent
                        </span>
                      )}
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${categoryBadgeClass(a.category)}`}
                      >
                        {a.category}
                      </span>
                    </div>
                  </div>
                  <h2 className="mt-2 text-lg font-extrabold text-gray-900">{a.title}</h2>
                  <div
                    className={`mt-2 text-sm leading-relaxed text-gray-700 ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-3'}`}
                  >
                    {a.body}
                  </div>
                  <button
                    type="button"
                    className="mt-1 text-xs font-bold text-primary hover:underline"
                    onClick={e => {
                      e.stopPropagation();
                      markRead(a.announcement_id);
                      toggleExpand(a.announcement_id);
                    }}
                  >
                    {isExpanded ? 'Show less' : 'Read more'}
                  </button>
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span className="font-medium text-gray-600">{a.author_name}</span>
                    <span>·</span>
                    <span>{relativePosted}</span>
                  </div>
                  {expiryFuture && (
                    <p className="mt-1 text-xs text-gray-400">Expires: {expiryFuture}</p>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
