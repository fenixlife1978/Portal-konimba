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
import { signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Cookies from "js-cookie"; // Importación necesaria para la seguridad

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
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  const auth = useAuth();
  const firestore = db;
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);

  useEffect(() => {
    if (isUserLoading) return;
    
    if (!user) {
      setIsCheckingRole(false);
      return;
    }

    const checkRole = async () => {
      setIsCheckingRole(true);
      
      if (!firestore) {
       
        setIsCheckingRole(false);
        return;
      };

      const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
      const publisherRef = doc(firestore, 'publishers', user.uid);

      try {
        const adminDocSnap = await getDoc(adminRoleRef);
        
        if (adminDocSnap.exists()) {
          toast({
            variant: "destructive",
            title: "Acceso no permitido",
            description: "Los administradores no pueden iniciar sesión aquí.",
          });
          if (auth) {
            await auth.signOut();
            Cookies.remove('session'); // Borrar cookie si el rol es incorrecto
          }
          setIsCheckingRole(false);
          return;
        }

        const publisherDocSnap = await getDoc(publisherRef);
        if (publisherDocSnap.exists()) {
          router.push('/publisher');
        } else {
           setIsCheckingRole(false);
        }
      } catch (error: any) {
        console.error("Error checking role:", error);
        setIsCheckingRole(false);
      }
    };

    checkRole();
  }, [user, isUserLoading, router, firestore, auth, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    try {
      // 1. Autenticación con Firebase
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      
      // 2. OBTENER TOKEN Y CREAR COOKIE (Indispensable para el Middleware)
      const token = await userCredential.user.getIdToken();
      Cookies.set('session', token, { expires: 7, secure: true, sameSite: 'strict' });
      
      // 3. Refrescar rutas y redirigir
      router.refresh();
      router.push('/publisher');

    } catch (error: any) {
      console.error("Login Error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Credenciales inválidas.",
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);
        const newUser = userCredential.user;
        
        // CREAR COOKIE EN EL REGISTRO
        const token = await newUser.getIdToken();
        Cookies.set('session', token, { expires: 7, secure: true, sameSite: 'strict' });

        await updateProfile(newUser, { displayName: registerName });

        const nameParts = registerName.trim().split(' ');
        const publisherRef = doc(firestore, 'publishers', newUser.uid);
        await setDoc(publisherRef, {
            id: newUser.uid,
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            email: newUser.email,
            status: 'active',
            createdAt: serverTimestamp(),

        });
        
        toast({ title: "Cuenta creada con éxito" });
        router.refresh();
        router.push('/publisher');

    } catch (error: any) {
        toast({ variant: "destructive", title: "Error en registro", description: error.message });
    }
  };

  const handlePasswordReset = async () => {
    if (!loginEmail || !auth) return;
    try {
      await sendPasswordResetEmail(auth, loginEmail);
      toast({ title: "Correo enviado" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo enviar el correo" });
    }
  };
  
  if (isUserLoading || isCheckingRole) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
       <div className="mb-8 text-center">
        <Link href="/" className="inline-block">
          <Logo className="h-24 w-24" src={settingsData?.logoUrl} />
        </Link>
        <div className="mt-4">
          <h1 className="text-3xl font-bold">Portal</h1>
          <h2 className="text-2xl text-foreground/80">{settingsData?.companyName || "Konimba Group"}</h2>
        </div>
      </div>

       <Tabs defaultValue="login" className="w-full max-sm:max-w-xs max-w-sm">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Entrar</TabsTrigger>
          <TabsTrigger value="register">Registro</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <form onSubmit={handleLogin}>
            <Card>
              <CardHeader><CardTitle>Login</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Input type="email" placeholder="Email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                <Input type="password" placeholder="Contraseña" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button className="w-full" type="submit">Acceder</Button>
                <Button variant="link" type="button" onClick={handlePasswordReset}>¿Olvidaste tu clave?</Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>
        <TabsContent value="register">
          <form onSubmit={handleRegister}>
            <Card>
              <CardHeader><CardTitle>Registro</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="Nombre completo" required value={registerName} onChange={(e) => setRegisterName(e.target.value)} />
                <Input type="email" placeholder="Email" required value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} />
                <Input type="password" placeholder="Mínimo 6 caracteres" required value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} />
              </CardContent>
              <CardFooter>
                <Button className="w-full" type="submit">Crear cuenta</Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>
      </Tabs>
      
      <Button asChild variant="link" className="mt-8">
        <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />Volver</Link>
      </Button>
    </div>
  )
}
