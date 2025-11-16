import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const emailSchema = z.string().trim().email().max(255);
const passwordSchema = z.string().min(6);
const nomeSchema = z.string().trim().min(2).max(100);

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  userRoles: string[];
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // Setup auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user roles after auth state changes
          setTimeout(async () => {
            const { data: roles } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id);
            
            if (roles) {
              setUserRoles(roles.map(r => r.role));
            }
          }, 0);
        } else {
          setUserRoles([]);
        }
      }
    );

    // Check existing session and fetch roles
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id);
        
        if (roles) {
          setUserRoles(roles.map(r => r.role));
        }
      }
      
      setLoading(false);
    };

    initializeAuth();

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    // Validate inputs
    const emailResult = emailSchema.safeParse(email);
    const passwordResult = passwordSchema.safeParse(password);
    
    if (!emailResult.success || !passwordResult.success) {
      toast({
        variant: "destructive",
        title: "Erro de validação",
        description: "Email ou senha inválidos"
      });
      return { error: new Error("Validation failed") };
    }
    
    const { error } = await supabase.auth.signInWithPassword({ 
      email: emailResult.data, 
      password: passwordResult.data 
    });
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao fazer login",
        description: error.message
      });
    }
    
    return { error };
  };

  const signUp = async (email: string, password: string, nome: string) => {
    // Validate inputs
    const emailResult = emailSchema.safeParse(email);
    const passwordResult = passwordSchema.safeParse(password);
    const nomeResult = nomeSchema.safeParse(nome);
    
    if (!emailResult.success || !passwordResult.success || !nomeResult.success) {
      toast({
        variant: "destructive",
        title: "Erro de validação",
        description: "Por favor, verifique os dados informados"
      });
      return { error: new Error("Validation failed") };
    }
    
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email: emailResult.data,
      password: passwordResult.data,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nome: nomeResult.data
        }
      }
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao criar conta",
        description: error.message
      });
    } else {
      toast({
        title: "Conta criada com sucesso!",
        description: "Você já pode fazer login com a role padrão de cliente."
      });
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserRoles([]);
    toast({
      title: "Logout realizado",
      description: "Até logo!"
    });
  };

  const hasRole = (role: string) => userRoles.includes(role);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signIn,
      signUp,
      signOut,
      userRoles,
      hasRole
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
