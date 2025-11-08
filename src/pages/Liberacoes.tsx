import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ClipboardList, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type Unidade = "t" | "kg";
type StatusLib = "pendente" | "parcial" | "concluido" | "cancelado";

interface ProdutoOption {
  id: string;
  nome: string;
  unidade?: Unidade | null;
}

interface ArmazemOption {
  id: string;
  nome: string;
}

interface LiberacaoItem {
  id: number;
  produto: string;
  cliente: string;
  quantidade: number;
  quantidadeRetirada: number;
  pedido: string;
  data: string; // dd/mm/yyyy
  status: StatusLib;
  armazem?: string;
  produto_id?: string;
  armazem_id?: string;
}

interface AgendamentoItem {
  id: string;
  release_id?: string;
  liberacao_id?: string;
  quantidade: number;
  status: string;
  data_hora?: string;
  data_retirada?: string;
  horario?: string;
}

interface WithdrawalHistoryItem {
  data: string;
  quantidade: number;
}

const formatDateBR = (d = new Date()) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const pedidoRegex = /^PED-\d{4}-\d{4}$/;

const getStatusColor = (status: StatusLib) => {
  switch (status) {
    case "concluido":
      return "default";
    case "parcial":
      return "secondary";
    case "cancelado":
      return "destructive";
    case "pendente":
    default:
      return "outline";
  }
};

const getStatusText = (status: StatusLib) => {
  switch (status) {
    case "concluido":
      return "Concluído";
    case "parcial":
      return "Parcial";
    case "cancelado":
      return "Cancelado";
    case "pendente":
    default:
      return "Pendente";
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
      return "";
  }
};

const Liberacoes = () => {
  const { toast } = useToast();
  const { hasRole, user } = useAuth();
  const canCreate = hasRole("logistica") || hasRole("admin");

  // Lista inicial mockada (mantida) + estado
  const [liberacoes, setLiberacoes] = useState<LiberacaoItem[]>([
    { id: 1, produto: "Ureia", cliente: "Cliente ABC Ltda", quantidade: 10.0, quantidadeRetirada: 6.0, pedido: "PED-2024-001", data: "15/01/2024", status: "parcial", armazem: "Armazém São Paulo" },
    { id: 2, produto: "NPK 20-05-20", cliente: "Transportadora XYZ", quantidade: 15.0, quantidadeRetirada: 0, pedido: "PED-2024-002", data: "16/01/2024", status: "pendente", armazem: "Armazém Rio de Janeiro" },
    { id: 3, produto: "Super Simples", cliente: "Fazenda Boa Vista", quantidade: 20.0, quantidadeRetirada: 20.0, pedido: "PED-2024-003", data: "14/01/2024", status: "concluido", armazem: "Armazém Belo Horizonte" },
    { id: 4, produto: "MAP", cliente: "Agro Tech", quantidade: 8.5, quantidadeRetirada: 0, pedido: "PED-2024-004", data: "16/01/2024", status: "pendente", armazem: "Armazém Curitiba" },
  ]);

  // Dialog e formulário
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Estados para o dialog de detalhes
  const [selectedRelease, setSelectedRelease] = useState<LiberacaoItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [relatedSchedules, setRelatedSchedules] = useState<AgendamentoItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [derivedWithdrawHistory, setDerivedWithdrawHistory] = useState<WithdrawalHistoryItem[]>([]);
  const [form, setForm] = useState({
    cliente: "",
    produtoId: "",
    armazemId: "",
    quantidade: "",
    unidade: "t" as Unidade,
    pedido: "",
  });

  // Opções carregadas
  const [produtos, setProdutos] = useState<ProdutoOption[]>([]);
  const [armazens, setArmazens] = useState<ArmazemOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        // Carregar produtos
        const { data: productsData, error: prodErr } = await supabase
          .from("products")
          .select("id, nome, unidade");
        if (prodErr) throw prodErr;
        setProdutos((productsData || []) as ProdutoOption[]);

        // Carregar armazéns
        const { data: whData, error: whErr } = await supabase
          .from("warehouses")
          .select("id, nome");
        if (whErr) throw whErr;
        setArmazens((whData || []) as ArmazemOption[]);
      } catch {
        toast({
          variant: "destructive",
          title: "Falha ao carregar opções",
          description: "Não foi possível carregar produtos e armazéns agora.",
        });
      } finally {
        setLoadingOptions(false);
      }
    };
    loadOptions();
  }, [toast]);

  const produtoSelecionado = useMemo(
    () => produtos.find((p) => p.id === form.produtoId) || null,
    [produtos, form.produtoId]
  );

  // Se o produto tem unidade definida, usar como sugestão
  useEffect(() => {
    if (produtoSelecionado?.unidade) {
      setForm((s) => ({ ...s, unidade: produtoSelecionado.unidade as Unidade }));
    }
  }, [produtoSelecionado]);

  const resetForm = () => {
    setForm({
      cliente: "",
      produtoId: "",
      armazemId: "",
      quantidade: "",
      unidade: "t",
      pedido: "",
    });
  };

  const checkStockSuficiente = async (productId: string, warehouseId: string, qty: number) => {
    try {
      const { data, error } = await supabase
        .from("stock_balances")
        .select("quantidade_atual")
        .eq("product_id", productId)
        .eq("warehouse_id", warehouseId);

      if (error) throw error;
      const totalDisponivel =
        (data || []).reduce((sum: number, row: { quantidade_atual?: number }) => sum + Number(row.quantidade_atual || 0), 0);
      return totalDisponivel >= qty;
    } catch {
      // Se não conseguimos validar, retornamos null para indicar indeterminado
      return null as unknown as boolean;
    }
  };

  const fetchSchedules = async (releaseId: number): Promise<AgendamentoItem[]> => {
    try {
      // Try agendamentos first
      const { data, error } = await supabase
        .from("agendamentos")
        .select("id, liberacao_id, quantidade, status, data_retirada, horario")
        .eq("liberacao_id", releaseId);

      if (!error && data) {
        return data.map((item) => ({
          ...item,
          data_hora: item.data_retirada && item.horario 
            ? `${item.data_retirada} ${item.horario}` 
            : item.data_retirada || "",
        }));
      }

      // Fallback to schedules table
      const { data: schedData, error: schedError } = await supabase
        .from("schedules")
        .select("id, release_id, quantidade, status, data_hora")
        .eq("release_id", releaseId);

      if (!schedError && schedData) {
        return schedData as AgendamentoItem[];
      }

      return [];
    } catch {
      return [];
    }
  };

  const deriveWithdrawals = (schedules: AgendamentoItem[]): WithdrawalHistoryItem[] => {
    const withdrawalStatuses = ["carregado", "entregue", "concluido", "nf_entregue"];
    const withdrawn = schedules.filter((s) => 
      withdrawalStatuses.includes(s.status?.toLowerCase() || "")
    );

    return withdrawn.map((w) => ({
      data: w.data_hora || w.data_retirada || "-",
      quantidade: w.quantidade,
    }));
  };

  const handleOpenDetails = async (release: LiberacaoItem) => {
    const canView = hasRole("admin") || hasRole("logistica") || hasRole("armazem");
    
    if (!canView) {
      toast({
        variant: "destructive",
        title: "Permissão insuficiente",
        description: "Você não tem permissão para visualizar detalhes.",
      });
      return;
    }

    setSelectedRelease(release);
    setDetailsOpen(true);
    setLoadingDetails(true);
    setRelatedSchedules([]);
    setDerivedWithdrawHistory([]);

    const schedules = await fetchSchedules(release.id);
    setRelatedSchedules(schedules);
    
    const history = deriveWithdrawals(schedules);
    setDerivedWithdrawHistory(history);
    
    setLoadingDetails(false);
  };

  const handleCancelRelease = async () => {
    if (!selectedRelease) return;

    const canCancel = hasRole("admin") || hasRole("logistica");
    if (!canCancel) {
      toast({
        variant: "destructive",
        title: "Permissão insuficiente",
        description: "Apenas Admin ou Logística podem cancelar liberações.",
      });
      return;
    }

    if (!window.confirm("Tem certeza que deseja cancelar esta liberação?")) {
      return;
    }

    // Update local state immediately
    setLiberacoes((prev) =>
      prev.map((lib) =>
        lib.id === selectedRelease.id ? { ...lib, status: "cancelado" as StatusLib } : lib
      )
    );

    if (selectedRelease) {
      setSelectedRelease({ ...selectedRelease, status: "cancelado" as StatusLib });
    }

    // Try to persist to database
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
          description: "A liberação foi cancelada localmente, mas não foi possível salvar no banco agora.",
        });
      } else {
        toast({
          title: "Liberação cancelada",
          description: "A liberação foi cancelada com sucesso.",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Persistência pendente",
        description: "A liberação foi cancelada localmente, mas não foi possível salvar no banco agora.",
      });
    }
  };

  const handleSave = async () => {
    if (!canCreate) {
      toast({
        variant: "destructive",
        title: "Permissão insuficiente",
        description: "Apenas Logística ou Admin podem criar liberações.",
      });
      return;
    }

    // Validações
    if (!form.cliente.trim() || !form.produtoId || !form.armazemId || !form.quantidade || !form.pedido.trim()) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha Cliente, Produto, Armazém, Quantidade e Pedido.",
      });
      return;
    }

    const qtd = Number(form.quantidade);
    if (Number.isNaN(qtd) || qtd <= 0) {
      toast({
        variant: "destructive",
        title: "Quantidade inválida",
        description: "A quantidade deve ser um número maior que zero.",
      });
      return;
    }

    if (!pedidoRegex.test(form.pedido)) {
      toast({
        variant: "destructive",
        title: "Pedido inválido",
        description: 'Use o formato "PED-YYYY-NNNN", por exemplo PED-2025-0001.',
      });
      return;
    }

    // Checar estoque suficiente
    const estoqueOk = await checkStockSuficiente(form.produtoId, form.armazemId, qtd);
    if (estoqueOk === false) {
      toast({
        variant: "destructive",
        title: "Estoque insuficiente",
        description: "Não há saldo suficiente no armazém selecionado para a quantidade informada.",
      });
      return;
    } else if (estoqueOk === null) {
      // Indeterminado (tabela ausente / erro). Avisar e seguir com inserção local + tentativa de persistência.
      toast({
        title: "Validação de estoque indisponível",
        description: "Não foi possível validar o estoque agora. Prosseguindo com a criação (local) e tentativa de salvar no banco.",
      });
    }

    const nomeProduto = produtos.find((p) => p.id === form.produtoId)?.nome || "Produto";
    const dataHoje = formatDateBR(new Date());

    // Atualiza lista local imediatamente
    const novoIdLocal = Math.max(0, ...liberacoes.map((l) => l.id)) + 1;
    const novaLibLocal: LiberacaoItem = {
      id: novoIdLocal,
      produto: nomeProduto,
      cliente: form.cliente.trim(),
      quantidade: qtd,
      quantidadeRetirada: 0,
      pedido: form.pedido.trim(),
      data: dataHoje,
      status: "pendente",
    };
    setLiberacoes((prev) => [novaLibLocal, ...prev]);

    // Tenta persistir no backend
    try {
      const { error } = await supabase.from("liberacoes").insert([
        {
          cliente: form.cliente.trim(),
          product_id: form.produtoId,
          warehouse_id: form.armazemId,
          quantidade: qtd,
          unidade: form.unidade,
          pedido: form.pedido.trim(),
          status: "pendente",
          quantidade_retirada: 0,
          created_by: user?.id ?? null,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        toast({
          variant: "destructive",
          title: "Persistência pendente",
          description:
            "Não foi possível salvar no banco agora. A liberação foi criada localmente; aplique as migrations e tente novamente depois.",
        });
      } else {
        toast({
          title: "Liberação criada",
          description: `Produto ${nomeProduto} liberado para ${form.cliente}.`,
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Persistência pendente",
        description:
          "Não foi possível salvar no banco agora. A liberação foi criada localmente; aplique as migrations e tente novamente depois.",
      });
    }

    resetForm();
    setDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Liberações de Produtos"
        description="Gerencie as liberações de produtos para clientes"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-gradient-primary"
                disabled={!canCreate}
                title={!canCreate ? "Apenas Logística ou Admin podem criar liberações" : "Nova Liberação"}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova Liberação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Liberação</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="cliente">Cliente (nome completo)</Label>
                  <Input
                    id="cliente"
                    value={form.cliente}
                    onChange={(e) => setForm((s) => ({ ...s, cliente: e.target.value }))}
                    placeholder="Ex.: Cliente ABC Ltda"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="produto">Produto</Label>
                    <Select
                      value={form.produtoId}
                      onValueChange={(v) => setForm((s) => ({ ...s, produtoId: v }))}
                      disabled={loadingOptions}
                    >
                      <SelectTrigger id="produto">
                        <SelectValue placeholder={loadingOptions ? "Carregando..." : "Selecione o produto"} />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="armazem">Armazém</Label>
                    <Select
                      value={form.armazemId}
                      onValueChange={(v) => setForm((s) => ({ ...s, armazemId: v }))}
                      disabled={loadingOptions}
                    >
                      <SelectTrigger id="armazem">
                        <SelectValue placeholder={loadingOptions ? "Carregando..." : "Selecione o armazém"} />
                      </SelectTrigger>
                      <SelectContent>
                        {armazens.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="quantidade">Quantidade Liberada</Label>
                    <Input
                      id="quantidade"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.quantidade}
                      onChange={(e) => setForm((s) => ({ ...s, quantidade: e.target.value }))}
                      placeholder="Ex.: 10.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unidade">Unidade</Label>
                    <Select
                      value={form.unidade}
                      onValueChange={(v) => setForm((s) => ({ ...s, unidade: v as Unidade }))}
                    >
                      <SelectTrigger id="unidade">
                        <SelectValue placeholder="Selecione a unidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="t">Toneladas (t)</SelectItem>
                        <SelectItem value="kg">Quilos (kg)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pedido">Número do Pedido Interno</Label>
                  <Input
                    id="pedido"
                    value={form.pedido}
                    onChange={(e) => setForm((s) => ({ ...s, pedido: e.target.value.toUpperCase() }))}
                    placeholder="Ex.: PED-2025-0001"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button className="bg-gradient-primary" onClick={handleSave}>
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDetails(lib)}
                    >
                      <Info className="mr-2 h-4 w-4" />
                      Detalhes
                    </Button>
                    <Badge variant={getStatusColor(lib.status)} className={getStatusBadgeClasses(lib.status)}>
                      {getStatusText(lib.status)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedRelease?.produto} - Pedido {selectedRelease?.pedido}
            </DialogTitle>
          </DialogHeader>

          {selectedRelease && (
            <div className="space-y-6 py-4">
              {/* Informações Gerais */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Informações Gerais</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Produto</Label>
                    <p className="font-medium">{selectedRelease.produto}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Cliente</Label>
                    <p className="font-medium">{selectedRelease.cliente}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Armazém</Label>
                    <p className="font-medium">{selectedRelease.armazem || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Pedido</Label>
                    <p className="font-medium">{selectedRelease.pedido}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Data de Liberação</Label>
                    <p className="font-medium">{selectedRelease.data}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      <Badge
                        variant={getStatusColor(selectedRelease.status)}
                        className={getStatusBadgeClasses(selectedRelease.status)}
                      >
                        {getStatusText(selectedRelease.status)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quantidades */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Quantidades</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Liberada</Label>
                    <p className="text-xl font-bold">{selectedRelease.quantidade}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Retirada</Label>
                    <p className="text-xl font-bold">
                      {relatedSchedules
                        .filter((s) =>
                          ["carregado", "entregue", "concluido", "nf_entregue"].includes(
                            s.status?.toLowerCase() || ""
                          )
                        )
                        .reduce((sum, s) => sum + s.quantidade, 0)
                        .toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Restante</Label>
                    <p className="text-xl font-bold">
                      {(
                        selectedRelease.quantidade -
                        relatedSchedules
                          .filter((s) =>
                            ["carregado", "entregue", "concluido", "nf_entregue"].includes(
                              s.status?.toLowerCase() || ""
                            )
                          )
                          .reduce((sum, s) => sum + s.quantidade, 0)
                      ).toFixed(2)}
                    </p>
                  </div>
                </div>
                {selectedRelease.quantidade -
                  relatedSchedules
                    .filter((s) =>
                      ["carregado", "entregue", "concluido", "nf_entregue"].includes(
                        s.status?.toLowerCase() || ""
                      )
                    )
                    .reduce((sum, s) => sum + s.quantidade, 0) <=
                  0 &&
                  selectedRelease.status !== "concluido" && (
                    <p className="text-sm text-amber-600 font-medium">
                      Liberação totalmente retirada
                    </p>
                  )}
              </div>

              {/* Agendamentos Relacionados */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Agendamentos Relacionados</h3>
                {loadingDetails ? (
                  <p className="text-sm text-muted-foreground">Carregando agendamentos...</p>
                ) : relatedSchedules.length > 0 ? (
                  <div className="border rounded-md">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">Data/Hora</th>
                            <th className="px-4 py-2 text-left font-medium">Quantidade</th>
                            <th className="px-4 py-2 text-left font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatedSchedules.map((schedule) => (
                            <tr key={schedule.id} className="border-t">
                              <td className="px-4 py-2">{schedule.data_hora || "-"}</td>
                              <td className="px-4 py-2">{schedule.quantidade}</td>
                              <td className="px-4 py-2">
                                <Badge variant="outline">{schedule.status}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum agendamento encontrado.
                  </p>
                )}
              </div>

              {/* Histórico de Retiradas */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Histórico de Retiradas</h3>
                {loadingDetails ? (
                  <p className="text-sm text-muted-foreground">Carregando histórico...</p>
                ) : derivedWithdrawHistory.length > 0 ? (
                  <div className="border rounded-md">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">Data</th>
                            <th className="px-4 py-2 text-left font-medium">Quantidade Retirada</th>
                          </tr>
                        </thead>
                        <tbody>
                          {derivedWithdrawHistory.map((item, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="px-4 py-2">{item.data}</td>
                              <td className="px-4 py-2">{item.quantidade}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma retirada registrada.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            {selectedRelease &&
              (selectedRelease.status === "pendente" || selectedRelease.status === "parcial") &&
              (hasRole("admin") || hasRole("logistica")) && (
                <Button variant="destructive" onClick={handleCancelRelease}>
                  Cancelar Liberação
                </Button>
              )}
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Liberacoes;
