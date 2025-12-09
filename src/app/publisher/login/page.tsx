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
  const [registerFirstName, setRegisterFirstName] = useState('');
  const [registerLastName, setRegisterLastName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);
      const newUser = userCredential.user;
      
      await updateProfile(newUser, { displayName: `${registerFirstName} ${registerLastName}` });

      const publisherRef = doc(firestore, 'publishers', newUser.uid);
      await setDoc(publisherRef, {
        id: newUser.uid,
        firstName: registerFirstName,
        lastName: registerLastName,
        email: registerEmail,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast({
        title: "¡Bienvenido!",
        description: "Tu cuenta de publisher ha sido creada.",
      });
      // useEffect will redirect to /publisher on user state change
    } catch (error: any) {
      console.error("Publisher Registration Error:", error);
      let description = "No se pudo crear la cuenta.";
      if (error.code === 'auth/email-already-in-use') {
        description = "Este correo electrónico ya está en uso."
      } else if (error.code === 'permission-denied') {
        description = "No tienes permisos para crear una cuenta."
      }
      toast({
        variant: "destructive",
        title: "Error de registro",
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
            </Card>
          </form>
        </TabsContent>
        <TabsContent value="register">
           <form onSubmit={handleRegister}>
            <Card>
              <CardHeader>
                <CardTitle>Crear Cuenta de Publisher</CardTitle>
                <CardDescription>
                  Regístrate para acceder a tu panel de publisher.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nombre</Label>
                    <Input id="firstName" placeholder="Juan" required value={registerFirstName} onChange={(e) => setRegisterFirstName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Apellido</Label>
                    <Input id="lastName" placeholder="Pérez" required value={registerLastName} onChange={(e) => setRegisterLastName(e.target.value)} />
                  </div>
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
                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <Input 
                    id="role" 
                    type="text" 
                    value="Publisher" 
                    disabled 
                    className="bg-muted/50"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" type="submit">Crear Cuenta</Button>
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
