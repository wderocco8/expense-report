# Tasks

## In Progress

- [ ] Hydration Error - React hydration mismatch in sidebar components
  - Server/client ID mismatch in Radix UI components
  - Affects: `TeamSwitcher`, `SidebarMenuButton`, `AppSidebar`
  - Location: `components/ui/sidebar.tsx:515`

## Backlog

### High Priority

- [ ] Rate Limiting
  - Implement API rate limiting to prevent abuse
  - Consider: Redis, Upstash, or Next.js middleware approach

- [ ] Database sorting + filtering
  - Add sorting and filtering capabilities to database queries
  - Likely involves query builder updates and UI controls

### Medium Priority

- [ ] Image compression (browser)
  - Enable image uploads from mobile photos app
  - Compress images client-side before upload
  - Consider libraries: `browser-image-compression`, `sharp` (server-side)

- [ ] Auth email verification
  - Add email verification flow to authentication
  - Requires: email service integration (Resend, SendGrid, etc.)

### Complex / Long-term

- [ ] Flexible schema (high level, very complex initiative)
  - Allow users to define custom fields/structures
  - Requires significant architecture changes
  - Research: dynamic schemas, metadata storage approaches

## Completed

_None yet_

---

## Notes

- Using this file for AI-managed task tracking instead of Notion
- Tasks are organized by priority and complexity
- Check off items as they are completed
- Add new tasks to appropriate section
