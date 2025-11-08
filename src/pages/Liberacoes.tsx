import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type Unidade = "t" | "kg";

interface Liberacao {
  id: number;
  produto: string;
  cliente: string;
  quantidade: number;
  quantidadeRetirada: number;
  pedido: string;
  data: string;
  status: string;
}

interface Product {
  id: string;
  nome: string;
  unidade?: string;
}

interface Warehouse {
  id: string;
  nome: string;
}

const Liberacoes = () => {
  const { toast } = useToast();
  const { hasRole, user } = useAuth();

  const [liberacoes, setLiberacoes] = useState<Liberacao[]>([
    { id: 1, produto: "Ureia", cliente: "Cliente ABC Ltda", quantidade: 10.0, quantidadeRetirada: 6.0, pedido: "PED-2024-001", data: "15/01/2024", status: "parcial" },
    { id: 2, produto: "NPK 20-05-20", cliente: "Transportadora XYZ", quantidade: 15.0, quantidadeRetirada: 0, pedido: "PED-2024-002", data: "16/01/2024", status: "pendente" },
    { id: 3, produto: "Super Simples", cliente: "Fazenda Boa Vista", quantidade: 20.0, quantidadeRetirada: 20.0, pedido: "PED-2024-003", data: "14/01/2024", status: "concluido" },
    { id: 4, produto: "MAP", cliente: "Agro Tech", quantidade: 8.5, quantidadeRetirada: 0, pedido: "PED-2024-004", data: "16/01/2024", status: "pendente" },
  ]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [formData, setFormData] = useState({
    cliente: "",
    produtoId: "",
    armazemId: "",
    quantidade: "",
    unidade: "t" as Unidade,
    pedido: "",
  });

  const canCreate = hasRole("logistica") || hasRole("admin");

  // Fetch products from Supabase
  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, nome, unidade");
      
      if (error) {
        console.warn("Failed to fetch products:", error);
        return;
      }
      
      if (data) {
        setProducts(data);
      }
    } catch (error) {
      console.warn("Error fetching products:", error);
    }
  };

  // Fetch warehouses from Supabase
  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, nome");
      
      if (error) {
        console.warn("Failed to fetch warehouses:", error);
        return;
      }
      
      if (data) {
        setWarehouses(data);
      }
    } catch (error) {
      console.warn("Error fetching warehouses:", error);
    }
  };

  // Check stock availability in the selected warehouse
  const checkStock = async (productId: string, warehouseId: string, qty: number): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("stock_balances")
        .select("quantidade_atual")
        .eq("product_id", productId)
        .eq("warehouse_id", warehouseId);
      
      if (error) {
        console.warn("Failed to check stock:", error);
        return false;
      }
      
      if (!data || data.length === 0) {
        return false;
      }
      
      const totalStock = data.reduce((sum, item) => sum + (item.quantidade_atual || 0), 0);
      return totalStock >= qty;
    } catch (error) {
      console.warn("Error checking stock:", error);
      return false;
    }
  };

  // Load products and warehouses on mount
  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      await Promise.all([fetchProducts(), fetchWarehouses()]);
      setLoadingOptions(false);
    };
    
    loadOptions();
  }, []);

  const resetForm = () => {
    setFormData({
      cliente: "",
      produtoId: "",
      armazemId: "",
      quantidade: "",
      unidade: "t",
      pedido: "",
    });
  };

  const handleSave = async () => {
    // Validations
    if (!formData.cliente.trim()) {
      toast({
        variant: "destructive",
        title: "Campo obrigatório",
        description: "Por favor, informe o nome do cliente.",
      });
      return;
    }

    if (!formData.produtoId) {
      toast({
        variant: "destructive",
        title: "Campo obrigatório",
        description: "Por favor, selecione um produto.",
      });
      return;
    }

    if (!formData.armazemId) {
      toast({
        variant: "destructive",
        title: "Campo obrigatório",
        description: "Por favor, selecione um armazém.",
      });
      return;
    }

    if (!formData.quantidade) {
      toast({
        variant: "destructive",
        title: "Campo obrigatório",
        description: "Por favor, informe a quantidade.",
      });
      return;
    }

    const qtdNum = Number(formData.quantidade);
    if (Number.isNaN(qtdNum) || qtdNum <= 0) {
      toast({
        variant: "destructive",
        title: "Quantidade inválida",
        description: "A quantidade deve ser maior que zero.",
      });
      return;
    }

    if (!formData.pedido.trim()) {
      toast({
        variant: "destructive",
        title: "Campo obrigatório",
        description: "Por favor, informe o número do pedido.",
      });
      return;
    }

    // Validate pedido format: PED-YYYY-NNNN
    const pedidoRegex = /^PED-\d{4}-\d{4}$/;
    if (!pedidoRegex.test(formData.pedido)) {
      toast({
        variant: "destructive",
        title: "Formato inválido",
        description: "O número do pedido deve seguir o formato PED-YYYY-NNNN (ex: PED-2024-0001).",
      });
      return;
    }

    // Check permissions again
    if (!canCreate) {
      toast({
        variant: "destructive",
        title: "Sem permissão",
        description: "Apenas usuários com perfil Logística ou Admin podem criar liberações.",
      });
      return;
    }

    // Check stock availability
    const hasStock = await checkStock(formData.produtoId, formData.armazemId, qtdNum);
    if (!hasStock) {
      toast({
        variant: "destructive",
        title: "Estoque insuficiente",
        description: "Não há estoque suficiente no armazém selecionado para esta liberação.",
      });
      return;
    }

    // Get product name for display
    const selectedProduct = products.find(p => p.id === formData.produtoId);
    const produtoNome = selectedProduct?.nome || "Produto";

    // Get current date in DD/MM/YYYY format
    const now = new Date();
    const dataFormatada = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    // Create new liberacao object for local list
    const novoId = Math.max(0, ...liberacoes.map((l) => l.id)) + 1;
    const novaLiberacao: Liberacao = {
      id: novoId,
      produto: produtoNome,
      cliente: formData.cliente.trim(),
      quantidade: qtdNum,
      quantidadeRetirada: 0,
      pedido: formData.pedido,
      data: dataFormatada,
      status: "pendente",
    };

    // Try to insert into Supabase
    try {
      if (user?.id) {
        const { error } = await supabase
          .from("liberacoes")
          .insert({
            product_id: formData.produtoId,
            warehouse_id: formData.armazemId,
            cliente: formData.cliente.trim(),
            quantidade_liberada: qtdNum,
            unidade: formData.unidade,
            quantidade_retirada: 0,
            pedido: formData.pedido,
            status: "pendente",
            created_by: user.id,
            created_at: new Date().toISOString(),
          });

        if (error) {
          console.warn("Failed to persist to database, keeping local update:", error);
          toast({
            title: "Liberação criada localmente",
            description: "A liberação foi criada mas a persistência no banco está pendente até as migrations serem aplicadas.",
          });
        } else {
          toast({
            title: "Liberação criada com sucesso!",
            description: `Liberação de ${qtdNum}${formData.unidade} de ${produtoNome} para ${formData.cliente.trim()} registrada.`,
          });
        }
      }
    } catch (error) {
      console.warn("Error persisting to database:", error);
      toast({
        title: "Liberação criada localmente",
        description: "A liberação foi criada mas a persistência no banco está pendente até as migrations serem aplicadas.",
      });
    }

    // Update local list regardless of persistence result
    setLiberacoes((prev) => [novaLiberacao, ...prev]);

    resetForm();
    setDialogOpen(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "concluido":
        return "default";
      case "parcial":
        return "secondary";
      case "pendente":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "concluido":
        return "Concluído";
      case "parcial":
        return "Parcial";
      case "pendente":
        return "Pendente";
      default:
        return status;
    }
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
                title={!canCreate ? "Apenas Logística ou Admin" : ""}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova Liberação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nova Liberação de Produto</DialogTitle>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="cliente">Cliente *</Label>
                  <Input
                    id="cliente"
                    placeholder="Nome completo do cliente"
                    value={formData.cliente}
                    onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="produto">Produto *</Label>
                  <Select
                    value={formData.produtoId}
                    onValueChange={(value) => setFormData({ ...formData, produtoId: value })}
                    disabled={loadingOptions}
                  >
                    <SelectTrigger id="produto">
                      <SelectValue placeholder={loadingOptions ? "Carregando..." : "Selecione um produto"} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="armazem">Armazém *</Label>
                  <Select
                    value={formData.armazemId}
                    onValueChange={(value) => setFormData({ ...formData, armazemId: value })}
                    disabled={loadingOptions}
                  >
                    <SelectTrigger id="armazem">
                      <SelectValue placeholder={loadingOptions ? "Carregando..." : "Selecione um armazém"} />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="quantidade">Quantidade Liberada *</Label>
                    <Input
                      id="quantidade"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.quantidade}
                      onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="unidade">Unidade *</Label>
                    <Select
                      value={formData.unidade}
                      onValueChange={(value) => setFormData({ ...formData, unidade: value as Unidade })}
                    >
                      <SelectTrigger id="unidade">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="t">t (toneladas)</SelectItem>
                        <SelectItem value="kg">kg (quilogramas)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="pedido">Número do Pedido Interno *</Label>
                  <Input
                    id="pedido"
                    placeholder="PED-2024-0001"
                    value={formData.pedido}
                    onChange={(e) => setFormData({ ...formData, pedido: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Formato: PED-YYYY-NNNN (ex: PED-2024-0001)
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  Criar Liberação
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
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Quantidade Liberada</p>
                      <p className="text-xl font-bold text-foreground">{lib.quantidade}t</p>
                      <p className="text-sm text-muted-foreground">
                        Retirado: <span className="font-medium text-foreground">{lib.quantidadeRetirada}t</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Data</p>
                      <p className="font-medium text-foreground">{lib.data}</p>
                    </div>
                    <Badge variant={getStatusColor(lib.status)}>
                      {getStatusText(lib.status)}
                    </Badge>
                    <Button variant="outline" size="sm">
                      Detalhes
                    </Button>
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
