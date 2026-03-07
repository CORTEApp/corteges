# Bootstrap QA checklist

- [ ] existe `package.json`
- [ ] existe `app/layout.tsx`
- [ ] existe `components.json`
- [ ] existe `proxy.ts` o `proxy.js`
- [ ] existen `lib/supabase/client`, `server`, `admin`, `proxy`
- [ ] existe `app/auth/callback/route.ts`
- [ ] `.env.local` contiene URL, publishable key y server key
- [ ] `supabase/migrations/*.sql` presentes
- [ ] `supabase/queries/verification.sql` presente
- [ ] `.ai/SYSTEM_STATUS.md` coherente con el estado real
