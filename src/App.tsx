import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Estoque from "./pages/Estoque";
import Liberacoes from "./pages/Liberacoes";
import Agendamentos from "./pages/Agendamentos";
import Carregamento from "./pages/Carregamento";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<Layout><Dashboard /></Layout>} />
          <Route path="/estoque" element={<Layout><Estoque /></Layout>} />
          <Route path="/liberacoes" element={<Layout><Liberacoes /></Layout>} />
          <Route path="/agendamentos" element={<Layout><Agendamentos /></Layout>} />
          <Route path="/carregamento" element={<Layout><Carregamento /></Layout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
