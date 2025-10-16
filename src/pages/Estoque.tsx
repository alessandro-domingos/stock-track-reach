import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Package } from "lucide-react";

const Estoque = () => {
  const estoque = [
    { id: 1, produto: "Ureia", armazem: "São Paulo", quantidade: 45.5, unidade: "t", status: "normal" },
    { id: 2, produto: "NPK 20-05-20", armazem: "Rio de Janeiro", quantidade: 32.0, unidade: "t", status: "normal" },
    { id: 3, produto: "Ureia", armazem: "Belo Horizonte", quantidade: 8.5, unidade: "t", status: "baixo" },
    { id: 4, produto: "Super Simples", armazem: "São Paulo", quantidade: 67.2, unidade: "t", status: "normal" },
    { id: 5, produto: "MAP", armazem: "Curitiba", quantidade: 23.8, unidade: "t", status: "normal" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Controle de Estoque"
        description="Gerencie o estoque de produtos por armazém"
        actions={
          <Button className="bg-gradient-primary">
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
    </div>
  );
};

export default Estoque;
