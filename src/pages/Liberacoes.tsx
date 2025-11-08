import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type Unidade = "t" | "kg";
type StatusLib = "pendente" | "parcial" | "concluido";

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
    case "pendente":
    default:
      return "Pendente";
  }
};

const Liberacoes = () => {
  const { toast } = useToast();
  const { hasRole, user } = useAuth();
  const canCreate = hasRole("logistica") || hasRole("admin");

  // Lista inicial mockada (mantida) + estado
  const [liberacoes, setLiberacoes] = useState<LiberacaoItem[]>([
    { id: 1, produto: "Ureia", cliente: "Cliente ABC Ltda", quantidade: 10.0, quantidadeRetirada: 6.0, pedido: "PED-2024-001", data: "15/01/2024", status: "parcial" },
    { id: 2, produto: "NPK 20-05-20", cliente: "Transportadora XYZ", quantidade: 15.0, quantidadeRetirada: 0, pedido: "PED-2024-002", data: "16/01/2024", status: "pendente" },
    { id: 3, produto: "Super Simples", cliente: "Fazenda Boa Vista", quantidade: 20.0, quantidadeRetirada: 20.0, pedido: "PED-2024-003", data: "14/01/2024", status: "concluido" },
    { id: 4, produto: "MAP", cliente: "Agro Tech", quantidade: 8.5, quantidadeRetirada: 0, pedido: "PED-2024-004", data: "16/01/2024", status: "pendente" },
  ]);

  // Dialog e formulário
  const [dialogOpen, setDialogOpen] = useState(false);
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
        (data || []).reduce((sum: number, row: any) => sum + Number(row.quantidade_atual || 0), 0);
      return totalDisponivel >= qty;
    } catch {
      // Se não conseguimos validar, retornamos null para indicar indeterminado
      return null as unknown as boolean;
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
                  <div>
                    <Badge variant={getStatusColor(lib.status)}>{getStatusText(lib.status)}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Liberacoes;
