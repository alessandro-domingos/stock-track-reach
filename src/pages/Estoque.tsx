import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Package, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type StockStatus = "normal" | "baixo";
type Unidade = "t" | "kg";

interface StockItem {
  id: number;
  produto: string;
  armazem: string;
  quantidade: number;
  unidade: Unidade;
  status: StockStatus;
  data: string; // dd/mm/yyyy (adicionado para filtros de data)
}

const computeStatus = (qtd: number): StockStatus => (qtd < 10 ? "baixo" : "normal");

const parseDate = (d: string) => {
  // dd/mm/yyyy -> Date
  const [dd, mm, yyyy] = d.split("/");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};

const Estoque = () => {
  const { toast } = useToast();

  const [estoque, setEstoque] = useState<StockItem[]>([
    { id: 1, produto: "Ureia", armazem: "São Paulo", quantidade: 45.5, unidade: "t", status: "normal", data: "17/01/2024" },
    { id: 2, produto: "NPK 20-05-20", armazem: "Rio de Janeiro", quantidade: 32.0, unidade: "t", status: "normal", data: "18/01/2024" },
    { id: 3, produto: "Ureia", armazem: "Belo Horizonte", quantidade: 8.5, unidade: "t", status: "baixo", data: "18/01/2024" },
    { id: 4, produto: "Super Simples", armazem: "São Paulo", quantidade: 67.2, unidade: "t", status: "normal", data: "19/01/2024" },
    { id: 5, produto: "MAP", armazem: "Curitiba", quantidade: 23.8, unidade: "t", status: "normal", data: "19/01/2024" },
  ]);

  // Dialog "Novo Produto"
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoProduto, setNovoProduto] = useState({
    nome: "",
    armazem: "",
    quantidade: "",
    unidade: "t" as Unidade,
  });

  const resetFormNovoProduto = () => {
    setNovoProduto({ nome: "", armazem: "", quantidade: "", unidade: "t" });
  };

  const handleCreateProduto = () => {
    const { nome, armazem, quantidade, unidade } = novoProduto;

    if (!nome.trim() || !armazem.trim() || !quantidade) {
      toast({
        variant: "destructive",
        title: "Preencha todos os campos",
        description: "Nome, armazém e quantidade são obrigatórios.",
      });
      return;
    }

    const qtdNum = Number(quantidade);
    if (Number.isNaN(qtdNum) || qtdNum <= 0) {
      toast({
        variant: "destructive",
        title: "Quantidade inválida",
        description: "Informe um número maior que zero.",
      });
      return;
    }

    const novoId = Math.max(0, ...estoque.map((e) => e.id)) + 1;
    const item: StockItem = {
      id: novoId,
      produto: nome.trim(),
      armazem: armazem.trim(),
      quantidade: qtdNum,
      unidade,
      status: computeStatus(qtdNum),
      data: new Date().toLocaleDateString("pt-BR"),
    };

    setEstoque((prev) => [item, ...prev]);

    toast({
      title: "Produto criado",
      description: `${item.produto} adicionado em ${item.armazem} com ${item.quantidade} ${item.unidade}.`,
    });

    resetFormNovoProduto();
    setDialogOpen(false);
  };

  /* ---------------- Filtros ---------------- */
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<StockStatus[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);

  const allStatuses: StockStatus[] = ["normal", "baixo"];
  const allWarehouses = useMemo(
    () => Array.from(new Set(estoque.map((e) => e.armazem))).sort(),
    [estoque]
  );

  const toggleStatus = (st: StockStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]
    );
  };

  const toggleWarehouse = (w: string) => {
    setSelectedWarehouses((prev) =>
      prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]
    );
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedStatuses([]);
    setDateFrom("");
    setDateTo("");
    setSelectedWarehouses([]);
  };

  const filteredEstoque = useMemo(() => {
    return estoque.filter((item) => {
      const term = search.trim().toLowerCase();
      if (term) {
        const hay = `${item.produto} ${item.armazem}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }

      if (selectedStatuses.length > 0 && !selectedStatuses.includes(item.status)) {
        return false;
      }

      if (selectedWarehouses.length > 0 && !selectedWarehouses.includes(item.armazem)) {
        return false;
      }

      if (dateFrom) {
        const from = new Date(dateFrom);
        if (parseDate(item.data) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        // Ajustar para fim do dia
        to.setHours(23, 59, 59, 999);
        if (parseDate(item.data) > to) return false;
      }

      return true;
    });
  }, [estoque, search, selectedStatuses, selectedWarehouses, dateFrom, dateTo]);

  const showingCount = filteredEstoque.length;
  const totalCount = estoque.length;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Controle de Estoque"
        description="Gerencie o estoque de produtos por armazém"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary">
                <Plus className="mr-2 h-4 w-4" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Produto</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do produto</Label>
                  <Input
                    id="nome"
                    value={novoProduto.nome}
                    onChange={(e) => setNovoProduto((s) => ({ ...s, nome: e.target.value }))}
                    placeholder="Ex.: Ureia, MAP, NPK 20-05-20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="armazem">Armazém</Label>
                  <Input
                    id="armazem"
                    value={novoProduto.armazem}
                    onChange={(e) => setNovoProduto((s) => ({ ...s, armazem: e.target.value }))}
                    placeholder="Ex.: São Paulo, Curitiba"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantidade">Quantidade</Label>
                    <Input
                      id="quantidade"
                      type="number"
                      step="0.01"
                      min="0"
                      value={novoProduto.quantidade}
                      onChange={(e) => setNovoProduto((s) => ({ ...s, quantidade: e.target.value }))}
                      placeholder="Ex.: 10.5"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unidade">Unidade</Label>
                    <Select
                      value={novoProduto.unidade}
                      onValueChange={(v) =>
                        setNovoProduto((s) => ({ ...s, unidade: v as Unidade }))
                      }
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
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button className="bg-gradient-primary" onClick={handleCreateProduto}>
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Barra de Filtros */}
      <div className="container mx-auto px-6 pt-4">
        <div className="rounded-md border p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="busca">Busca</Label>
              <Input
                id="busca"
                placeholder="Filtrar por produto ou armazém..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <div className="flex flex-wrap gap-2">
                {allStatuses.map((st) => {
                  const active = selectedStatuses.includes(st);
                  return (
                    <Badge
                      key={st}
                      onClick={() => toggleStatus(st)}
                      className={`cursor-pointer select-none ${
                        active ? "bg-gradient-primary text-white" : "bg-muted"
                      }`}
                    >
                      {st === "normal" ? "Normal" : "Baixo"}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Armazéns</Label>
              <div className="flex flex-wrap gap-2 max-w-xs">
                {allWarehouses.map((w) => {
                  const active = selectedWarehouses.includes(w);
                  return (
                    <Badge
                      key={w}
                      onClick={() => toggleWarehouse(w)}
                      className={`cursor-pointer select-none ${
                        active ? "bg-gradient-primary text-white" : "bg-muted"
                      }`}
                    >
                      {w}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Período (Data)</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-40"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando <span className="font-medium">{showingCount}</span> de{" "}
              <span className="font-medium">{totalCount}</span> resultados
            </p>
            <Button variant="ghost" onClick={clearFilters} className="gap-2">
              <X className="h-4 w-4" />
              Limpar Filtros
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid gap-4">
          {filteredEstoque.map((item) => (
            <Card key={item.id} className="transition-all hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-primary">
                      <Package className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{item.produto}</h3>
                      <p className="text-sm text-muted-foreground">
                        {item.armazem} • {item.data}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">
                        {item.quantidade} {item.unidade}
                      </p>
                      <p className="text-sm text-muted-foreground">Disponível</p>
                    </div>
                    <Badge variant={item.status === "baixo" ? "destructive" : "secondary"}>
                      {item.status === "baixo" ? "Estoque Baixo" : "Normal"}
                    </Badge>
                    <Button variant="outline" size="sm">
                      Atualizar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredEstoque.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Nenhum resultado encontrado com os filtros atuais.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Estoque;
