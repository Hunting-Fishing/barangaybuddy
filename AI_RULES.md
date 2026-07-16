# AI Rules for BarangayHub

## Tech stack

- React 19 with TypeScript for the frontend application code.
- TanStack Start and TanStack Router for routing, SSR, server functions, and API-style route handlers.
- Vite for local development, building, and environment variable handling.
- Supabase for authentication, database access, storage, roles, and server-side admin operations.
- TanStack React Query for client-side data fetching, caching, and loading states.
- Tailwind CSS v4 for all styling, layout, spacing, colors, and responsive design.
- shadcn/ui and Radix UI for reusable UI primitives such as buttons, dialogs, cards, tabs, forms, selects, and menus.
- Sonner for toast notifications.
- Leaflet for interactive maps.
- Zod for validation of forms, URL search params, and server-function inputs.

## Library rules

- Use TanStack Router for all app routes. Add or edit routes in `src/routes/`; do not introduce React Router.
- Use TanStack Start server functions for authenticated or server-side mutations that belong inside this app.
- Use Supabase client code from `src/integrations/supabase/client.ts` for browser-safe reads and writes.
- Use Supabase admin code from `src/integrations/supabase/client.server.ts` only in server-only files, server functions, or route handlers.
- Never import `.server.ts` files into client components or browser-rendered code.
- Use React Query for reusable client-side loading/caching flows, especially lists and search pages.
- Use direct Supabase calls inside `useEffect` only for simple page-specific reads where React Query would add unnecessary complexity.
- Use shadcn/ui components before creating custom UI primitives.
- Use Tailwind utility classes for styling; do not add CSS files unless a global theme or third-party stylesheet requires it.
- Use `lucide-react` for icons; do not add another icon library.
- Use `sonner` to notify users about important actions, successes, and errors.
- Use Zod to validate user input, server-function input, route search params, and form payloads.
- Use React Hook Form only when forms become complex enough to benefit from structured form state; simple forms may use local React state.
- Use Leaflet only for maps and map markers; keep map-specific logic inside focused map components.
- Use existing business helpers in `src/lib/` for business types, tags, unit prices, imports, and slug behavior instead of duplicating logic.
- Keep new components in `src/components/` and new pages/routes in `src/routes/`.
- Keep components small and focused; create a new file for every new component or hook.
- Prefer simple, readable code over abstraction-heavy patterns.
- Do not add new dependencies when an installed library already solves the problem.
- Do not edit generated files such as `src/routeTree.gen.ts` or generated Supabase integration files unless explicitly required.
- Do not edit shadcn/ui source components directly; wrap or compose them in app-specific components instead.
- For database schema changes, add Supabase migrations rather than relying only on TypeScript type edits.
- For API routes, cron hooks, webhooks, secrets, and service-role operations, keep all sensitive logic server-side.
- Never expose service-role keys, private API keys, or server-only environment variables to client code.
- Use `VITE_` environment variables only for values that are safe to expose in the browser.
- Preserve existing imports, route structure, and app conventions unless the requested change specifically requires updating them.
- Always maintain responsive layouts for mobile, tablet, and desktop.