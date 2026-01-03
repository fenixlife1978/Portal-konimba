import { NextResponse } from 'next/server';

export function middleware(request) {
  // Log para verificar en la terminal que el código se está ejecutando
  console.log("🛡️ Filtro de seguridad activo en:", request.nextUrl.pathname);
  
  const session = request.cookies.get('session')?.value;
  const { pathname } = request.nextUrl;

  // Rutas que queremos bloquear si no hay sesión
  const isProtectedRoute = pathname.startsWith('/admin') || pathname.startsWith('/publisher');
  const isLoginRoute = pathname === '/publisher/login';

  // Si intenta entrar a admin/publisher sin cookie, lo mandamos al login
  if (isProtectedRoute && !isLoginRoute && !session) {
    console.log("🚫 Bloqueado: Redirigiendo a Login");
    return NextResponse.redirect(new URL('/publisher/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/publisher/:path*'],
};