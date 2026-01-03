import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 1. Intentamos obtener la cookie 'session'
  const session = request.cookies.get('session')?.value;
  const { pathname } = request.nextUrl;

  // 2. Definimos las rutas
  const isAdminRoute = pathname.startsWith('/admin');
  const isLoginRoute = pathname === '/login';

  // CASO A: El usuario intenta entrar a Admin pero NO tiene sesión
  if (isAdminRoute && !session) {
    const loginUrl = new URL('/login', request.url);
    // Guardamos la página a la que quería ir para devolverlo ahí después del login
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // CASO B: El usuario YA TIENE sesión e intenta ir al Login
  // Lo mandamos directo al panel para que no se loguee dos veces
  if (isLoginRoute && session) {
    return NextResponse.redirect(new URL('/admin/reports', request.url));
  }

  return NextResponse.next();
}

// 3. Configuración del Matcher
// Protegemos la carpeta admin y permitimos que el middleware revise el login
export const config = {
  matcher: [
    '/admin/:path*',
    '/login'
  ],
};