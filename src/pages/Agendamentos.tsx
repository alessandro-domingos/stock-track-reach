import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar, Clock, User, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type AgendamentoStatus = "confirmado" | "pendente";

interface AgendamentoItem {
  id: number;
  cliente: string;
  produto: string;
  quantidade: number;
  data: string;      // dd/mm/yyyy
  horario: string;   // HH:mm
  placa: string;
  motorista: string;
  documento: string; // CPF
  pedido: string;
  status: AgendamentoStatus;
}

interface ReleaseOption {
  id: string | number;
  pedido: string;
  cliente: string;
  produto?: string;
  quantidade?: number;
  quantidade_retirada?: number;
  status?: string;
}

const todayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatDateBR = (isoDate: string) => {
  const [yyyy, mm, dd] = isoDate.split("-");
  return `${dd}/${mm}/${yyyy}`;
};

const maskCPF = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  let result = digits;
  if (digits.length > 3) result = digits.slice(0, 3) + "." + digits.slice(3);
  if (digits.length > 6) result = result.slice(0, 7) + "." + digits.slice(6);
  if (digits.length > 9) result = result.slice(0, 11) + "-" + digits.slice(9);
  return result;
};

const isValidCPF = (cpfMasked: string) => {
  const cpf = cpfMasked.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  // Dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (check !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  return check === parseInt(cpf[10]);
};

const maskPlate = (value: string) => {
  let v = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Tentar formatar AAA-9999 enquanto possível
  if (/^[A-Z]{3}\d{4}$/.test(v)) {
    return v.slice(0, 3) + "-" + v.slice(3);
  }
  // Para Mercosul (AAA9A99) manter sem hífen
  return v.slice(0, 7);
};

const isValidPlate = (plate: string) => {
  const p = plate.toUpperCase();
  const regexOld = /^[A-Z]{3}-\d{4}$/;
  const regexMercosul = /^[A-Z]{3}\d[A-Z]\d{2}$/;
  return regexOld.test(p) || regexMercosul.test(p);
};

const remainingForRelease = (release: ReleaseOption) => {
  const qtd = Number(release.quantidade || 0);
  const retirado = Number(release.quantidade_retirada || 0);
  return Math.max(0, qtd - retirado);
};

const Agendamentos = () => {
  const { toast } = useToast();
  const { hasRole, user } = useAuth();

  const canCreate = hasRole("admin") || hasRole("logistica") || hasRole("cliente");

  // Mock inicial
  const [agendamentos, setAgendamentos] = useState<AgendamentoItem[]>([
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
  ]);

  // Dialog & form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [releasesOptions, setReleasesOptions] = useState<ReleaseOption[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(false);

  const [form, setForm] = useState({
    releaseId: "",
    date: todayStr(),
    time: "",
    quantity: "",
    driverName: "",
    driverCPF: "",
    truckPlate: "",
    truckType: "",
    notes: "",
  });

  useEffect(() => {
    const loadReleases = async () => {
      setLoadingReleases(true);
      try {
        const { data, error } = await supabase
          .from("liberacoes")
          .select("id, pedido, cliente, quantidade, quantidade_retirada, status, product_id");
        if (error) throw error;

        // Filtra apenas pendente/parcial
        const filtered = (data || []).filter(
          (r: any) => ["pendente", "parcial"].includes(r.status)
        );

        // Opcional: buscar nome do produto (se não vier)
        // Para simplicidade, mantemos sem nova consulta; produto pode ser obtido localmente depois se a tabela tiver.
        setReleasesOptions(filtered as ReleaseOption[]);
      } catch {
        toast({
          variant: "destructive",
          title: "Falha ao carregar liberações",
          description: "Não foi possível carregar lista de liberações. Recarregue mais tarde.",
        });
        setReleasesOptions([]);
      } finally {
        setLoadingReleases(false);
      }
    };
    loadReleases();
  }, [toast]);

  const selectedRelease = useMemo(
    () => releasesOptions.find((r) => String(r.id) === form.releaseId) || null,
    [releasesOptions, form.releaseId]
  );

  const maxQuantity = selectedRelease ? remainingForRelease(selectedRelease) : 0;

  // Exibir label de liberação no select
  const releaseLabel = (r: ReleaseOption) => {
    const restante = remainingForRelease(r);
    return `[${r.pedido}] ${r.produto || "Produto"} — ${r.cliente} (restante: ${restante})`;
  };

  const resetForm = () => {
    setForm({
      releaseId: "",
      date: todayStr(),
      time: "",
      quantity: "",
      driverName: "",
      driverCPF: "",
      truckPlate: "",
      truckType: "",
      notes: "",
    });
  };

  const handleSave = async () => {
    if (!canCreate) {
      toast({
        variant: "destructive",
        title: "Permissão insuficiente",
        description: "Apenas Admin, Logística ou Cliente podem criar agendamentos.",
      });
      return;
    }

    // Validações básicas
    if (
      !form.releaseId ||
      !form.date ||
      !form.time ||
      !form.quantity ||
      !form.driverName.trim() ||
      !form.driverCPF ||
      !form.truckPlate ||
      !form.truckType
    ) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios do formulário.",
      });
      return;
    }

    // Data não pode ser passada
    if (form.date < todayStr()) {
      toast({
        variant: "destructive",
        title: "Data inválida",
        description: "A data de retirada não pode ser anterior a hoje.",
      });
      return;
    }

    const qty = Number(form.quantity);
    if (Number.isNaN(qty) || qty <= 0) {
      toast({
        variant: "destructive",
        title: "Quantidade inválida",
        description: "Informe uma quantidade maior que zero.",
      });
      return;
    }

    if (selectedRelease && qty > maxQuantity) {
      toast({
        variant: "destructive",
        title: "Quantidade excede disponível",
        description: "A quantidade informada ultrapassa o restante da liberação.",
      });
      return;
    }

    // CPF
    if (!isValidCPF(form.driverCPF)) {
      toast({
        variant: "destructive",
        title: "CPF inválido",
        description: "Verifique o CPF do motorista.",
      });
      return;
    }

    // Placa
    if (!isValidPlate(form.truckPlate)) {
      toast({
        variant: "destructive",
        title: "Placa inválida",
        description: "Formato deve ser AAA-9999 ou AAA9A99.",
      });
      return;
    }

    // Preparar dados para inserção
    const release = selectedRelease;
    const pedido = release?.pedido || "PED-XXXX-0000";
    const produto = release?.produto || "Produto";
    const cliente = release?.cliente || "Cliente";
    const dataBR = formatDateBR(form.date);

    const novoIdLocal = Math.max(0, ...agendamentos.map((a) => a.id)) + 1;

    // Atualiza lista local primeiro
    const novoAgendamento: AgendamentoItem = {
      id: novoIdLocal,
      cliente,
      produto,
      quantidade: qty,
      data: dataBR,
      horario: form.time,
      placa: form.truckPlate.toUpperCase(),
      motorista: form.driverName.trim(),
      documento: form.driverCPF,
      pedido,
      status: "confirmado",
    };
    setAgendamentos((prev) => [novoAgendamento, ...prev]);

    // Tenta persistir
    try {
      const isoDateTime = `${form.date}T${form.time}:00.000Z`;
      const { error } = await supabase.from("agendamentos").insert([
        {
          release_id: form.releaseId,
          data_hora: isoDateTime,
          quantidade: qty,
          motorista_nome: form.driverName.trim(),
          motorista_cpf: form.driverCPF.replace(/\D/g, ""),
          placa_caminhao: form.truckPlate.toUpperCase(),
          tipo_caminhao: form.truckType,
          observacoes: form.notes || null,
          status: "confirmado",
          created_by: user?.id ?? null,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        toast({
          variant: "destructive",
          title: "Persistência pendente",
            description: "Não foi possível salvar no banco agora. O agendamento foi criado localmente; aplique as migrations e tente novamente depois.",
        });
      } else {
        toast({
          title: "Agendamento criado",
          description: `Retirada de ${qty} para o pedido ${pedido} confirmada.`,
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Persistência pendente",
        description:
          "Não foi possível salvar no banco agora. O agendamento foi criado localmente; aplique as migrations e tente novamente depois.",
      });
    }

    resetForm();
    setDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Agendamentos de Retirada"
        description="Gerencie os agendamentos de retirada de produtos"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-gradient-primary"
                disabled={!canCreate}
                title={!canCreate ? "Apenas Admin, Logística ou Cliente podem criar agendamentos" : "Novo Agendamento"}
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Agendamento</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="release">Liberação</Label>
                  <Select
                    value={form.releaseId}
                    onValueChange={(v) => setForm((s) => ({ ...s, releaseId: v }))}
                    disabled={loadingReleases}
                  >
                    <SelectTrigger id="release">
                      <SelectValue placeholder={loadingReleases ? "Carregando..." : "Selecione a liberação"} />
                    </SelectTrigger>
                    <SelectContent>
                      {releasesOptions.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {releaseLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Data de Retirada</Label>
                    <Input
                      id="date"
                      type="date"
                      value={form.date}
                      min={todayStr()}
                      onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Horário</Label>
                    <Input
                      id="time"
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm((s) => ({ ...s, time: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantidade a Retirar</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.quantity}
                      onChange={(e) => setForm((s) => ({ ...s, quantity: e.target.value }))}
                      placeholder={`Máx: ${maxQuantity}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="driverName">Nome do Motorista</Label>
                    <Input
                      id="driverName"
                      value={form.driverName}
                      onChange={(e) => setForm((s) => ({ ...s, driverName: e.target.value }))}
                      placeholder="Ex.: João Silva"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driverCPF">CPF do Motorista</Label>
                    <Input
                      id="driverCPF"
                      value={form.driverCPF}
                      onChange={(e) => setForm((s) => ({ ...s, driverCPF: maskCPF(e.target.value) }))}
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="truckPlate">Placa do Caminhão</Label>
                    <Input
                      id="truckPlate"
                      value={form.truckPlate}
                      onChange={(e) => setForm((s) => ({ ...s, truckPlate: maskPlate(e.target.value) }))}
                      placeholder="ABC-1234 ou ABC1D23"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="truckType">Tipo de Caminhão</Label>
                    <Select
                      value={form.truckType}
                      onValueChange={(v) => setForm((s) => ({ ...s, truckType: v }))}
                    >
                      <SelectTrigger id="truckType">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Carreta">Carreta</SelectItem>
                        <SelectItem value="Truck">Truck</SelectItem>
                        <SelectItem value="Toco">Toco</SelectItem>
                        <SelectItem value="VUC">VUC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observações (opcional)</Label>
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                    placeholder="Informações adicionais sobre o agendamento"
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
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{agend.data} às {agend.horario}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span>{agend.placa}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{agend.motorista}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{agend.documento}</span>
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
