import { NextResponse } from 'next/server';

export function middleware(request) {
  // Log para verificar en la terminal que el código se está ejecutando
  console.log("🛡️ Filtro de seguridad activo en:", request.nextUrl.pathname);
  
  // No hay cookie de 'session' en este proyecto. Se usa el estado de auth de Firebase en el cliente.
  // El middleware no tiene acceso al estado de autenticación de Firebase del cliente.
  // La protección de rutas se debe hacer en los layouts o páginas del cliente.
  // Este middleware no es efectivo para proteger rutas con Firebase Auth del lado del cliente.
  // Sin embargo, para cumplir con la estructura, lo dejamos pasar.
  // Las redirecciones correctas se manejan en los layouts y páginas de login.

  const { pathname } = request.nextUrl;
  const isAuthPage = pathname.endsWith('/login');

  // Si se intenta acceder a una ruta protegida (que no sea la de login)
  // la lógica en el layout del cliente se encargará de la redirección.
  // Este middleware no puede saber si el usuario está logueado o no
  // por lo que no puede hacer la redirección de forma segura.
  
  return NextResponse.next();
}

export const config = {
  // Aplicamos el middleware a las rutas de admin y publisher, excluyendo las de login
  matcher: [
    '/admin/:path*',
    '/publisher/:path*',
    '/((?!admin/login|publisher/login|_next/static|_next/image|favicon.ico).*)',
  ],
};
