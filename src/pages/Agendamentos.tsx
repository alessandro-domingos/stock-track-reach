import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Clock, User, Truck } from "lucide-react";

const Agendamentos = () => {
  const agendamentos = [
    {
      id: 1,
      cliente: "Cliente ABC",
      produto: "Ureia",
      quantidade: 4.0,
      data: "17/01/2024",
      horario: "14:00",
      placa: "ABC-1234",
      motorista: "João Silva",
      documento: "123.456.789-00",
      pedido: "PED-2024-001",
      status: "confirmado"
    },
    {
      id: 2,
      cliente: "Transportadora XYZ",
      produto: "NPK 20-05-20",
      quantidade: 8.0,
      data: "17/01/2024",
      horario: "15:30",
      placa: "DEF-5678",
      motorista: "Maria Santos",
      documento: "987.654.321-00",
      pedido: "PED-2024-002",
      status: "confirmado"
    },
    {
      id: 3,
      cliente: "Fazenda Boa Vista",
      produto: "Super Simples",
      quantidade: 12.0,
      data: "18/01/2024",
      horario: "09:00",
      placa: "GHI-9012",
      motorista: "Pedro Costa",
      documento: "456.789.123-00",
      pedido: "PED-2024-005",
      status: "pendente"
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Agendamentos de Retirada"
        description="Gerencie os agendamentos de retirada de produtos"
        actions={
          <Button className="bg-gradient-primary">
            <Plus className="mr-2 h-4 w-4" />
            Novo Agendamento
          </Button>
        }
      />

      <div className="container mx-auto px-6 py-8">
        <div className="grid gap-4">
          {agendamentos.map((agend) => (
            <Card key={agend.id} className="transition-all hover:shadow-md">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-primary">
                        <Calendar className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{agend.cliente}</h3>
                        <p className="text-sm text-muted-foreground">
                          {agend.produto} - {agend.quantidade}t
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Pedido: <span className="font-medium text-foreground">{agend.pedido}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <Badge variant={agend.status === "confirmado" ? "default" : "secondary"}>
                        {agend.status === "confirmado" ? "Confirmado" : "Pendente"}
                      </Badge>
                      <Button variant="outline" size="sm">
                        Editar
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Data e Hora</p>
                        <p className="text-sm font-medium text-foreground">
                          {agend.data} às {agend.horario}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Veículo</p>
                        <p className="text-sm font-medium text-foreground">{agend.placa}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Motorista</p>
                        <p className="text-sm font-medium text-foreground">{agend.motorista}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Documento</p>
                        <p className="text-sm font-medium text-foreground">{agend.documento}</p>
                      </div>
                    </div>
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

export default Agendamentos;
