'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  BarChart3, 
  Settings, 
  LogOut,
  ArrowLeftRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarFooter, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  useSidebar
} from '@/components/ui/sidebar';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';

interface AdminSidebarProps {
  companyName?: string;
  logoUrl?: string;
}

const menuItems = [
  { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { title: 'Equipo y SubIds', href: '/admin/publishers', icon: Users },
  { title: 'Gestión de Leads', href: '/admin/leads', icon: ArrowLeftRight },
  { title: 'Registro de Pagos', href: '/admin/payments', icon: CreditCard },
  { title: 'Reportes y Auditoría', href: '/admin/reports', icon: BarChart3 },
  { title: 'Configuración', href: '/admin/settings', icon: Settings },
];

export function AdminSidebar({ companyName, logoUrl }: AdminSidebarProps) {
  const pathname = usePathname();
  const auth = useAuth();
  const router = useRouter();
  const { setOpenMobile, state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/');
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40 bg-card/50 backdrop-blur-xl">
      <SidebarHeader className="p-6">
        <Link href="/admin" className="flex items-center gap-3">
          <Logo className="h-10 w-10 rounded-xl flex-shrink-0" src={logoUrl} />
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden animate-in fade-in duration-300">
              <span className="text-sm font-bold text-foreground line-clamp-1">
                {companyName || 'Siren\'s Portal'}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                Administrador
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>
      
      <SidebarContent className="px-4 py-2">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={item.title}
                className={cn(
                  "flex items-center gap-3 px-4 py-6 rounded-2xl transition-all duration-300",
                  pathname === item.href 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => setOpenMobile(false)}
              >
                <Link href={item.href}>
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="font-semibold animate-in fade-in slide-in-from-left-2 duration-300">
                      {item.title}
                    </span>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/40">
        <Button 
          variant="ghost" 
          className={cn(
            "w-full justify-start gap-3 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive py-6",
            isCollapsed && "justify-center px-0"
          )}
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span className="font-semibold animate-in fade-in duration-300">Cerrar Sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
