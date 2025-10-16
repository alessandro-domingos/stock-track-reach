import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ClipboardList } from "lucide-react";

const Liberacoes = () => {
  const liberacoes = [
    { id: 1, produto: "Ureia", cliente: "Cliente ABC Ltda", quantidade: 10.0, quantidadeRetirada: 6.0, pedido: "PED-2024-001", data: "15/01/2024", status: "parcial" },
    { id: 2, produto: "NPK 20-05-20", cliente: "Transportadora XYZ", quantidade: 15.0, quantidadeRetirada: 0, pedido: "PED-2024-002", data: "16/01/2024", status: "pendente" },
    { id: 3, produto: "Super Simples", cliente: "Fazenda Boa Vista", quantidade: 20.0, quantidadeRetirada: 20.0, pedido: "PED-2024-003", data: "14/01/2024", status: "concluido" },
    { id: 4, produto: "MAP", cliente: "Agro Tech", quantidade: 8.5, quantidadeRetirada: 0, pedido: "PED-2024-004", data: "16/01/2024", status: "pendente" },
  ];

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
          <Button className="bg-gradient-primary">
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
