'use client';
import { useState, useEffect, useMemo } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, useUser, useDoc } from "@/firebase"; 
import { db } from '@/firebase/config';
import { signInWithEmailAndPassword, updateProfile, createUserWithEmailAndPassword } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/logo";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Cookies from "js-cookie";

type CompanySettings = {
  companyName?: string;
  logoUrl?: string;
};

export default function PublisherAuthPage() {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [isCheckingRole, setIsCheckingRole] = useState(false); // Cambiado a false por defecto

  const auth = useAuth();
  const firestore = db;
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);

  useEffect(() => {
    // Si Firebase aún está cargando el estado del usuario, no hacemos nada
    if (isUserLoading) return;

    // Si NO hay usuario autenticado, nos aseguramos de que no se quede cargando
    if (!user) {
      setIsCheckingRole(false);
      return;
    }

    const checkRoleAndRedirect = async () => {
      if (!firestore) return;
      setIsCheckingRole(true);

      try {
        const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
        const publisherRef = doc(firestore, 'publishers', user.uid);

        const [adminDoc, publisherDoc] = await Promise.all([
          getDoc(adminRoleRef),
          getDoc(publisherRef)
        ]);

        if (adminDoc.exists()) {
          router.replace('/admin');
          return;
        }

        if (publisherDoc.exists()) {
          router.replace('/publisher');
          return;
        }

        // Si el usuario está logueado pero NO tiene rol (ej. cuenta nueva sin datos)
        // Borramos cookie y deslogueamos para evitar el bucle
        Cookies.remove('session');
        if (auth) await auth.signOut();
        toast({
          variant: "destructive",
          title: "Acceso denegado",
          description: "Tu cuenta no tiene permisos asignados."
        });
        setIsCheckingRole(false);

      } catch (error) {
        console.error("Error validando permisos:", error);
        setIsCheckingRole(false);
      }
    };

    checkRoleAndRedirect();
  }, [user, isUserLoading, firestore, auth, router, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    
    setIsCheckingRole(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const token = await userCredential.user.getIdToken();
      
      // Guardar cookie ANTES de cualquier redirección
      Cookies.set('session', token, { expires: 7, secure: true, sameSite: 'strict' });
      
      // El useEffect de arriba detectará el cambio de 'user' y hará la redirección
    } catch (error: any) {
      setIsCheckingRole(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Credenciales inválidas o cuenta no existente."
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    
    setIsCheckingRole(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);
        const token = await userCredential.user.getIdToken();
        Cookies.set('session', token, { expires: 7, secure: true, sameSite: 'strict' });

        await updateProfile(userCredential.user, { displayName: registerName });

        await setDoc(doc(firestore, 'publishers', userCredential.user.uid), {
            id: userCredential.user.uid,
            firstName: registerName.split(' ')[0] || '',
            lastName: registerName.split(' ').slice(1).join(' ') || '',
            email: userCredential.user.email,
            status: 'active',
            createdAt: serverTimestamp(),
        });
        
        router.refresh();
    } catch (error: any) {
        setIsCheckingRole(false);
        toast({ variant: "destructive", title: "Error", description: "No se pudo completar el registro." });
    }
  };

  // Solo mostramos pantalla de carga si Firebase está verificando el estado inicial
  // o si estamos en proceso de redirección tras confirmar el rol.
  if (isUserLoading || (user && isCheckingRole)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        <p className="mt-4 text-sm text-muted-foreground">Validando sesión...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30 p-4">
      <div className="mb-8 flex flex-col items-center">
        <Logo className="h-16 w-16" src={settingsData?.logoUrl} />
        <h1 className="text-2xl font-bold mt-4">{settingsData?.companyName || "Cargando..."}</h1>
      </div>

      <Tabs defaultValue="login" className="w-full max-w-sm">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Ingresar</TabsTrigger>
          <TabsTrigger value="register">Registrarse</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <form onSubmit={handleLogin}>
            <Card>
              <CardHeader>
                <CardTitle>Bienvenido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input type="email" placeholder="Email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                <Input type="password" placeholder="Contraseña" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
              </CardContent>
              <CardFooter>
                <Button className="w-full" type="submit" disabled={isCheckingRole}>
                  {isCheckingRole ? "Iniciando..." : "Acceder"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>
        {/* ... (Contenido de Registro igual al anterior) */}
      </Tabs>
    </div>
  );
}