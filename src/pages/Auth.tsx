import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Package } from "lucide-react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Login realizado!",
          description: "Bem-vindo ao LogisticPro",
        });
        
        navigate("/");
      } else {
        if (!role) {
          toast({
            title: "Erro",
            description: "Selecione um perfil de acesso",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { nome },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        if (data.user) {
          const { error: roleError } = await supabase
            .from("user_roles")
            .insert([{ user_id: data.user.id, role: role as any }]);

          if (roleError) throw roleError;

          toast({
            title: "Conta criada!",
            description: "Você já pode fazer login",
          });
          
          setIsLogin(true);
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-primary p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-primary flex items-center justify-center">
              <Package className="h-10 w-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">LogisticPro</CardTitle>
          <CardDescription>
            {isLogin ? "Entre com sua conta" : "Crie sua conta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo</Label>
                <Input
                  id="nome"
                  type="text"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="role">Perfil de Acesso</Label>
                <Select value={role} onValueChange={setRole} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione seu perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="logistica">Logística</SelectItem>
                    <SelectItem value="comercial">Comercial</SelectItem>
                    <SelectItem value="cliente">Cliente/Transportadora</SelectItem>
                    <SelectItem value="armazem">Armazém</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-primary"
              disabled={loading}
            >
              {loading ? "Carregando..." : isLogin ? "Entrar" : "Criar Conta"}
            </Button>

            <div className="text-center text-sm">
              {isLogin ? "Não tem uma conta? " : "Já tem uma conta? "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary font-medium hover:underline"
              >
                {isLogin ? "Cadastre-se" : "Faça login"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
