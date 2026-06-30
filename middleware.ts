import { NextRequest, NextResponse } from 'next/server';

const REFRESH_TOKEN_COOKIE = 'refresh_token';
const LOGIN_PATH = '/login';

const PUBLIC_PATHS = [
  LOGIN_PATH,
  '/Login',
  '/find-id',
  '/find-id-result',
  '/find-Password',
  '/reset-password',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/social/complete',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasRefreshToken = Boolean(request.cookies.get(REFRESH_TOKEN_COOKIE)?.value);
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (hasRefreshToken && pathname === '/') {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/home';
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }

  if (!hasRefreshToken && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.search = '';

    if (pathname !== '/') {
      loginUrl.searchParams.set('redirectTo', `${pathname}${request.nextUrl.search}`);
    }

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|uploads|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|json|woff2?|ttf|otf)$).*)',
  ],
};
