import { Package, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const recentActivities = [
    { id: 1, type: "Liberação", description: "10t de Ureia liberado para Cliente ABC", time: "2h atrás", status: "success" },
    { id: 2, type: "Agendamento", description: "Retirada agendada - Placa XYZ1234", time: "4h atrás", status: "warning" },
    { id: 3, type: "Carregamento", description: "Carregamento concluído - NF 12345", time: "5h atrás", status: "success" },
    { id: 4, type: "Estoque", description: "Atualização de estoque - Armazém SP", time: "1d atrás", status: "info" },
  ];

  const upcomingSchedules = [
    { id: 1, client: "Cliente XYZ", product: "Ureia", quantity: "5t", time: "14:00", plate: "ABC1234" },
    { id: 2, client: "Transportadora ABC", product: "NPK", quantity: "8t", time: "15:30", plate: "DEF5678" },
    { id: 3, client: "Cliente 123", product: "Ureia", quantity: "12t", time: "16:00", plate: "GHI9012" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Dashboard"
        description="Visão geral do sistema logístico"
      />

      <div className="container mx-auto px-6 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Produtos em Estoque"
            value="156"
            icon={Package}
            variant="primary"
            trend={{ value: "12% do mês passado", positive: true }}
          />
          <StatCard
            title="Liberações Ativas"
            value="23"
            icon={TrendingUp}
            variant="success"
            trend={{ value: "5 novas hoje", positive: true }}
          />
          <StatCard
            title="Agendamentos Hoje"
            value="8"
            icon={Clock}
            variant="warning"
          />
          <StatCard
            title="Carregamentos Concluídos"
            value="45"
            icon={CheckCircle}
            variant="success"
            trend={{ value: "8% acima da meta", positive: true }}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Atividades Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{activity.type}</p>
                        <Badge variant={activity.status === "success" ? "default" : activity.status === "warning" ? "secondary" : "outline"}>
                          {activity.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{activity.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Próximos Agendamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingSchedules.map((schedule) => (
                  <div key={schedule.id} className="flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-primary text-white font-bold">
                      {schedule.time}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{schedule.client}</p>
                      <p className="text-sm text-muted-foreground">
                        {schedule.product} - {schedule.quantity} | {schedule.plate}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
