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
import { Plus, Calendar, Clock, User, Truck, Pencil, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/* Tipos */
type AgendamentoStatus = "confirmado" | "pendente" | "concluido" | "cancelado";

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
  releaseId?: string | number;
  created_by?: string | null;
}

interface ReleaseOption {
  id: string | number;
  pedido: string;
  cliente: string;
  produto?: string;
  quantidade?: number;
  quantidade_retirada?: number;
  status?: string;
  // Coluna opcional que podemos usar para liberar reservas, se existir
  quantidade_reservada?: number;
}

/* Utilitários de data e máscara/validação */
const todayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatDateBRFromISO = (isoDate: string) => {
  const [yyyy, mm, dd] = isoDate.split("-");
  return `${dd}/${mm}/${yyyy}`;
};

const parseDateBRtoISO = (brDate: string) => {
  const [dd, mm, yyyy] = brDate.split("/");
  return `${yyyy}-${mm}-${dd}`;
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
  if (/^[A-Z]{3}\d{4}$/.test(v)) {
    return v.slice(0, 3) + "-" + v.slice(3);
  }
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

const formatDateBR = (d = new Date()) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

/* Componente principal */
const Agendamentos = () => {
  const { toast } = useToast();
  const { hasRole, user } = useAuth();

  const canCreate = hasRole("admin") || hasRole("logistica") || hasRole("cliente");

  /* Mock inicial (com releaseId e created_by para testes de permissão) */
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
      status: "confirmado",
      releaseId: "1",
      created_by: null
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
      status: "confirmado",
      releaseId: "2",
      created_by: null
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
      status: "pendente",
      releaseId: "3",
      created_by: null
    },
  ]);

  /* Estado do diálogo Novo Agendamento (já existente) */
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
          .select("id, pedido, cliente, quantidade, quantidade_retirada, quantidade_reservada, status, product_id");
        if (error) throw error;

        const filtered = (data || []).filter(
          (r: any) => ["pendente", "parcial"].includes(r.status)
        );
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

  /* Salvar Novo Agendamento (mantido) */
  const handleSave = async () => {
    if (!canCreate) {
      toast({
        variant: "destructive",
        title: "Permissão insuficiente",
        description: "Apenas Admin, Logística ou Cliente podem criar agendamentos.",
      });
      return;
    }

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

    if (!isValidCPF(form.driverCPF)) {
      toast({
        variant: "destructive",
        title: "CPF inválido",
        description: "Verifique o CPF do motorista.",
      });
      return;
    }

    if (!isValidPlate(form.truckPlate)) {
      toast({
        variant: "destructive",
        title: "Placa inválida",
        description: "Formato deve ser AAA-9999 ou AAA9A99.",
      });
      return;
    }

    const release = selectedRelease;
    const pedido = release?.pedido || "PED-XXXX-0000";
    const produto = release?.produto || "Produto";
    const cliente = release?.cliente || "Cliente";
    const dataBR = formatDateBRFromISO(form.date);

    const novoIdLocal = Math.max(0, ...agendamentos.map((a) => a.id)) + 1;

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
      releaseId: form.releaseId,
      created_by: user?.id ?? null,
    };
    setAgendamentos((prev) => [novoAgendamento, ...prev]);

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
          description:
            "Não foi possível salvar no banco agora. O agendamento foi criado localmente; aplique as migrations e tente novamente depois.",
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

  /* Botão Editar (existente) */
  const canEdit = (a: AgendamentoItem) => {
    if (a.status === "concluido" || a.status === "cancelado") return false;
    const isOwner = a.created_by && user?.id && a.created_by === user.id;
    return Boolean(isOwner || hasRole("admin") || hasRole("logistica"));
  };

  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<AgendamentoItem | null>(null);
  const [editForm, setEditForm] = useState({
    id: 0,
    releaseId: "" as string | number,
    date: todayStr(),
    time: "",
    quantity: "",
    driverName: "",
    driverCPF: "",
    truckPlate: "",
    truckType: "",
    notes: "",
    originalQty: 0,
    originalStatus: "" as AgendamentoStatus,
    createdBy: "" as string | null,
  });

  const openEdit = (a: AgendamentoItem) => {
    if (!canEdit(a)) {
      toast({
        variant: "destructive",
        title: "Permissão insuficiente",
        description: "Apenas o criador, Admin ou Logística podem editar este agendamento.",
      });
      return;
    }
    const isoDate = parseDateBRtoISO(a.data);
    setEditItem(a);
    setEditForm({
      id: a.id,
      releaseId: a.releaseId ?? "",
      date: isoDate,
      time: a.horario,
      quantity: String(a.quantidade),
      driverName: a.motorista,
      driverCPF: a.documento,
      truckPlate: a.placa,
      truckType: "",
      notes: "",
      originalQty: a.quantidade,
      originalStatus: a.status,
      createdBy: a.created_by ?? null,
    });
    setEditOpen(true);
  };

  const recalcLiberacaoRetirada = async (releaseId: string | number) => {
    try {
      const { data: ags, error } = await supabase
        .from("agendamentos")
        .select("quantidade, status")
        .eq("release_id", releaseId);

      if (error) throw error;

      const retiradaStatuses = ["carregado", "entregue", "concluido"];
      const totalRetirado = (ags || []).reduce((sum: number, row: any) => {
        const st = String(row.status || "").toLowerCase();
        if (retiradaStatuses.includes(st)) {
          return sum + Number(row.quantidade || 0);
        }
        return sum;
      }, 0);

      const { error: upErr } = await supabase
        .from("liberacoes")
        .update({ quantidade_retirada: totalRetirado, updated_at: new Date().toISOString() })
        .eq("id", releaseId);

      if (upErr) throw upErr;
    } catch {
      toast({
        variant: "destructive",
        title: "Recalcular retirada pendente",
        description:
          "Não foi possível atualizar a quantidade retirada na liberação agora. Aplique as migrations e tente novamente depois.",
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;

    if (!canEdit(editItem)) {
      toast({
        variant: "destructive",
        title: "Permissão insuficiente",
        description: "Você não pode editar este agendamento.",
      });
      return;
    }

    if (editForm.originalStatus === "concluido" || editForm.originalStatus === "cancelado") {
      toast({
        variant: "destructive",
        title: "Edição não permitida",
        description: "Agendamentos concluídos ou cancelados não podem ser editados.",
      });
      return;
    }

    if (!editForm.date || !editForm.time || !editForm.quantity || !editForm.driverName.trim() || !editForm.driverCPF || !editForm.truckPlate) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios do formulário.",
      });
      return;
    }

    if (editForm.date < todayStr()) {
      toast({
        variant: "destructive",
        title: "Data inválida",
        description: "A data de retirada não pode ser anterior a hoje.",
      });
      return;
    }

    const newQty = Number(editForm.quantity);
    if (Number.isNaN(newQty) || newQty <= 0) {
      toast({
        variant: "destructive",
        title: "Quantidade inválida",
        description: "Informe uma quantidade maior que zero.",
      });
      return;
    }

    if (editForm.releaseId) {
      const rel = releasesOptions.find((r) => String(r.id) === String(editForm.releaseId));
      if (rel) {
        const restante = remainingForRelease(rel);
        const maxAllowed = restante + Number(editForm.originalQty || 0);
        if (newQty > maxAllowed) {
          toast({
            variant: "destructive",
            title: "Quantidade excede disponível",
            description: `A quantidade informada ultrapassa o restante permitido (${maxAllowed}).`,
          });
          return;
        }
      }
    }

    if (!isValidCPF(editForm.driverCPF)) {
      toast({
        variant: "destructive",
        title: "CPF inválido",
        description: "Verifique o CPF do motorista.",
      });
      return;
    }

    if (!isValidPlate(editForm.truckPlate)) {
      toast({
        variant: "destructive",
        title: "Placa inválida",
        description: "Formato deve ser AAA-9999 ou AAA9A99.",
      });
      return;
    }

    setAgendamentos((prev) =>
      prev.map((a) =>
        a.id === editForm.id
          ? {
              ...a,
              quantidade: newQty,
              data: formatDateBRFromISO(editForm.date),
              horario: editForm.time,
              motorista: editForm.driverName.trim(),
              documento: editForm.driverCPF,
              placa: editForm.truckPlate.toUpperCase(),
            }
          : a
      )
    );

    try {
      const isoDateTime = `${editForm.date}T${editForm.time}:00.000Z`;
      const { error } = await supabase
        .from("agendamentos")
        .update({
          data_hora: isoDateTime,
          quantidade: newQty,
          motorista_nome: editForm.driverName.trim(),
          motorista_cpf: editForm.driverCPF.replace(/\D/g, ""),
          placa_caminhao: editForm.truckPlate.toUpperCase(),
          tipo_caminhao: editForm.truckType || null,
          observacoes: editForm.notes || null,
          updated_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editForm.id);

      if (error) {
        toast({
          variant: "destructive",
          title: "Persistência pendente",
          description:
            "Não foi possível atualizar no banco agora. A alteração local foi mantida; aplique as migrations e tente novamente depois.",
        });
      } else {
        toast({ title: "Agendamento atualizado", description: "As alterações foram salvas com sucesso." });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Persistência pendente",
        description:
          "Não foi possível atualizar no banco agora. A alteração local foi mantida; aplique as migrations e tente novamente depois.",
      });
    }

    if (editForm.releaseId && newQty !== Number(editForm.originalQty || 0)) {
      await recalcLiberacaoRetirada(editForm.releaseId);
    }

    setEditOpen(false);
    setEditItem(null);
  };

  /* --------- Cancelar Agendamento --------- */
  const canCancel = (a: AgendamentoItem) => {
    if (a.status !== "confirmado") return false;
    const isOwner = a.created_by && user?.id && a.created_by === user.id;
    return Boolean(isOwner || hasRole("admin") || hasRole("logistica"));
  };

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelItem, setCancelItem] = useState<AgendamentoItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const openCancel = (a: AgendamentoItem) => {
    if (!canCancel(a)) {
      toast({
        variant: "destructive",
        title: "Permissão insuficiente",
        description: "Apenas o criador, Admin ou Logística podem cancelar este agendamento.",
      });
      return;
    }
    setCancelItem(a);
    setCancelReason("");
    setCancelOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelItem) return;
    if (!cancelReason.trim()) {
      toast({
        variant: "destructive",
        title: "Motivo obrigatório",
        description: "Informe o motivo do cancelamento.",
      });
      return;
    }

    // Atualiza localmente
    setAgendamentos((prev) =>
      prev.map((a) => (a.id === cancelItem.id ? { ...a, status: "cancelado" } : a))
    );

    // Persistir atualização do agendamento
    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({
          status: "cancelado",
          observacao_cancelamento: cancelReason.trim(),
          updated_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cancelItem.id);

      if (error) {
        toast({
          variant: "destructive",
          title: "Persistência pendente",
          description:
            "Cancelamento aplicado localmente; não foi possível atualizar o banco agora.",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Persistência pendente",
        description:
          "Cancelamento aplicado localmente; não foi possível atualizar o banco agora.",
      });
    }

    // Liberar quantidade novamente na liberação (sem mexer em quantidade_retirada)
    // Tentativa: ajustar uma coluna opcional 'quantidade_reservada' se existir
    if (cancelItem.releaseId) {
      try {
        const { data: lib, error: selErr } = await supabase
          .from("liberacoes")
          .select("id, quantidade_reservada")
          .eq("id", cancelItem.releaseId)
          .maybeSingle();

        if (!selErr && lib && typeof lib.quantidade_reservada !== "undefined") {
          const atual = Number(lib.quantidade_reservada || 0);
          const novo = Math.max(0, atual - Number(cancelItem.quantidade || 0));
          const { error: upErr } = await supabase
            .from("liberacoes")
            .update({
              quantidade_reservada: novo,
              updated_by: user?.id ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", cancelItem.releaseId);
          if (upErr) {
            toast({
              variant: "destructive",
              title: "Liberação não atualizada",
              description:
                "Não foi possível ajustar a reserva na liberação. Verifique as migrations.",
            });
          }
        }
      } catch {
        toast({
          variant: "destructive",
          title: "Liberação não atualizada",
          description:
            "Falha ao tentar liberar a quantidade na liberação. Verifique o backend.",
        });
      }
    }

    toast({
      title: "Agendamento cancelado",
      description: "O agendamento foi marcado como cancelado.",
    });

    setCancelOpen(false);
    setCancelItem(null);
    setCancelReason("");
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
                          {`[${r.pedido}] ${r.produto || "Produto"} — ${r.cliente} (restante: ${remainingForRelease(r)})`}
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
          {agendamentos.map((agend) => {
            const disabledByStatus = agend.status === "concluido" || agend.status === "cancelado";
            const allowedEdit = canEdit(agend);
            const disableEdit = disabledByStatus || !allowedEdit;
            const titleEdit = disabledByStatus
              ? "Agendamento concluído/cancelado não pode ser editado"
              : !allowedEdit
                ? "Apenas criador, Admin ou Logística podem editar"
                : "Editar agendamento";

            const showCancelButton = agend.status === "confirmado";
            const allowedCancel = canCancel(agend);
            const titleCancel = allowedCancel ? "Cancelar agendamento" : "Apenas criador, Admin ou Logística podem cancelar";

            return (
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

                      <div className="flex items-center gap-2">
                        <Badge variant={agend.status === "confirmado" ? "default" : "secondary"}>
                          {agend.status === "confirmado" ? "Confirmado" : agend.status.charAt(0).toUpperCase() + agend.status.slice(1)}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(agend)}
                          disabled={disableEdit}
                          title={titleEdit}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                        {showCancelButton && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openCancel(agend)}
                            disabled={!allowedCancel}
                            title={titleCancel}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                        )}
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
            );
          })}
        </div>
      </div>

      {/* Dialog Editar Agendamento */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
          </DialogHeader>

          {editItem ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_date">Data de Retirada</Label>
                  <Input
                    id="edit_date"
                    type="date"
                    value={editForm.date}
                    min={todayStr()}
                    onChange={(e) => setEditForm((s) => ({ ...s, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_time">Horário</Label>
                  <Input
                    id="edit_time"
                    type="time"
                    value={editForm.time}
                    onChange={(e) => setEditForm((s) => ({ ...s, time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_quantity">Quantidade</Label>
                  <Input
                    id="edit_quantity"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm((s) => ({ ...s, quantity: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_driverName">Nome do Motorista</Label>
                  <Input
                    id="edit_driverName"
                    value={editForm.driverName}
                    onChange={(e) => setEditForm((s) => ({ ...s, driverName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_driverCPF">CPF do Motorista</Label>
                  <Input
                    id="edit_driverCPF"
                    value={editForm.driverCPF}
                    onChange={(e) => setEditForm((s) => ({ ...s, driverCPF: maskCPF(e.target.value) }))}
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit_truckPlate">Placa do Caminhão</Label>
                  <Input
                    id="edit_truckPlate"
                    value={editForm.truckPlate}
                    onChange={(e) => setEditForm((s) => ({ ...s, truckPlate: maskPlate(e.target.value) }))}
                    placeholder="ABC-1234 ou ABC1D23"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_truckType">Tipo de Caminhão</Label>
                  <Select
                    value={editForm.truckType}
                    onValueChange={(v) => setEditForm((s) => ({ ...s, truckType: v }))}
                  >
                    <SelectTrigger id="edit_truckType">
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
                <Label htmlFor="edit_notes">Observações (opcional)</Label>
                <Textarea
                  id="edit_notes"
                  value={editForm.notes}
                  onChange={(e) => setEditForm((s) => ({ ...s, notes: e.target.value }))}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  Cancelar
                </Button>
                <Button className="bg-gradient-primary" onClick={handleSaveEdit}>
                  Salvar
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Dialog Cancelar Agendamento */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar Agendamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Confirme o cancelamento deste agendamento. Informe o motivo (obrigatório).
            </p>
            <div className="space-y-2">
              <Label htmlFor="cancel_reason">Motivo do cancelamento</Label>
              <Textarea
                id="cancel_reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Descreva o motivo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Voltar
            </Button>
            <Button className="bg-gradient-primary" onClick={handleConfirmCancel}>
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Agendamentos;
