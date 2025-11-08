import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar, Clock, User, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// Utility functions for validation and masking
const maskCPF = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .substring(0, 14);
};

const isValidCPF = (cpf: string): boolean => {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  
  // Check if all digits are the same
  if (/^(\d)\1+$/.test(digits)) return false;
  
  // Validate check digits
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i)) * (10 - i);
  }
  let checkDigit1 = 11 - (sum % 11);
  if (checkDigit1 >= 10) checkDigit1 = 0;
  
  if (checkDigit1 !== parseInt(digits.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i)) * (11 - i);
  }
  let checkDigit2 = 11 - (sum % 11);
  if (checkDigit2 >= 10) checkDigit2 = 0;
  
  return checkDigit2 === parseInt(digits.charAt(10));
};

const maskPlate = (value: string): string => {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // Mercosul format: ABC1D23
  if (cleaned.length > 4 && /^[A-Z]{3}[0-9][A-Z0-9]/.test(cleaned)) {
    return cleaned
      .replace(/^([A-Z]{3})([0-9])([A-Z])([0-9]{0,2}).*/, '$1$2$3$4')
      .substring(0, 7);
  }
  
  // Old format: ABC-1234
  return cleaned
    .replace(/^([A-Z]{0,3})([0-9]{0,4}).*/, '$1-$2')
    .replace(/^([A-Z]{3})-$/, '$1')
    .substring(0, 8);
};

const isValidPlate = (value: string): boolean => {
  const cleaned = value.replace(/[^A-Z0-9]/g, '');
  // Old format: AAA1234 or Mercosul: ABC1D23
  return /^[A-Z]{3}[0-9]{4}$/.test(cleaned) || /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(cleaned);
};

const todayStr = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface ReleaseOption {
  id: number | string;
  pedido: string;
  cliente: string;
  produto: string;
  quantidade: number;
  quantidade_retirada: number;
  status: string;
  product_id?: string;
  warehouse_id?: string;
}

interface AgendamentoItem {
  id: number | string;
  cliente: string;
  produto: string;
  quantidade: number;
  data: string;
  horario: string;
  placa: string;
  motorista: string;
  documento: string;
  pedido: string;
  status: string;
}

const Agendamentos = () => {
  const { toast } = useToast();
  const { hasRole, user } = useAuth();
  
  const canCreate = hasRole("admin") || hasRole("logistica") || hasRole("cliente");
  
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

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [releasesOptions, setReleasesOptions] = useState<ReleaseOption[]>([]);
  const [form, setForm] = useState({
    releaseId: "",
    date: "",
    time: "",
    quantity: "",
    driverName: "",
    driverCPF: "",
    truckPlate: "",
    truckType: "",
    notes: ""
  });

  const loadReleases = async () => {
    setLoadingOptions(true);
    try {
      const { data, error } = await supabase
        .from('liberacoes')
        .select('id, pedido, cliente, quantidade, quantidade_retirada, status, product_id, warehouse_id')
        .in('status', ['pendente', 'parcial']);
      
      if (error) throw error;
      
      // Try to enrich with product names if possible
      const releases = (data || []) as unknown[];
      const enriched: ReleaseOption[] = [];
      
      for (const rel of releases) {
        let produtoNome = `Produto ${rel.product_id || 'N/A'}`;
        
        if (rel.product_id) {
          try {
            const { data: prodData } = await supabase
              .from('products')
              .select('name')
              .eq('id', rel.product_id)
              .single();
            
            if (prodData?.name) {
              produtoNome = prodData.name;
            }
          } catch {
            // Fallback to product_id
          }
        }
        
        enriched.push({
          id: rel.id,
          pedido: rel.pedido || `LIB-${rel.id}`,
          cliente: rel.cliente || 'Cliente',
          produto: produtoNome,
          quantidade: Number(rel.quantidade || 0),
          quantidade_retirada: Number(rel.quantidade_retirada || 0),
          status: rel.status || 'pendente',
          product_id: rel.product_id,
          warehouse_id: rel.warehouse_id
        });
      }
      
      setReleasesOptions(enriched);
    } catch {
      // If table doesn't exist, show empty list
      toast({
        variant: "destructive",
        title: "Aviso",
        description: "Não foi possível carregar liberações. A estrutura do banco pode estar pendente."
      });
      setReleasesOptions([]);
    } finally {
      setLoadingOptions(false);
    }
  };

  // Load releases when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      loadReleases();
    }
  }, [dialogOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const remainingForRelease = (release: ReleaseOption): number => {
    return Math.max(0, release.quantidade - release.quantidade_retirada);
  };

  const selectedRelease = useMemo(() => {
    return releasesOptions.find(r => String(r.id) === form.releaseId);
  }, [releasesOptions, form.releaseId]);

  const handleSave = async () => {
    // Validate permissions
    if (!canCreate) {
      toast({
        variant: "destructive",
        title: "Permissão insuficiente",
        description: "Apenas Admin, Logística ou Cliente podem criar agendamentos."
      });
      return;
    }

    // Validate required fields
    if (!form.releaseId || !form.date || !form.time || !form.quantity || !form.driverName || !form.driverCPF || !form.truckPlate || !form.truckType) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios."
      });
      return;
    }

    // Validate date
    if (form.date < todayStr()) {
      toast({
        variant: "destructive",
        title: "Data inválida",
        description: "A data de retirada não pode ser anterior a hoje."
      });
      return;
    }

    // Validate CPF
    if (!isValidCPF(form.driverCPF)) {
      toast({
        variant: "destructive",
        title: "CPF inválido",
        description: "Por favor, insira um CPF válido."
      });
      return;
    }

    // Validate plate
    if (!isValidPlate(form.truckPlate)) {
      toast({
        variant: "destructive",
        title: "Placa inválida",
        description: "Por favor, insira uma placa válida (AAA-1234 ou ABC1D23)."
      });
      return;
    }

    // Validate quantity
    const quantity = Number(form.quantity);
    if (quantity <= 0) {
      toast({
        variant: "destructive",
        title: "Quantidade inválida",
        description: "A quantidade deve ser maior que zero."
      });
      return;
    }

    if (selectedRelease) {
      const remaining = remainingForRelease(selectedRelease);
      if (quantity > remaining) {
        toast({
          variant: "destructive",
          title: "Quantidade excedida",
          description: `A quantidade não pode exceder o restante da liberação (${remaining}).`
        });
        return;
      }
    }

    // Create agendamento object for local list
    const dateObj = new Date(form.date);
    const dataFormatada = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
    const horarioFormatado = form.time;
    
    const newAgendamento: AgendamentoItem = {
      id: `temp-${Date.now()}`,
      cliente: selectedRelease?.cliente || 'Cliente',
      produto: selectedRelease?.produto || 'Produto',
      quantidade: quantity,
      data: dataFormatada,
      horario: horarioFormatado,
      placa: form.truckPlate,
      motorista: form.driverName,
      documento: form.driverCPF,
      pedido: selectedRelease?.pedido || 'N/A',
      status: 'confirmado'
    };

    // Try to persist to Supabase
    try {
      const dataHora = `${form.date}T${form.time}:00.000Z`;
      
      const { data, error } = await supabase
        .from('agendamentos')
        .insert({
          release_id: form.releaseId,
          data_hora: dataHora,
          quantidade: quantity,
          motorista_nome: form.driverName,
          motorista_cpf: form.driverCPF.replace(/\D/g, ''),
          placa_caminhao: form.truckPlate,
          tipo_caminhao: form.truckType,
          observacoes: form.notes || null,
          status: 'confirmado',
          created_by: user?.id,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // If successful, update with real ID
      if (data) {
        newAgendamento.id = data.id;
      }
    } catch {
      // Show warning but continue with local update
      toast({
        variant: "destructive",
        title: "Persistência pendente",
        description: "O agendamento foi criado localmente, mas não foi possível salvar no banco. Verifique as migrations."
      });
    }

    // Update local list
    setAgendamentos([newAgendamento, ...agendamentos]);

    toast({
      title: "Agendamento criado",
      description: "O agendamento foi criado com sucesso!"
    });

    // Reset form and close dialog
    setForm({
      releaseId: "",
      date: "",
      time: "",
      quantity: "",
      driverName: "",
      driverCPF: "",
      truckPlate: "",
      truckType: "",
      notes: ""
    });
    setDialogOpen(false);
  };

  const handleOpenDialog = () => {
    if (!canCreate) {
      toast({
        variant: "destructive",
        title: "Permissão insuficiente",
        description: "Apenas Admin, Logística ou Cliente podem criar agendamentos."
      });
      return;
    }
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Agendamentos de Retirada"
        description="Gerencie os agendamentos de retirada de produtos"
        actions={
          <Button 
            className="bg-gradient-primary" 
            onClick={handleOpenDialog}
            disabled={!canCreate}
            title={!canCreate ? "Apenas Admin, Logística ou Cliente podem criar agendamentos" : "Criar novo agendamento"}
          >
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

      {/* Dialog for creating new agendamento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Agendamento de Retirada</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Liberação Select */}
            <div className="space-y-2">
              <Label htmlFor="release">Liberação *</Label>
              {loadingOptions ? (
                <p className="text-sm text-muted-foreground">Carregando liberações...</p>
              ) : (
                <Select
                  value={form.releaseId}
                  onValueChange={(value) => setForm({ ...form, releaseId: value })}
                >
                  <SelectTrigger id="release">
                    <SelectValue placeholder="Selecione uma liberação" />
                  </SelectTrigger>
                  <SelectContent>
                    {releasesOptions.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        Nenhuma liberação disponível
                      </div>
                    ) : (
                      releasesOptions.map((rel) => (
                        <SelectItem key={rel.id} value={String(rel.id)}>
                          [{rel.pedido}] {rel.produto} — {rel.cliente} (restante: {remainingForRelease(rel)})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Data de Retirada *</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  min={todayStr()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Horário *</Label>
                <Input
                  id="time"
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </div>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade a Retirar *</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0"
                max={selectedRelease ? remainingForRelease(selectedRelease) : undefined}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="Ex: 10.5"
              />
              {selectedRelease && (
                <p className="text-xs text-muted-foreground">
                  Máximo disponível: {remainingForRelease(selectedRelease)}
                </p>
              )}
            </div>

            {/* Driver Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="driverName">Nome do Motorista *</Label>
                <Input
                  id="driverName"
                  type="text"
                  value={form.driverName}
                  onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driverCPF">CPF do Motorista *</Label>
                <Input
                  id="driverCPF"
                  type="text"
                  value={form.driverCPF}
                  onChange={(e) => setForm({ ...form, driverCPF: maskCPF(e.target.value) })}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>
            </div>

            {/* Truck Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="truckPlate">Placa do Caminhão *</Label>
                <Input
                  id="truckPlate"
                  type="text"
                  value={form.truckPlate}
                  onChange={(e) => setForm({ ...form, truckPlate: maskPlate(e.target.value) })}
                  placeholder="ABC-1234 ou ABC1D23"
                  maxLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="truckType">Tipo de Caminhão *</Label>
                <Select
                  value={form.truckType}
                  onValueChange={(value) => setForm({ ...form, truckType: value })}
                >
                  <SelectTrigger id="truckType">
                    <SelectValue placeholder="Selecione o tipo" />
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

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Informações adicionais (opcional)"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-gradient-primary">
              Salvar Agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Agendamentos;
