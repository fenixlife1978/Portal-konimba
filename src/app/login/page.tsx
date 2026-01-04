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
import { useAuth, useUser, useDoc, useFirestore } from "@/firebase"; 
import { signInWithEmailAndPassword, updateProfile, createUserWithEmailAndPassword } from "firebase/auth";
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/logo";
import { doc, getDoc } from "firebase/firestore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import Link from "next/link";

type CompanySettings = {
  companyName?: string;
  logoUrl?: string;
};

export default function LoginPage() {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);

  useEffect(() => {
    if (!isUserLoading && user) {
        // If user is already logged in, check their role and redirect
        checkRoleAndRedirect(user.uid);
    }
  }, [user, isUserLoading]);
  
  const checkRoleAndRedirect = async (uid: string) => {
    if (!firestore) return;
    const adminRoleRef = doc(firestore, 'roles_admin', uid);
    try {
        const docSnap = await getDoc(adminRoleRef);
        if (docSnap.exists()) {
            router.replace('/admin');
        } else {
            router.replace('/publisher');
        }
    } catch (error) {
        // Default to publisher if role check fails
        router.replace('/publisher');
    }
  }


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      // The useEffect will handle the redirect after state update
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error de Acceso",
        description: "Credenciales inválidas o la cuenta no existe. Por favor, verifica tus datos."
      });
       setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    
    setIsLoading(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);
        
        const [firstName, ...lastNameParts] = registerName.trim().split(' ');
        const lastName = lastNameParts.join(' ');

        await updateProfile(userCredential.user, { displayName: registerName });

        const publisherDocRef = doc(firestore, 'publishers', userCredential.user.uid);
        setDocumentNonBlocking(publisherDocRef, {
            id: userCredential.user.uid,
            firstName: firstName || '',
            lastName: lastName || '',
            email: userCredential.user.email,
            status: 'active',
        }, { merge: true });
        
        // The useEffect will handle the redirect
    } catch (error: any) {
        toast({ 
            variant: "destructive", 
            title: "Error de Registro", 
            description: "No se pudo completar el registro. El email podría ya estar en uso." 
        });
        setIsLoading(false);
    }
  };

  if (isUserLoading || user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        <p className="mt-4 text-sm text-muted-foreground">Validando sesión...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30 p-4">
      <div className="mb-8 flex flex-col items-center text-center">
         <Link href="/" className="inline-block">
            <Logo className="h-16 w-16" src={settingsData?.logoUrl} />
         </Link>
        <h1 className="text-2xl font-bold mt-4">{settingsData?.companyName || "Cargando..."}</h1>
        <p className="text-muted-foreground">Portal de Acceso</p>
      </div>

      <Tabs defaultValue="login" className="w-full max-w-sm">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Ingresar</TabsTrigger>
          <TabsTrigger value="register">Registrarse (Publishers)</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <form onSubmit={handleLogin}>
            <Card>
              <CardHeader>
                <CardTitle>Bienvenido</CardTitle>
                <CardDescription>Accede a tu panel de control.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" placeholder="Email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} disabled={isLoading} />
                 </div>
                 <div className="space-y-2">
                  <Label htmlFor="login-password">Contraseña</Label>
                  <Input id="login-password" type="password" placeholder="Contraseña" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} disabled={isLoading} />
                 </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" type="submit" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLoading ? "Validando..." : "Acceder"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>
        <TabsContent value="register">
          <form onSubmit={handleRegister}>
            <Card>
                <CardHeader>
                    <CardTitle>Crear Cuenta de Publisher</CardTitle>
                    <CardDescription>Regístrate para acceder a tu panel.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="register-name">Nombre y Apellido</Label>
                        <Input id="register-name" type="text" placeholder="Nombre y Apellido" required value={registerName} onChange={(e) => setRegisterName(e.target.value)} disabled={isLoading} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="register-email">Email</Label>
                        <Input id="register-email" type="email" placeholder="Email" required value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} disabled={isLoading} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="register-password">Contraseña</Label>
                        <Input id="register-password" type="password" placeholder="Mínimo 6 caracteres" required value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} disabled={isLoading} />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button className="w-full" type="submit" disabled={isLoading}>
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {isLoading ? "Creando cuenta..." : "Registrarse"}
                    </Button>
                </CardFooter>
            </Card>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
