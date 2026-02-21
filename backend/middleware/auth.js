import { clerkMiddleware, getAuth, requireAuth } from '@clerk/express';

// Global middleware — call app.use(clerkAuth) BEFORE routes.
// This does NOT block requests; it just attaches auth state to req.
export const clerkAuth = clerkMiddleware();

// Route-level middleware — blocks unauthenticated requests with 401.
export const requireClerkAuth = requireAuth();

// Helper — call inside a route handler to get the userId.
// Returns the Clerk userId string or null.
export function getClerkUserId(req) {
  const auth = getAuth(req);
  return auth?.userId || null;
}
