import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Camera, FileText } from "lucide-react";

const Carregamento = () => {
  const carregamentos = [
    {
      id: 1,
      cliente: "Cliente ABC",
      produto: "Ureia",
      quantidade: 4.0,
      placa: "ABC-1234",
      motorista: "João Silva",
      horario: "14:00",
      status: "carregando",
      fotos: 2
    },
    {
      id: 2,
      cliente: "Transportadora XYZ",
      produto: "NPK 20-05-20",
      quantidade: 8.0,
      placa: "DEF-5678",
      motorista: "Maria Santos",
      horario: "15:30",
      status: "aguardando",
      fotos: 0
    },
    {
      id: 3,
      cliente: "Fazenda Boa Vista",
      produto: "Super Simples",
      quantidade: 12.0,
      placa: "GHI-9012",
      motorista: "Pedro Costa",
      horario: "16:00",
      status: "liberado",
      fotos: 1
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "aguardando":
        return "secondary";
      case "liberado":
        return "outline";
      case "carregando":
        return "default";
      case "carregado":
        return "default";
      case "nf_entregue":
        return "default";
      default:
        return "outline";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "aguardando":
        return "Aguardando";
      case "liberado":
        return "Liberado";
      case "carregando":
        return "Carregando";
      case "carregado":
        return "Carregado";
      case "nf_entregue":
        return "NF Entregue";
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Controle de Carregamento"
        description="Acompanhe o status dos carregamentos em andamento"
      />

      <div className="container mx-auto px-6 py-8">
        <div className="grid gap-4">
          {carregamentos.map((carr) => (
            <Card key={carr.id} className="transition-all hover:shadow-md">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning">
                        <Truck className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{carr.cliente}</h3>
                        <p className="text-sm text-muted-foreground">
                          {carr.produto} - {carr.quantidade}t
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Motorista: <span className="font-medium text-foreground">{carr.motorista}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <Badge variant={getStatusColor(carr.status)}>
                        {getStatusText(carr.status)}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">Placa</p>
                      <p className="text-sm font-medium text-foreground">{carr.placa}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Horário</p>
                      <p className="text-sm font-medium text-foreground">{carr.horario}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fotos</p>
                      <p className="text-sm font-medium text-foreground">{carr.fotos} anexadas</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm">
                      <Camera className="mr-2 h-4 w-4" />
                      Anexar Fotos
                    </Button>
                    <Button variant="outline" size="sm">
                      Atualizar Status
                    </Button>
                    <Button variant="outline" size="sm">
                      <FileText className="mr-2 h-4 w-4" />
                      NF Entregue
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

export default Carregamento;
