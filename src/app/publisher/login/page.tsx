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
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";

type CompanySettings = {
  companyName?: string;
  logoUrl?: string;
};

export default function PublisherAuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCheckingRole, setIsCheckingRole] = useState(true); 

  const auth = useAuth();
  const firestore = db;
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);


  useEffect(() => {
    if (isUserLoading) {
      return;
    }
    
    if (!user) {
      setIsCheckingRole(false);
      return;
    }

    const checkRole = async () => {
      setIsCheckingRole(true);
      
      if (!firestore) {
        console.error("Firestore no está inicializado.");
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
            description: "Los administradores no pueden iniciar sesión en el panel de publishers.",
          });
          if (auth) await auth.signOut();
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
        console.error("Error checking user role:", error);
        toast({
          variant: "destructive",
          title: "Error de verificación de permisos",
          description: "No se pudo verificar el rol. Revisa tus reglas de seguridad de Firestore.",
        });
        if (auth) await auth.signOut();
        setIsCheckingRole(false);
      }
    };

    checkRole();
  }, [user, isUserLoading, router, firestore, auth, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Publisher Login Error:", error);
      let description = "No se pudo iniciar sesión. Verifica tus credenciales.";
      if (error.code === 'auth/invalid-credential') {
        description = "Correo electrónico o contraseña incorrectos."
      }
      toast({
        variant: "destructive",
        title: "Error de inicio de sesión",
        description: description,
      });
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Correo electrónico requerido",
        description: "Por favor, introduce tu correo electrónico para restablecer la contraseña.",
      });
      return;
    }
    if (!auth) return;
    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "Correo de recuperación enviado",
        description: "Revisa tu bandeja de entrada para restablecer tu contraseña.",
      });
    } catch (error: any) {
      console.error("Password Reset Error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo enviar el correo de recuperación. Verifica que el correo sea correcto.",
      });
    }
  };
  
  if (isUserLoading || isCheckingRole) {
    return <div className="flex items-center justify-center min-h-screen">Verificando sesión y permisos...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
       <div className="mb-8 text-center">
        <Link href="/" className="inline-block">
          <Logo className="h-24 w-24" src={settingsData?.logoUrl} />
        </Link>
        <div className="mt-4">
          <h1 className="text-3xl font-bold font-headline">Portal</h1>
          <h2 className="text-2xl font-bold font-headline text-foreground/80">{settingsData?.companyName || "Konimba Group Marketing"}</h2>
        </div>
        <p className="text-muted-foreground mt-2">Acceso de Publisher</p>
      </div>
      <form onSubmit={handleLogin} className="w-full max-w-sm">
        <Card>
          <CardHeader>
          <CardTitle>Iniciar Sesión</CardTitle>
          <CardDescription>
              Accede a tu panel de publisher.
          </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="tu@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button className="w-full" type="submit">Acceder</Button>
            <Button variant="link" type="button" onClick={handlePasswordReset} className="text-sm font-normal">
              ¿Olvidaste tu contraseña?
            </Button>
          </CardFooter>
        </Card>
      </form>
      
      <Button asChild variant="link" className="mt-8">
        <Link href="/" >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al inicio
        </Link>
      </Button>
    </div>
  )
}
