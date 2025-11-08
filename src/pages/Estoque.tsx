import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type StockStatus = "normal" | "baixo";
type Unidade = "t" | "kg";

interface StockItem {
  id: number;
  produto: string;
  armazem: string;
  quantidade: number;
  unidade: Unidade;
  status: StockStatus;
}

const computeStatus = (qtd: number): StockStatus => (qtd < 10 ? "baixo" : "normal");

const Estoque = () => {
  const { toast } = useToast();
  const { hasRole, user, userRoles } = useAuth();

  const canUpdateStock = hasRole("logistica") || hasRole("admin");

  // Lista mockada de estoque (local, sem persistência)
  const [estoque, setEstoque] = useState<StockItem[]>([
    { id: 1, produto: "Ureia", armazem: "São Paulo", quantidade: 45.5, unidade: "t", status: "normal" },
    { id: 2, produto: "NPK 20-05-20", armazem: "Rio de Janeiro", quantidade: 32.0, unidade: "t", status: "normal" },
    { id: 3, produto: "Ureia", armazem: "Belo Horizonte", quantidade: 8.5, unidade: "t", status: "baixo" },
    { id: 4, produto: "Super Simples", armazem: "São Paulo", quantidade: 67.2, unidade: "t", status: "normal" },
    { id: 5, produto: "MAP", armazem: "Curitiba", quantidade: 23.8, unidade: "t", status: "normal" },
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

  const handleCreateProduto = async () => {
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
    };

    setEstoque((prev) => [item, ...prev]);

    toast({
      title: "Produto criado",
      description: `${item.produto} adicionado em ${item.armazem} com ${item.quantidade} ${item.unidade}.`,
    });

    resetFormNovoProduto();
    setDialogOpen(false);
  };

  // Dialog "Atualizar"
  const [dialogUpdateOpen, setDialogUpdateOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [updateForm, setUpdateForm] = useState({
    currentQty: 0,
    newQty: "",
    reason: "",
  });

  const openUpdateDialog = (item: StockItem) => {
    setSelectedItem(item);
    setUpdateForm({
      currentQty: item.quantidade,
      newQty: String(item.quantidade),
      reason: "",
    });
    setDialogUpdateOpen(true);
  };

  const handleSaveUpdate = async () => {
    if (!canUpdateStock) {
      toast({
        variant: "destructive",
        title: "Permissão insuficiente",
        description: "Somente usuários com perfil de Logística ou Admin podem atualizar o estoque.",
      });
      return;
    }

    const newQtyNum = Number(updateForm.newQty);
    if (Number.isNaN(newQtyNum) || newQtyNum < 0) {
      toast({
        variant: "destructive",
        title: "Quantidade inválida",
        description: "A nova quantidade não pode ser negativa.",
      });
      return;
    }

    if (!updateForm.reason) {
      toast({
        variant: "destructive",
        title: "Motivo obrigatório",
        description: "Selecione um motivo para a alteração.",
      });
      return;
    }

    if (!selectedItem) return;

    setEstoque((prev) =>
      prev.map((e) =>
        e.id === selectedItem.id
          ? { ...e, quantidade: newQtyNum, status: computeStatus(newQtyNum) }
          : e
      )
    );

    const currentRole = hasRole("admin") ? "admin" : "logistica";
    toast({
      title: "Estoque atualizado",
      description: `Operação: ${updateForm.reason}. Quantidade alterada para ${newQtyNum}. Atualizado por perfil: ${currentRole}.`,
    });

    if (canUpdateStock) {
      try {
        const { error } = await supabase
          .from("stock_balances")
          .update({
            quantidade_atual: newQtyNum,
            updated_by: user?.id ?? null,
            updated_at: new Date().toISOString(),
            motivo: updateForm.reason,
          })
          .eq("id", selectedItem.id);

        if (error) {
          toast({
            variant: "destructive",
            title: "Persistência pendente",
            description:
              "Não foi possível salvar no banco agora. As migrations/estrutura podem estar faltando. A atualização local foi mantida.",
          });
        }
      } catch {
        toast({
          variant: "destructive",
          title: "Persistência pendente",
          description:
            "Não foi possível salvar no banco agora. As migrations/estrutura podem estar faltando. A atualização local foi mantida.",
        });
      }
    }

    setDialogUpdateOpen(false);
    setSelectedItem(null);
  };

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
                      onValueChange={(v) => setNovoProduto((s) => ({ ...s, unidade: v as Unidade }))}
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

      <div className="container mx-auto px-6 py-8">
        <div className="grid gap-4">
          {estoque.map((item) => (
            <Card key={item.id} className="transition-all hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-primary">
                      <Package className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{item.produto}</h3>
                      <p className="text-sm text-muted-foreground">{item.armazem}</p>
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

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openUpdateDialog(item)}
                      disabled={!canUpdateStock}
                      title={!canUpdateStock ? "Apenas Logística ou Admin" : "Atualizar quantidade"}
                    >
                      Atualizar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Dialog Atualizar Quantidade */}
      <Dialog open={dialogUpdateOpen} onOpenChange={setDialogUpdateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Quantidade</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Produto</Label>
              <p className="text-sm text-muted-foreground">
                {selectedItem ? `${selectedItem.produto} — ${selectedItem.armazem}` : "-"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qtd_atual">Quantidade atual</Label>
                <Input id="qtd_atual" value={updateForm.currentQty} readOnly />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nova_qtd">Nova quantidade</Label>
                <Input
                  id="nova_qtd"
                  type="number"
                  min="0"
                  step="0.01"
                  value={updateForm.newQty}
                  onChange={(e) => setUpdateForm((s) => ({ ...s, newQty: e.target.value }))}
                  placeholder="Ex.: 50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo da alteração</Label>
              <Select
                value={updateForm.reason}
                onValueChange={(v) => setUpdateForm((s) => ({ ...s, reason: v }))}
              >
                <SelectTrigger id="motivo">
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Entrada">Entrada</SelectItem>
                  <SelectItem value="Saída">Saída</SelectItem>
                  <SelectItem value="Ajuste de Inventário">Ajuste de Inventário</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogUpdateOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-gradient-primary" onClick={handleSaveUpdate}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Estoque;
