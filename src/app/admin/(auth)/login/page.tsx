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
import { Logo } from "@/components/logo";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
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

    const checkAdminRole = async () => {
      setIsCheckingAdmin(true);
      const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
      try {
        const docSnap = await getDoc(adminRoleRef);
        if (docSnap.exists()) {
          router.push('/admin');
        } else {
          toast({
            variant: "destructive",
            title: "Acceso denegado",
            description: "No tienes permisos de administrador. Se cerrará tu sesión.",
          });
          if(auth) await auth.signOut();
          setIsCheckingAdmin(false);
        }
      } catch (error) {
        console.error("Error checking admin role:", error);
        toast({
            variant: "destructive",
            title: "Error de verificación",
            description: "No se pudo verificar el rol de administrador.",
          });
        if(auth) await auth.signOut();
        setIsCheckingAdmin(false);
      }
    };

    checkAdminRole();

  }, [user, isUserLoading, router, firestore, auth, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      // The useEffect will handle the role check and redirect on successful login
    } catch (error: any) {
      console.error("Admin Login Error:", error);
      let description = "Ocurrió un error al intentar iniciar sesión.";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        description = "El correo electrónico o la contraseña son incorrectos. Por favor, verifica tus credenciales.";
      } else if (error.message) {
        description = error.message;
      }
      toast({
        variant: "destructive",
        title: "Error de acceso",
        description: description,
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
  
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);
      const newUser = userCredential.user;
      
      await updateProfile(newUser, { displayName: registerName });

      const adminRoleRef = doc(firestore, 'roles_admin', newUser.uid);
      
      await setDoc(adminRoleRef, { role: 'admin' });
      toast({
        title: "¡Administrador registrado!",
        description: "La cuenta de administrador ha sido creada.",
      });
      // The useEffect will handle the redirect after state change

    } catch (error: any) {
      console.error("Admin Registration Error:", error);
      
      let description = "No se pudo crear la cuenta de administrador.";
      if (error.code === 'auth/email-already-in-use') {
        description = "Este correo electrónico ya está en uso. Por favor, utiliza otro."
      } else if (error.code === 'permission-denied') {
        description = "No tienes permisos para crear una cuenta de administrador.";
      } else if (error.message) {
        description = error.message;
      }
      
      toast({
        variant: "destructive",
        title: "Error de registro",
        description: description,
      });

      // If user was created in Auth but role assignment failed in Firestore, delete the user.
      if (userCredential && userCredential.user && (error.code === 'permission-denied' || error.code !== 'auth/email-already-in-use')) {
        try {
            await userCredential.user.delete();
            console.log("Partial user deleted after registration failure.");
        } catch (deleteError) {
            console.error("Failed to delete user after role assignment failure:", deleteError);
            toast({
                variant: "destructive",
                title: "Error de limpieza",
                description: "No se pudo eliminar el usuario creado parcialmente. Contacta al soporte.",
            });
        }
      }
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
                  Crea una cuenta de administrador. Solo el superadmin puede hacerlo.
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
