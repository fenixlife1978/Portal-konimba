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
// Asegúrate de que estos imports personalizados funcionen en tu proyecto
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase"; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/logo"; // Asumo que este componente existe
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

type CompanySettings = {
  companyName?: string;
};

export default function PublisherAuthPage() {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerFirstName, setRegisterFirstName] = useState('');
  const [registerLastName, setRegisterLastName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  // Inicializamos a true para evitar renderizado parpadeante mientras comprobamos el estado inicial
  const [isCheckingRole, setIsCheckingRole] = useState(true); 

  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser(); // Hook personalizado que expone el usuario y el estado de carga
  const router = useRouter();
  const { toast } = useToast(); // Hook personalizado para notificaciones

  const settingsRef = useMemoFirebase(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);


  useEffect(() => {
    // 1. Esperamos a que el hook useUser termine de determinar si hay un usuario logueado o no.
    if (isUserLoading) {
      return;
    }
    
    // 2. Si no hay usuario logueado, terminamos la verificación y mostramos el formulario.
    if (!user) {
      setIsCheckingRole(false);
      return;
    }

    // 3. Si hay un usuario, procedemos a verificar su rol en Firestore.
    const checkRole = async () => {
      setIsCheckingRole(true); // Iniciamos el proceso de verificación del rol
      
      if (!firestore) {
        console.error("Firestore no está inicializado.");
        setIsCheckingRole(false);
        return;
      };

      const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
      const publisherRef = doc(firestore, 'publishers', user.uid);

      try {
        // *** ESTAS LÍNEAS REQUIEREN PERMISOS DE LECTURA EN FIRESTORE RULES ***
        const adminDocSnap = await getDoc(adminRoleRef);
        
        if (adminDocSnap.exists()) {
          // Es un admin, lo sacamos de aquí
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
          // Es un publisher, lo dejamos entrar
          router.push('/publisher');
          // No establecemos isCheckingRole(false) porque la redirección interrumpe el renderizado.
        } else {
          // No es admin, no es publisher. 
           const isNewUser = user.metadata.creationTime === user.metadata.lastSignInTime;
           if (!isNewUser) {
             // Si el usuario no es nuevo (ya existía pero no tiene rol asignado)
             toast({
               variant: "destructive",
               title: "Rol no encontrado",
               description: "No eres un publisher registrado. Se cerrará la sesión.",
             });
             if (auth) await auth.signOut();
           }
           // Si es un usuario nuevo (acaba de registrarse), el flujo de registro lo manejará.
           setIsCheckingRole(false);
        }
      } catch (error: any) {
        console.error("Error checking user role:", error);
        // Este catch es donde se atrapa el error de permisos de Firestore
        toast({
          variant: "destructive",
          title: "Error de verificación de permisos",
          // Mensaje clave para el usuario:
          description: "No se pudo verificar el rol. Revisa tus reglas de seguridad de Firestore para las colecciones 'publishers' y 'roles_admin'.",
        });
        if (auth) await auth.signOut();
        setIsCheckingRole(false);
      }
    };

    checkRole();
  }, [user, isUserLoading, router, firestore, auth, toast]); // Dependencias completas del useEffect

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    try {
      // Firebase Auth se encarga del inicio de sesión.
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      // El hook useEffect se encargará de verificar el rol y la redirección automáticamente.
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

      // *** ESTA LÍNEA REQUIERE PERMISOS DE ESCRITURA EN FIRESTORE RULES ***
      const publisherRef = doc(firestore, 'publishers', newUser.uid);
      await setDoc(publisherRef, {
        id: newUser.uid,
        firstName: registerFirstName,
        lastName: registerLastName,
        email: registerEmail,
        status: 'active',
        role: 'publisher',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast({
        title: "¡Bienvenido!",
        description: "Tu cuenta de publisher ha sido creada.",
      });
      // useEffect will handle user state change and redirect to /publisher
    } catch (error: any) {
      console.error("Publisher Registration Error:", error);
      let description = "No se pudo crear la cuenta.";
      if (error.code === 'auth/email-already-in-use') {
        description = "Este correo electrónico ya está en uso."
      } else if (error.code === 'permission-denied' || (error.name === 'FirebaseError' && error.message.includes('permission-denied'))) {
         // Captura el error específico de reglas de seguridad al intentar setDoc.
        description = "Error de permisos de Firebase. Revisa tus reglas de Firestore para la colección 'publishers'.";
      }
      toast({
        variant: "destructive",
        title: "Error de registro",
        description: description,
      });
    }
  };
  
  if (isUserLoading || isCheckingRole) {
    // Muestra un spinner o mensaje de carga mientras se verifica el estado y el rol
    return <div className="flex items-center justify-center min-h-screen">Verificando sesión y permisos...</div>;
  }

  // Si no hay usuario y ya terminamos de cargar/chequear, mostramos el formulario
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
       <div className="mb-8 text-center">
        <Link href="/" className="inline-block">
          <Logo className="h-24 w-24" />
        </Link>
        <div className="mt-4">
          <h1 className="text-3xl font-bold font-headline">Portal</h1>
          <h2 className="text-2xl font-bold font-headline text-foreground/80">Konimba Group Marketing</h2>
        </div>
        <p className="text-muted-foreground mt-2">Acceso de Publisher</p>
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
                  <Input id="email" type="email" placeholder="tu@email.com" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input id="password" type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col">
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
                  <Input id="register-email" type="email" placeholder="tu@email.com" required value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="role">Rol</Label>
                    <Input id="role" type="text" value="Publisher" readOnly className="bg-muted/50" />
                  </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Contraseña</Label>                  
                  <Input id="register-password" type="password" required value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} />
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
