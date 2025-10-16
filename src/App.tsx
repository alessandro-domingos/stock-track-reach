import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Estoque from "./pages/Estoque";
import Liberacoes from "./pages/Liberacoes";
import Agendamentos from "./pages/Agendamentos";
import Carregamento from "./pages/Carregamento";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/estoque"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Estoque />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/liberacoes"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Liberacoes />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agendamentos"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Agendamentos />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/carregamento"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Carregamento />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
