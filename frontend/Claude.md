# UniMentee ERP — Frontend

## Stack
React + TypeScript + Vite + TailwindCSS
TanStack Query v5, Zustand, react-hook-form + zod, React Router v6

## Architecture
Domain-driven: all features live in src/features/<domain>/
Each feature has: api/, hooks/, components/, pages/, types/
See folder structure below.

## Key Rules
- API calls ONLY via src/services/api.ts (axios instance with auth interceptor)
- Permissions checked ONLY via usePermission() hook from src/hooks/usePermission.ts
- Gated UI wrapped in <PermissionGate permission="KEY"> component
- TailwindCSS only — no custom CSS files ever
- Zod schemas must mirror PostgreSQL CHECK constraints exactly

## Backend
FastAPI at http://127.0.0.1:8000
Auth: Authorization: Bearer <token> header
University: X-University-Id header (always sent)

## Design Tokens
Primary: #137fec | Font: Manrope | Dark mode: Tailwind dark: classes
Existing HTML prototypes in frontend/student.html, mentor.html, parents.html

## Roles in system
STUDENT, PARENT, FACULTY, MENTOR, HOD, DEAN, 
REGISTRAR, TIMETABLE_COORDINATOR, PLACEMENT_OFFICER, ADMIN
```

---

## Phase 1 — Infrastructure Files (Build these BEFORE any pages)

These are the files every single page depends on. Build them in this exact order.

---

### File 1 — `src/services/api.ts`

**Prompt to give Cline/Copilot:**
```
Create src/services/api.ts

Axios instance with:
- baseURL from import.meta.env.VITE_API_URL
- Request interceptor: attach Authorization: Bearer <token> 
  and X-University-Id header from Zustand authStore
- Response interceptor: on 401, clear auth and redirect to /login

No other logic. Just the configured axios instance as default export.
```

---

### File 2 — `src/stores/authStore.ts`

**Prompt:**
```
Create src/stores/authStore.ts using Zustand

Shape:
  token: string | null
  userId: number | null
  universityId: number | null
  role: string | null          ← primary role (first role from array)
  permissions: string[]        ← merged permissions from all roles
  
Actions:
  setAuth(token, userId, universityId, role, permissions) → also persists token to localStorage
  clearAuth() → clears state + localStorage
  
On store init: rehydrate token from localStorage
```

---

### File 3 — `src/hooks/usePermission.ts`

**Prompt:**
```
Create src/hooks/usePermission.ts

export function usePermission(key: string | string[]): boolean
  - reads permissions[] from authStore
  - if key is string: return permissions.includes(key)
  - if key is string[]: return key.every(k => permissions.includes(k))

export function useRole(): string | null
  - returns role from authStore
```

---

### File 4 — `src/components/shared/PermissionGate.tsx`

**Prompt:**
```
Create src/components/shared/PermissionGate.tsx

Props: { permission: string | string[], children: ReactNode, fallback?: ReactNode }
Uses usePermission() hook
If user has permission → render children
If not → render fallback (default: null)
```

---

### File 5 — `src/lib/roleRoutes.ts`

**Prompt:**
```
Create src/lib/roleRoutes.ts

Export ROLE_HOME: Record<string, string> mapping:
STUDENT → /student/dashboard
PARENT → /parent/dashboard  
FACULTY → /faculty/dashboard
MENTOR → /mentor/dashboard
HOD → /hod/dashboard
DEAN → /dean/dashboard
REGISTRAR → /registrar/dashboard
TIMETABLE_COORDINATOR → /timetable/dashboard
PLACEMENT_OFFICER → /placement/dashboard
ADMIN → /admin/dashboard

Export getHomeRoute(role: string): string
  returns ROLE_HOME[role] ?? '/login'
```

---

### File 6 — `src/router/ProtectedRoute.tsx`

**Prompt:**
```
Create src/router/ProtectedRoute.tsx

Reads token from authStore
If no token → redirect to /login
If token exists → render <Outlet />
```

---

### File 7 — `src/layouts/DashboardLayout.tsx`

**Prompt:**
```
Create src/layouts/DashboardLayout.tsx

Layout: fixed sidebar (w-64) + flex-1 main area
Sidebar shows:
  - UniMentee logo (school icon, primary color #137fec)
  - Nav links filtered by role and permissions (use NAV_CONFIG array)
  - User info + logout button at bottom

Top header: h-16, shows page title + notification bell + user avatar

NAV_CONFIG — show link only if user has the required permission:
  Dashboard    → always shown (role-specific path)
  Attendance   → needs ATTENDANCE_MARK or ATTENDANCE_VIEW_OWN  
  Marks        → needs MARKS_ENTER or MARKS_VIEW_OWN
  Students     → needs STUDENT_VIEW
  Mentees      → needs STUDENT_VIEW (role=MENTOR/FACULTY)
  Reports      → needs MARKS_VIEW_ALL
  Programs     → needs ACADEMIC_MANAGE
  Users        → needs USER_MANAGE

Matches design in frontend/mentor.html and frontend/student.html exactly.
Use Manrope font, primary #137fec, active nav has bg-primary/10 + left border.
```

---

## Phase 2 — Auth Pages

### File 8 — `src/features/auth/pages/LoginPage.tsx`

**Prompt (attach your Login Figma screenshot):**
```
Create src/features/auth/pages/LoginPage.tsx

[attach Figma screenshot of login page]

Form fields: email, password (react-hook-form + zod)
Zod schema: email must be valid email, password min 6 chars

On submit:
  1. POST /auth/login { email, password }
  2. Store token from response in authStore
  3. GET /auth/me to load { userId, universityId, role, permissions }
  4. Call authStore.setAuth() with all values
  5. Navigate to getHomeRoute(role)
  
On 401: show error "Invalid credentials"

Design: matches wireframe — centered card, UniMentee branding,
Student/Mentor/Parent role selector tabs at top (visual only, 
same endpoint handles all roles)