import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)'
])

// Add an API key from environment variable
const API_KEY = process.env.API_KEY || 'your-secure-api-key';

export default clerkMiddleware(async (auth, request) => {
  // Check if the request has a valid API key in the header
  const authHeader = request.headers.get('authorization');
  const isApiRequest = request.nextUrl.pathname.startsWith('/api/');
  
  if (isApiRequest && authHeader === `Bearer ${API_KEY}`) {
    // Allow API requests with valid API key to bypass Clerk auth
    return;
  }
  
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}