import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type StatusLib = "pendente" | "parcial" | "concluido" | "cancelado";

interface LiberacaoItem {
  id: number;
  produto: string;
  cliente: string;
  quantidade: number;
  quantidadeRetirada: number; // usado como fallback se não houver agendamentos
  pedido: string;
  data: string; // dd/mm/yyyy
  status: StatusLib;
  // campos opcionais caso existam no futuro:
  armazem?: string;
  warehouse_id?: string;
  product_id?: string;
}

interface ScheduleItem {
  id: string | number;
  release_id: string | number | null;
  quantidade: number;
  status: string;
  data_hora?: string | null;
}

interface WithdrawalEntry {
  data: string;
  quantidade: number;
}

const formatDateBR = (d = new Date()) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const getStatusText = (status: StatusLib) => {
  switch (status) {
    case "concluido":
      return "Concluído";
    case "parcial":
      return "Parcial";
    case "pendente":
      return "Pendente";
    case "cancelado":
      return "Cancelado";
    default:
      return status;
  }
};

const getStatusBadgeClasses = (status: StatusLib) => {
  switch (status) {
    case "pendente":
      return "bg-yellow-500 text-white";
    case "parcial":
      return "bg-blue-500 text-white";
    case "concluido":
      return "bg-green-600 text-white";
    case "cancelado":
      return "bg-red-600 text-white";
    default:
      return "bg-secondary text-secondary-foreground";
  }
};

const Liberacoes = () => {
  const { toast } = useToast();
  const { hasRole, user } = useAuth();

  const canCreate = hasRole("logistica") || hasRole("admin");
  const canViewDetails = hasRole("admin") || hasRole("logistica") || hasRole("armazem");
  const canCancel = hasRole("logistica") || hasRole("admin");

  const [liberacoes, setLiberacoes] = useState<LiberacaoItem[]>([
    { id: 1, produto: "Ureia", cliente: "Cliente ABC Ltda", quantidade: 10.0, quantidadeRetirada: 6.0, pedido: "PED-2024-001", data: "15/01/2024", status: "parcial" },
    { id: 2, produto: "NPK 20-05-20", cliente: "Transportadora XYZ", quantidade: 15.0, quantidadeRetirada: 0, pedido: "PED-2024-002", data: "16/01/2024", status: "pendente" },
    { id: 3, produto: "Super Simples", cliente: "Fazenda Boa Vista", quantidade: 20.0, quantidadeRetirada: 20.0, pedido: "PED-2024-003", data: "14/01/2024", status: "concluido" },
    { id: 4, produto: "MAP", cliente: "Agro Tech", quantidade: 8.5, quantidadeRetirada: 0, pedido: "PED-2024-004", data: "16/01/2024", status: "pendente" },
  ]);

  // Diálogo de detalhes
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<LiberacaoItem | null>(null);
  const [relatedSchedules, setRelatedSchedules] = useState<ScheduleItem[]>([]);
  const [withdrawHistory, setWithdrawHistory] = useState<WithdrawalEntry[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const openDetails = async (lib: LiberacaoItem) => {
    if (!canViewDetails) {
      toast({
        variant: "destructive",
        title: "Permissão insuficiente",
        description: "Apenas Admin, Logística ou Armazém podem visualizar detalhes.",
      });
      return;
    }

    setSelectedRelease(lib);
    setDetailsOpen(true);
    setLoadingDetails(true);

    // Busca agendamentos relacionados: tenta 'agendamentos', depois 'schedules'
    let schedules: ScheduleItem[] = [];
    try {
      let resp = await supabase
        .from("agendamentos")
        .select("id, release_id, quantidade, status, data_hora")
        .eq("release_id", lib.id);
      if (resp.error) throw resp.error;
      schedules = (resp.data || []) as unknown as ScheduleItem[];
    } catch {
      try {
        const resp2 = await supabase
          .from("schedules")
          .select("id, release_id, quantidade, status, data_hora")
          .eq("release_id", lib.id);
        if (!resp2.error) {
          schedules = (resp2.data || []) as unknown as ScheduleItem[];
        }
      } catch {
        // fallback vazio
      }
    }

    setRelatedSchedules(schedules);

    // Histórico de retiradas e total retirado a partir dos agendamentos
    const withdrawnStatuses = ["carregado", "entregue", "concluido"];
    const hist: WithdrawalEntry[] = schedules
      .filter((s) => withdrawnStatuses.includes((s.status || "").toLowerCase()))
      .map((s) => ({
        data: s.data_hora ? formatDateBR(new Date(s.data_hora)) : "-",
        quantidade: Number(s.quantidade || 0),
      }));
    setWithdrawHistory(hist);

    setLoadingDetails(false);
  };

  const totalRetiradoCalculado = useMemo(() => {
    if (!withdrawHistory.length) return null;
    return withdrawHistory.reduce((sum, w) => sum + (Number(w.quantidade) || 0), 0);
  }, [withdrawHistory]);

  const quantidadeRestante = useMemo(() => {
    if (!selectedRelease) return 0;
    const retirado = totalRetiradoCalculado ?? Number(selectedRelease.quantidadeRetirada || 0);
    return Math.max(0, Number(selectedRelease.quantidade || 0) - retirado);
  }, [selectedRelease, totalRetiradoCalculado]);

  const handleCancelRelease = async () => {
    if (!selectedRelease) return;
    if (!canCancel) {
      toast({
        variant: "destructive",
        title: "Permissão insuficiente",
        description: "Apenas Logística ou Admin podem cancelar liberações.",
      });
      return;
    }
    if (!["pendente", "parcial"].includes(selectedRelease.status)) {
      toast({
        variant: "destructive",
        title: "Ação indisponível",
        description: "A liberação não está em estado que permita cancelamento.",
      });
      return;
    }

    const ok = window.confirm("Tem certeza que deseja cancelar esta liberação?");
    if (!ok) return;

    // Atualização local imediata
    setLiberacoes((prev) =>
      prev.map((l) => (l.id === selectedRelease.id ? { ...l, status: "cancelado" as StatusLib } : l))
    );
    setSelectedRelease((s) => (s ? { ...s, status: "cancelado" } : s));

    toast({
      title: "Liberação cancelada",
      description: `Pedido ${selectedRelease.pedido} foi marcado como cancelado.`,
    });

    // Tenta persistir no backend
    try {
      const { error } = await supabase
        .from("liberacoes")
        .update({
          status: "cancelado",
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id ?? null,
        })
        .eq("id", selectedRelease.id);

      if (error) {
        toast({
          variant: "destructive",
          title: "Persistência pendente",
          description:
            "Não foi possível salvar o cancelamento no banco agora. A alteração local foi mantida. Aplique as migrations e tente novamente.",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Persistência pendente",
        description:
          "Não foi possível salvar o cancelamento no banco agora. A alteração local foi mantida. Aplique as migrations e tente novamente.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Liberações de Produtos"
        description="Gerencie as liberações de produtos para clientes"
        actions={
          <Button className="bg-gradient-primary" disabled={!canCreate} title={!canCreate ? "Apenas Logística ou Admin" : "Nova Liberação"}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Liberação
          </Button>
        }
      />

      <div className="container mx-auto px-6 py-8">
        <div className="grid gap-4">
          {liberacoes.map((lib) => (
            <Card key={lib.id} className="transition-all hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-success">
                      <ClipboardList className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{lib.produto}</h3>
                      <p className="text-sm text-muted-foreground">{lib.cliente}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Pedido: <span className="font-medium text-foreground">{lib.pedido}</span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Quantidade: <span className="font-medium text-foreground">{lib.quantidade}</span> — Retirada:{" "}
                        <span className="font-medium text-foreground">{lib.quantidadeRetirada}</span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">Data: {lib.data}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClasses(lib.status)}`}>
                      {getStatusText(lib.status)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDetails(lib)}
                      disabled={!canViewDetails}
                      title={!canViewDetails ? "Apenas Admin/Logística/Armazém" : "Ver detalhes"}
                    >
                      Detalhes
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Dialog de Detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Detalhes da Liberação {selectedRelease ? `— ${selectedRelease.produto} (${selectedRelease.pedido})` : ""}
            </DialogTitle>
          </DialogHeader>

          {loadingDetails ? (
            <div className="py-6 text-sm text-muted-foreground">Carregando detalhes...</div>
          ) : selectedRelease ? (
            <div className="space-y-6">
              {/* Informações Gerais */}
              <section className="space-y-2">
                <h4 className="font-medium">Informações Gerais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Produto: </span>
                    <span className="text-foreground font-medium">{selectedRelease.produto}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cliente: </span>
                    <span className="text-foreground font-medium">{selectedRelease.cliente}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Armazém: </span>
                    <span className="text-foreground font-medium">{selectedRelease.armazem || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pedido: </span>
                    <span className="text-foreground font-medium">{selectedRelease.pedido}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data de Liberação: </span>
                    <span className="text-foreground font-medium">{selectedRelease.data}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Status: </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClasses(selectedRelease.status)}`}>
                      {getStatusText(selectedRelease.status)}
                    </span>
                  </div>
                </div>
              </section>

              {/* Quantidades */}
              <section className="space-y-2">
                <h4 className="font-medium">Quantidades</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Liberada: </span>
                    <span className="font-medium text-foreground">{selectedRelease.quantidade}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Retirada: </span>
                    <span className="font-medium text-foreground">
                      {(totalRetiradoCalculado ?? selectedRelease.quantidadeRetirada) || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Restante: </span>
                    <span className="font-medium text-foreground">{quantidadeRestante}</span>
                  </div>
                </div>
                {quantidadeRestante <= 0 && selectedRelease.status !== "concluido" && (
                  <p className="text-xs text-muted-foreground">Liberação totalmente retirada.</p>
                )}
              </section>

              {/* Agendamentos Relacionados */}
              <section className="space-y-2">
                <h4 className="font-medium">Agendamentos Relacionados</h4>
                {relatedSchedules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum agendamento encontrado.</p>
                ) : (
                  <div className="space-y-2">
                    {relatedSchedules.map((ag) => (
                      <div key={ag.id} className="text-sm flex items-center justify-between border rounded p-2">
                        <div>
                          <div>
                            <span className="text-muted-foreground">Data/Hora: </span>
                            <span className="text-foreground">
                              {ag.data_hora ? new Date(ag.data_hora).toLocaleString() : "-"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Quantidade: </span>
                            <span className="text-foreground font-medium">{ag.quantidade}</span>
                          </div>
                        </div>
                        <div>
                          <Badge variant="secondary">{String(ag.status || "").toUpperCase()}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Histórico de Retiradas */}
              <section className="space-y-2">
                <h4 className="font-medium">Histórico de Retiradas</h4>
                {withdrawHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma retirada registrada.</p>
                ) : (
                  <div className="space-y-2">
                    {withdrawHistory.map((w, idx) => (
                      <div key={idx} className="text-sm flex items-center justify-between border rounded p-2">
                        <span>{w.data}</span>
                        <span className="font-medium">{w.quantidade}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <DialogFooter>
                {["pendente", "parcial"].includes(selectedRelease.status) && canCancel && (
                  <Button variant="destructive" onClick={handleCancelRelease}>
                    Cancelar Liberação
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Liberacoes;
