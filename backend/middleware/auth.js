import { clerkMiddleware, requireAuth, getAuth } from '@clerk/express';

// Base Clerk middleware — attaches auth to every request
export const clerkAuth = clerkMiddleware();

// Middleware to protect routes — rejects unauthenticated requests
export const requireClerkAuth = requireAuth();

// Helper to extract userId from verified token
export function getClerkUserId(req) {
  const auth = getAuth(req);
  return auth?.userId || null;
}
