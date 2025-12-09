'use client';
import { useState, useEffect } from "react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useAuth, useUser, useFirestore } from "@/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/logo";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";


export default function PublisherAuthPage() {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

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
      if (!firestore) return;

      const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
      const publisherRef = doc(firestore, 'publishers', user.uid);

      try {
        const [adminDocSnap, publisherDocSnap] = await Promise.all([
          getDoc(adminRoleRef),
          getDoc(publisherRef),
        ]);
        
        if (adminDocSnap.exists()) {
          toast({
            variant: "destructive",
            title: "Acceso no permitido",
            description: "Los administradores no pueden iniciar sesión en el panel de publishers.",
          });
          if (auth) await auth.signOut();
          setIsCheckingRole(false);
        } else if (publisherDocSnap.exists()) {
          router.push('/publisher');
        } else {
           const isNewUser = user.metadata.creationTime === user.metadata.lastSignInTime;
           if (!isNewUser) {
             toast({
               variant: "destructive",
               title: "Rol no encontrado",
               description: "No eres un publisher registrado. Se cerrará la sesión.",
             });
             if (auth) await auth.signOut();
           }
           setIsCheckingRole(false);
        }
      } catch (error) {
        console.error("Error checking user role:", error);
        toast({
          variant: "destructive",
          title: "Error de verificación",
          description: "No se pudo verificar el rol. Se cerrará la sesión.",
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
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      // The useEffect hook will handle role check and redirection
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
  
  if (isUserLoading || isCheckingRole) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
       <div className="mb-8 text-center">
        <Link href="/" className="inline-block">
          <Logo />
        </Link>
        <h1 className="text-3xl font-bold font-headline mt-4">Siren's Portal</h1>
        <p className="text-muted-foreground">Acceso de Publisher</p>
      </div>
      <Card className="w-full max-w-sm">
        <form onSubmit={handleLogin}>
            <CardHeader>
              <CardTitle>Iniciar Sesión</CardTitle>
              <CardDescription>
                Accede a tu panel de publisher.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="tu@email.com" 
                  required 
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" type="submit">Acceder</Button>
            </CardFooter>
        </form>
      </Card>
      <Button asChild variant="link" className="mt-8">
        <Link href="/" >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al inicio
        </Link>
      </Button>
    </div>
  )
}
