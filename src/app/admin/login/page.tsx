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
import { useAuth, useUser } from "@/firebase";
import { initiateEmailSignIn } from "@/firebase/non-blocking-login";
import { Logo } from "@/components/logo";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function AdminAuthPage() {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

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
      setIsCheckingAdmin(false);
      return;
    }

    const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
    getDoc(adminRoleRef).then(docSnap => {
      if (docSnap.exists()) {
        router.push('/admin');
      } else {
        toast({
          variant: "destructive",
          title: "Acceso denegado",
          description: "No tienes permisos de administrador. Se cerrará tu sesión.",
        });
        auth.signOut();
        setIsCheckingAdmin(false); // Allow rendering the login form
      }
    }).catch(() => {
        setIsCheckingAdmin(false);
    });

  }, [user, isUserLoading, router, firestore, auth, toast]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    initiateEmailSignIn(auth, loginEmail, loginPassword);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
  
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);
      const newUser = userCredential.user;
      
      await updateProfile(newUser, { displayName: registerName });

      const adminRoleRef = doc(firestore, 'roles_admin', newUser.uid);
      
      try {
        await setDoc(adminRoleRef, { role: 'admin' });
        toast({
          title: "¡Administrador registrado!",
          description: "La cuenta de administrador ha sido creada.",
        });
      } catch (firestoreError: any) {
        console.error("Firestore Admin Role Error:", firestoreError);
        toast({
          variant: "destructive",
          title: "Error al asignar rol",
          description: firestoreError.message || "No se pudo asignar el rol de administrador.",
        });
        await newUser.delete();
      }

    } catch (authError: any) {
      console.error("Admin Auth Registration Error:", authError);
      toast({
        variant: "destructive",
        title: "Error de registro",
        description: authError.message || "No se pudo crear la cuenta de administrador.",
      });
    }
  };

  if (isUserLoading || isCheckingAdmin) {
    return <div className="flex items-center justify-center min-h-screen">Verificando permisos...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-block">
          <Logo />
        </Link>
        <h1 className="text-3xl font-bold font-headline mt-4">Siren's Portal</h1>
        <p className="text-muted-foreground">Acceso de Administrador</p>
      </div>

      <Tabs defaultValue="login" className="w-full max-w-sm">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
          <TabsTrigger value="register">Registrarse</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <form onSubmit={handleLogin}>
            <Card>
              <CardHeader>
                <CardTitle>Iniciar Sesión</CardTitle>
                <CardDescription>
                  Accede al panel de administrador.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@email.com"
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
            </Card>
          </form>
        </TabsContent>
        <TabsContent value="register">
           <form onSubmit={handleRegister}>
            <Card>
              <CardHeader>
                <CardTitle>Registrar Administrador</CardTitle>
                <CardDescription>
                  Crea la primera cuenta de administrador.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input 
                    id="name" 
                    type="text" 
                    placeholder="Tu Nombre" 
                    required
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input 
                    id="register-email" 
                    type="email" 
                    placeholder="tu@email.com" 
                    required 
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Contraseña</Label>
                  <Input 
                    id="register-password" 
                    type="password" 
                    required 
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" type="submit">Crear Cuenta de Admin</Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>
      </Tabs>
      
      <Button asChild variant="link" className="mt-8">
        <Link href="/" >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al inicio
        </Link>
      </Button>
    </div>
  )
}
