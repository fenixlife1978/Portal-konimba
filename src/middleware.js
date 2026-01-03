import { NextResponse } from 'next/server';

export function middleware(request) {
  // 1. Log para confirmar que el archivo está en el sitio correcto
  console.log("➡️ Middleware activo en:", request.nextUrl.pathname);
  
  // 2. Intentamos obtener la cookie 'session'
  const session = request.cookies.get('session')?.value;
  const { pathname } = request.nextUrl;

  // 3. Definimos las rutas que requieren protección
  const isProtectedRoute = pathname.startsWith('/admin') || pathname.startsWith('/publisher');
  
  // 4. Identificamos la ruta de login para evitar bucles de redirección
  const isLoginRoute = pathname === '/publisher/login';

  // CASO: Intenta entrar a una ruta protegida sin tener la cookie
  if (isProtectedRoute && !isLoginRoute && !session) {
    console.log("❌ Acceso denegado: Redirigiendo a login");
    return NextResponse.redirect(new URL('/publisher/login', request.url));
  }

  // CASO: Ya tiene sesión e intenta ir al login (lo mandamos al panel)
  if (isLoginRoute && session) {
    return NextResponse.redirect(new URL('/publisher', request.url));
  }

  return NextResponse.next();
}

// Configuración del Matcher: Define en qué rutas actúa el middleware
export const config = {
  matcher: [
    '/admin/:path*',
    '/publisher/:path*',
  ],
};