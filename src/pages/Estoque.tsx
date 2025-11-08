import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Package } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// Type for stock item
type StockItem = {
  id: number;
  produto: string;
  armazem: string;
  quantidade: number;
  unidade: "t" | "kg";
  status: "baixo" | "normal";
};

// Utility function to calculate status based on quantity
const calculateStatus = (quantidade: number): "baixo" | "normal" => {
  return quantidade < 10 ? "baixo" : "normal";
};

const Estoque = () => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [nextId, setNextId] = useState(6);

  // Initial mock data
  const initialEstoque: StockItem[] = [
    { id: 1, produto: "Ureia", armazem: "São Paulo", quantidade: 45.5, unidade: "t", status: "normal" },
    { id: 2, produto: "NPK 20-05-20", armazem: "Rio de Janeiro", quantidade: 32.0, unidade: "t", status: "normal" },
    { id: 3, produto: "Ureia", armazem: "Belo Horizonte", quantidade: 8.5, unidade: "t", status: "baixo" },
    { id: 4, produto: "Super Simples", armazem: "São Paulo", quantidade: 67.2, unidade: "t", status: "normal" },
    { id: 5, produto: "MAP", armazem: "Curitiba", quantidade: 23.8, unidade: "t", status: "normal" },
  ];

  const [estoque, setEstoque] = useState<StockItem[]>(initialEstoque);

  // Form state
  const [formData, setFormData] = useState({
    produto: "",
    armazem: "",
    quantidade: "",
    unidade: "t" as "t" | "kg",
  });

  // Handle form field changes
  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      produto: "",
      armazem: "",
      quantidade: "",
      unidade: "t",
    });
  };

  // Handle dialog close
  const handleDialogClose = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  // Handle form submission
  const handleSubmit = () => {
    // Validate required fields
    if (!formData.produto.trim()) {
      toast({
        variant: "destructive",
        title: "Erro de validação",
        description: "O nome do produto é obrigatório.",
      });
      return;
    }

    if (!formData.armazem.trim()) {
      toast({
        variant: "destructive",
        title: "Erro de validação",
        description: "O armazém é obrigatório.",
      });
      return;
    }

    if (!formData.quantidade || formData.quantidade.trim() === "") {
      toast({
        variant: "destructive",
        title: "Erro de validação",
        description: "A quantidade é obrigatória.",
      });
      return;
    }

    const quantidadeNum = parseFloat(formData.quantidade);

    if (isNaN(quantidadeNum) || quantidadeNum <= 0) {
      toast({
        variant: "destructive",
        title: "Erro de validação",
        description: "A quantidade deve ser maior que 0.",
      });
      return;
    }

    // Create new stock item
    const newItem: StockItem = {
      id: nextId,
      produto: formData.produto.trim(),
      armazem: formData.armazem.trim(),
      quantidade: quantidadeNum,
      unidade: formData.unidade,
      status: calculateStatus(quantidadeNum),
    };

    // Add to top of the list
    setEstoque((prev) => [newItem, ...prev]);
    setNextId((prev) => prev + 1);

    // Show success toast
    toast({
      title: "Produto criado com sucesso!",
      description: `${newItem.produto} foi adicionado ao estoque.`,
    });

    // Close dialog and reset form
    handleDialogClose();
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Controle de Estoque"
        description="Gerencie o estoque de produtos por armazém"
        actions={
          <Button className="bg-gradient-primary" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Produto
          </Button>
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
                    <Button variant="outline" size="sm">
                      Atualizar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* New Product Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Novo Produto</DialogTitle>
            <DialogDescription>
              Adicione um novo produto ao estoque. Os campos marcados são obrigatórios.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="produto">Nome do produto *</Label>
              <Input
                id="produto"
                placeholder="Ex: Ureia"
                value={formData.produto}
                onChange={(e) => handleInputChange("produto", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="armazem">Armazém *</Label>
              <Input
                id="armazem"
                placeholder="Ex: São Paulo"
                value={formData.armazem}
                onChange={(e) => handleInputChange("armazem", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quantidade">Quantidade *</Label>
              <Input
                id="quantidade"
                type="number"
                step="0.01"
                placeholder="Ex: 45.5"
                value={formData.quantidade}
                onChange={(e) => handleInputChange("quantidade", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unidade">Unidade</Label>
              <Select
                value={formData.unidade}
                onValueChange={(value) => handleInputChange("unidade", value)}
              >
                <SelectTrigger id="unidade">
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="t">t (toneladas)</SelectItem>
                  <SelectItem value="kg">kg (quilogramas)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleDialogClose}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} className="bg-gradient-primary">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Estoque;
