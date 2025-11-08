import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Truck, Camera, RefreshCcw, FileCheck2, FilePlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/* Tipos */
type StatusCarregamento = "aguardando" | "em_andamento" | "concluido" | "cancelado";
type FotoTipo =
  | "antes_carregamento"
  | "durante_carregamento"
  | "apos_carregamento"
  | "nota_fiscal"
  | "lacre";

interface CarregamentoItem {
  id: number;
  cliente: string;
  produto: string;
  quantidade: number;
  placa: string;
  motorista: string;
  horario: string;
  status: StatusCarregamento;
  fotosTotal: number;
  releaseId?: number | string;
  productId?: number | string;
  warehouseId?: number | string;
  photosByType: Record<FotoTipo, number>;
  numeroNF?: string;
  dataEmissaoNF?: string; // ISO yyyy-mm-dd
  nfFileUrl?: string;
}

const REQUIRED_PHOTO_TYPES_FOR_CONCLUDE: FotoTipo[] = [
  "antes_carregamento",
  "apos_carregamento",
  "nota_fiscal"
];

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "heic"];
const ALLOWED_NF_EXTENSIONS = ["jpg", "jpeg", "png", "heic", "pdf"];

const Carregamento = () => {
  const { toast } = useToast();
  const { hasRole, user } = useAuth();

  const canUpload = hasRole("admin") || hasRole("armazem") || hasRole("logistica");
  const canUpdateStatus = canUpload;
  const canRegisterNF = canUpload;

  const [carregamentos, setCarregamentos] = useState<CarregamentoItem[]>([
    {
      id: 1,
      cliente: "Cliente ABC",
      produto: "Ureia",
      quantidade: 4.0,
      placa: "ABC-1234",
      motorista: "João Silva",
      horario: "14:00",
      status: "em_andamento",
      fotosTotal: 2,
      releaseId: 1,
      productId: 101,
      warehouseId: 11,
      photosByType: {
        antes_carregamento: 1,
        durante_carregamento: 1,
        apos_carregamento: 0,
        nota_fiscal: 0,
        lacre: 0
      }
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
      fotosTotal: 0,
      releaseId: 2,
      productId: 102,
      warehouseId: 11,
      photosByType: {
        antes_carregamento: 0,
        durante_carregamento: 0,
        apos_carregamento: 0,
        nota_fiscal: 0,
        lacre: 0
      }
    },
    {
      id: 3,
      cliente: "Fazenda Boa Vista",
      produto: "Super Simples",
      quantidade: 12.0,
      placa: "GHI-9012",
      motorista: "Pedro Costa",
      horario: "16:00",
      status: "aguardando",
      fotosTotal: 1,
      releaseId: 3,
      productId: 103,
      warehouseId: 12,
      photosByType: {
        antes_carregamento: 1,
        durante_carregamento: 0,
        apos_carregamento: 0,
        nota_fiscal: 0,
        lacre: 0
      }
    }
  ]);

  /* ---------- Dialog Upload Fotos (já existente) ---------- */
  const [dialogUploadOpen, setDialogUploadOpen] = useState(false);
  const [selectedCarregamento, setSelectedCarregamento] = useState<CarregamentoItem | null>(null);
  const [fotoTipo, setFotoTipo] = useState<FotoTipo | "">("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  /* ---------- Dialog Atualizar Status (já existente) ---------- */
  const [dialogStatusOpen, setDialogStatusOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<StatusCarregamento | "">("");
  const [statusObservation, setStatusObservation] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusItem, setStatusItem] = useState<CarregamentoItem | null>(null);

  /* ---------- Dialog NF Entregue (novo) ---------- */
  const [dialogNFOpen, setDialogNFOpen] = useState(false);
  const [nfItem, setNFItem] = useState<CarregamentoItem | null>(null);
  const [nfNumber, setNfNumber] = useState("");
  const [nfDate, setNfDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [nfFile, setNfFile] = useState<File | null>(null);
  const [nfUploading, setNfUploading] = useState(false);
  const [nfViewMode, setNfViewMode] = useState(false); // se já existe NF cadastrada

  /* ----- Helpers gerais ----- */
  const sanitizeFileName = (name: string) =>
    name
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9._-]/g, "");

  const getStatusBadgeVariant = (status: StatusCarregamento) => {
    switch (status) {
      case "aguardando":
        return "secondary";
      case "em_andamento":
        return "default";
      case "concluido":
        return "default";
      case "cancelado":
        return "destructive";
      default:
        return "outline";
    }
  };

  const nextValidStatuses = (current: StatusCarregamento): StatusCarregamento[] => {
    switch (current) {
      case "aguardando":
        return ["em_andamento", "cancelado"];
      case "em_andamento":
        return ["concluido", "cancelado"];
      default:
        return [];
    }
  };

  const canTransition = (from: StatusCarregamento, to: StatusCarregamento) => {
    if (from === "concluido" || from === "cancelado") return false;
    return nextValidStatuses(from).includes(to);
  };

  const verifyRequiredPhotos = (item: CarregamentoItem): boolean => {
    for (const tipo of REQUIRED_PHOTO_TYPES_FOR_CONCLUDE) {
      if ((item.photosByType[tipo] || 0) < 1) return false;
    }
    return true;
  };

  /* ----- Abrir diálogo upload fotos ----- */
  const handleOpenDialogUpload = (c: CarregamentoItem) => {
    if (!canUpload) {
      toast({
        variant: "destructive",
        title: "Permissão insuficiente",
        description: "Apenas Admin, Armazém ou Logística podem anexar fotos."
      });
      return;
    }
    setSelectedCarregamento(c);
    setDialogUploadOpen(true);
    setFotoTipo("");
    setFiles([]);
    setPreviews([]);
  };

  /* ----- Validação arquivos de fotos comuns ----- */
  const validateFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const arr = Array.from(incoming);
    if (arr.length > 10) {
      toast({
        variant: "destructive",
        title: "Limite excedido",
        description: "Selecione no máximo 10 imagens."
      });
      return;
    }

    const valid: File[] = [];
    const previewsLocal: string[] = [];
    for (const f of arr) {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast({
          variant: "destructive",
          title: "Formato inválido",
          description: `Ignorado: ${f.name}. Permitidos: ${ALLOWED_EXTENSIONS.join(", ")}`
        });
        continue;
      }
      valid.push(f);
      previewsLocal.push(URL.createObjectURL(f));
    }
    setFiles(valid);
    setPreviews(previewsLocal);
  };

  /* ----- Upload de fotos comuns ----- */
  const handleUpload = async () => {
    if (!selectedCarregamento) return;
    if (!fotoTipo) {
      toast({
        variant: "destructive",
        title: "Tipo obrigatório",
        description: "Selecione o tipo da foto."
      });
      return;
    }
    if (files.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhuma imagem",
        description: "Selecione ao menos uma imagem."
      });
      return;
    }

    setUploading(true);
    const carregamentoId = selectedCarregamento.id;
    let sucesso = 0;
    let falhas = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const timestamp = Date.now();
      const sanitized = sanitizeFileName(file.name);
      const path = `${carregamentoId}/${fotoTipo}/${timestamp}_${i}_${sanitized}`;

      try {
        const { error: uploadError } = await supabase
          .storage
          .from("carregamento-fotos")
          .upload(path, file, {
            upsert: false,
            contentType: file.type
          });

        if (uploadError) {
          falhas++;
          continue;
        }

        const { data: publicData } = supabase
          .storage
          .from("carregamento-fotos")
          .getPublicUrl(path);

        const publicUrl = publicData?.publicUrl;

        const { error: insertError } = await supabase
          .from("fotos_carregamento")
          .insert({
            carregamento_id: carregamentoId,
            url: publicUrl,
            tipo: fotoTipo,
            uploaded_by: user?.id ?? null,
            created_at: new Date().toISOString()
          });

        if (insertError) {
          falhas++;
        } else {
          sucesso++;
        }
      } catch {
        falhas++;
      }
    }

    if (sucesso > 0) {
      setCarregamentos(prev =>
        prev.map(c =>
          c.id === carregamentoId
            ? {
                ...c,
                fotosTotal: c.fotosTotal + sucesso,
                photosByType: {
                  ...c.photosByType,
                  [fotoTipo]: (c.photosByType[fotoTipo] || 0) + sucesso
                }
              }
            : c
        )
      );
    }

    toast({
      title: sucesso > 0 ? "Upload concluído" : "Falha no upload",
      description:
        sucesso > 0
          ? `${sucesso} foto(s) anexada(s)${falhas ? ` (${falhas} falha(s))` : ""}.`
          : "Nenhuma foto enviada."
    });

    setUploading(false);
    setDialogUploadOpen(false);
    setFiles([]);
    setPreviews([]);
    setFotoTipo("");
  };

  /* ----- Abrir diálogo status ----- */
  const handleOpenDialogStatus = (c: CarregamentoItem) => {
    if (!canUpdateStatus) {
      toast({
        variant: "destructive",
        title: "Sem permissão",
        description: "Você não pode atualizar status."
      });
      return;
    }
    if (c.status === "concluido" || c.status === "cancelado") {
      toast({
        variant: "destructive",
        title: "Status final",
        description: "Não é possível alterar após conclusão/cancelamento."
      });
      return;
    }
    setStatusItem(c);
    setDialogStatusOpen(true);
    setStatusTarget("");
    setStatusObservation("");
  };

  /* ----- Atualização de status ----- */
  const handleUpdateStatus = async () => {
    if (!statusItem) return;
    if (!statusTarget) {
      toast({
        variant: "destructive",
        title: "Selecione um status",
        description: "É necessário escolher o novo status."
      });
      return;
    }
    if (!canUpdateStatus) {
      toast({
        variant: "destructive",
        title: "Sem permissão",
        description: "Você não pode alterar o status."
      });
      return;
    }
    if (!canTransition(statusItem.status, statusTarget as StatusCarregamento)) {
      toast({
        variant: "destructive",
        title: "Transição inválida",
        description: `De '${statusItem.status}' para '${statusTarget}' não é permitido.`
      });
      return;
    }
    if (statusTarget === "cancelado" && !statusObservation.trim()) {
      toast({
        variant: "destructive",
        title: "Observação obrigatória",
        description: "Informe uma observação para cancelamento."
      });
      return;
    }
    if (statusTarget === "concluido" && !verifyRequiredPhotos(statusItem)) {
      toast({
        variant: "destructive",
        title: "Fotos obrigatórias ausentes",
        description: "Faltam fotos: antes, após e nota fiscal."
      });
      return;
    }

    setStatusLoading(true);
    setCarregamentos(prev =>
      prev.map(c =>
        c.id === statusItem.id ? { ...c, status: statusTarget as StatusCarregamento } : c
      )
    );

    try {
      const { error } = await supabase
        .from("carregamentos")
        .update({
          status: statusTarget,
          observacao_status: statusObservation || null,
          updated_by: user?.id ?? null,
          updated_at: new Date().toISOString()
        })
        .eq("id", statusItem.id);
      if (error) {
        toast({
          variant: "destructive",
          title: "Persistência pendente",
          description: "Mudança local aplicada. Banco não atualizado."
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Erro inesperado",
        description: "Falha ao persistir mudança de status."
      });
    }

    if (statusTarget === "concluido") {
      await finalizeCarregamentoEffects(statusItem);
    }

    toast({
      title: "Status atualizado",
      description: `Carregamento #${statusItem.id} agora: ${statusTarget}.`
    });

    setStatusLoading(false);
    setDialogStatusOpen(false);
    setStatusItem(null);
  };

  /* ----- Efeitos ao concluir: liberação + estoque ----- */
  const finalizeCarregamentoEffects = async (item: CarregamentoItem) => {
    // Atualiza quantidade_retirada
    if (item.releaseId) {
      try {
        const { data: libData, error: libErr } = await supabase
          .from("liberacoes")
          .select("id, quantidade_retirada")
          .eq("id", item.releaseId)
          .maybeSingle();
        if (!libErr && libData) {
          const atual = Number(libData.quantidade_retirada || 0);
          const novo = atual + item.quantidade;
          const { error: upErr } = await supabase
            .from("liberacoes")
            .update({
              quantidade_retirada: novo,
              updated_at: new Date().toISOString(),
              updated_by: user?.id ?? null
            })
            .eq("id", item.releaseId);
          if (upErr) {
            toast({
              variant: "destructive",
              title: "Liberação pendente",
              description: "Não foi possível atualizar quantidade retirada."
            });
          }
        }
      } catch {
        toast({
          variant: "destructive",
          title: "Erro liberação",
          description: "Falha ao recalcular retirada."
        });
      }
    }

    // Atualiza estoque
    if (item.productId && item.warehouseId) {
      try {
        const { data: stockData, error: stockErr } = await supabase
          .from("stock_balances")
          .select("id, quantidade_atual")
          .eq("product_id", item.productId)
          .eq("warehouse_id", item.warehouseId)
          .maybeSingle();
        if (!stockErr && stockData) {
          const atual = Number(stockData.quantidade_atual || 0);
          const novo = Math.max(0, atual - item.quantidade);
          const { error: upErr } = await supabase
            .from("stock_balances")
            .update({
              quantidade_atual: novo,
              updated_at: new Date().toISOString(),
              updated_by: user?.id ?? null
            })
            .eq("id", stockData.id);
          if (upErr) {
            toast({
              variant: "destructive",
              title: "Estoque pendente",
              description: "Não foi possível atualizar saldo."
            });
          }
        }
      } catch {
        toast({
          variant: "destructive",
          title: "Erro estoque",
          description: "Falha ao subtrair do estoque."
        });
      }
    }
  };

  /* ----- NF Entregue: abrir diálogo ----- */
  const openNFDialog = (item: CarregamentoItem) => {
    if (!canRegisterNF) {
      toast({
        variant: "destructive",
        title: "Sem permissão",
        description: "Apenas Admin, Armazém ou Logística podem registrar NF."
      });
      return;
    }
    setNFItem(item);
    setDialogNFOpen(true);
    setNfNumber(item.numeroNF || "");
    setNfDate(item.dataEmissaoNF || (() => {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    })());
    setNfFile(null);
    setNfViewMode(Boolean(item.numeroNF));
  };

  /* ----- NF: validações ----- */
  const handleNFFileChange = (f: File | null) => {
    if (!f) {
      setNfFile(null);
      return;
    }
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_NF_EXTENSIONS.includes(ext)) {
      toast({
        variant: "destructive",
        title: "Formato inválido",
        description: `Permitidos: ${ALLOWED_NF_EXTENSIONS.join(", ")}`
      });
      setNfFile(null);
      return;
    }
    setNfFile(f);
  };

  const handleSaveNF = async () => {
    if (!nfItem) return;
    if (!nfNumber.trim()) {
      toast({
        variant: "destructive",
        title: "Número obrigatório",
        description: "Informe o número da NF."
      });
      return;
    }
    // Data não pode ser futura
    const hoje = new Date();
    const nfDateObj = new Date(nfDate + "T00:00:00");
    if (nfDateObj > hoje) {
      toast({
        variant: "destructive",
        title: "Data inválida",
        description: "Data de emissão não pode ser futura."
      });
      return;
    }
    if (!nfFile) {
      toast({
        variant: "destructive",
        title: "Arquivo obrigatório",
        description: "Selecione o arquivo da NF (imagem ou PDF)."
      });
      return;
    }

    setNfUploading(true);
    const carregamentoId = nfItem.id;
    const timestamp = Date.now();
    const sanitized = sanitizeFileName(nfFile.name);
    const path = `${carregamentoId}/notas_fiscais/${timestamp}_${sanitized}`;

    let publicUrl: string | undefined = undefined;

    try {
      const { error: upErr } = await supabase
        .storage
        .from("carregamento-fotos")
        .upload(path, nfFile, {
          upsert: false,
          contentType: nfFile.type
        });
      if (upErr) throw upErr;

      const { data: pubData } = supabase
        .storage
        .from("carregamento-fotos")
        .getPublicUrl(path);
      publicUrl = pubData?.publicUrl;

      // inserir foto tipo nota_fiscal
      const { error: fotoErr } = await supabase
        .from("fotos_carregamento")
        .insert({
          carregamento_id: carregamentoId,
          url: publicUrl,
          tipo: "nota_fiscal",
          uploaded_by: user?.id ?? null,
          created_at: new Date().toISOString()
        });
      if (fotoErr) {
        toast({
          variant: "destructive",
          title: "Persistência parcial",
          description: "Upload ok, mas falhou registrar foto (tabela)."
        });
      }

      // atualizar carregamentos (numero_nf, data_emissao_nf e status se for aguardando)
      const newStatus =
        nfItem.status === "aguardando" ? "em_andamento" : nfItem.status;

      const { error: carrErr } = await supabase
        .from("carregamentos")
        .update({
          numero_nf: nfNumber.trim(),
          data_emissao_nf: nfDate,
          status: newStatus,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null
        })
        .eq("id", carregamentoId);

      if (carrErr) {
        toast({
          variant: "destructive",
          title: "Persistência pendente",
          description: "NF registrada localmente, banco não atualizado."
        });
      }

      // Atualização local
      setCarregamentos(prev =>
        prev.map(c =>
          c.id === carregamentoId
            ? {
                ...c,
                numeroNF: nfNumber.trim(),
                dataEmissaoNF: nfDate,
                nfFileUrl: publicUrl,
                status: newStatus,
                fotosTotal: c.fotosTotal + 1,
                photosByType: {
                  ...c.photosByType,
                  nota_fiscal: (c.photosByType.nota_fiscal || 0) + 1
                }
              }
            : c
        )
      );

      toast({
        title: "NF registrada",
        description: `NF ${nfNumber.trim()} anexada com sucesso.`
      });

      setDialogNFOpen(false);
      setNFItem(null);
      setNfUploading(false);
      setNfNumber("");
      setNfDate("");
      setNfFile(null);
    } catch {
      toast({
        variant: "destructive",
        title: "Falha no upload",
        description: "Não foi possível salvar a NF. Verifique bucket/migrations."
      });
      setNfUploading(false);
    }
  };

  const getStatusText = (status: StatusCarregamento) => {
    switch (status) {
      case "aguardando":
        return "Aguardando";
      case "em_andamento":
        return "Em Andamento";
      case "concluido":
        return "Concluído";
      case "cancelado":
        return "Cancelado";
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
                          Placa: <span className="font-medium text-foreground">{carr.placa}</span>
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Motorista: <span className="font-medium text-foreground">{carr.motorista}</span>
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Horário: <span className="font-medium text-foreground">{carr.horario}</span>
                        </p>
                        {carr.numeroNF && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            NF: <span className="font-medium text-foreground">{carr.numeroNF}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={getStatusBadgeVariant(carr.status)}>
                        {getStatusText(carr.status)}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        Fotos: <span className="font-semibold">{carr.fotosTotal}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canUpload}
                          title={
                            canUpload
                              ? "Anexar fotos ao carregamento"
                              : "Sem permissão"
                          }
                          onClick={() => handleOpenDialogUpload(carr)}
                        >
                          <Camera className="h-4 w-4 mr-1" />
                          Fotos
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            !canUpdateStatus ||
                            carr.status === "concluido" ||
                            carr.status === "cancelado"
                          }
                          title={
                            carr.status === "concluido" || carr.status === "cancelado"
                              ? "Status final"
                              : canUpdateStatus
                              ? "Atualizar Status"
                              : "Sem permissão"
                          }
                          onClick={() => handleOpenDialogStatus(carr)}
                        >
                          <RefreshCcw className="h-4 w-4 mr-1" />
                          Status
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canRegisterNF}
                          title={
                            canRegisterNF
                              ? carr.numeroNF ? "Ver NF" : "Registrar NF"
                              : "Sem permissão"
                          }
                          onClick={() => openNFDialog(carr)}
                          className={carr.numeroNF ? "border-green-500 text-green-600" : ""}
                        >
                          {carr.numeroNF ? (
                            <>
                              <FileCheck2 className="h-4 w-4 mr-1" />
                              Ver NF
                            </>
                          ) : (
                            <>
                              <FilePlus className="h-4 w-4 mr-1" />
                              NF Entregue
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    {REQUIRED_PHOTO_TYPES_FOR_CONCLUDE.map((tipo) => {
                      const qtd = carr.photosByType[tipo] || 0;
                      return (
                        <div
                          key={tipo}
                          className={`rounded border px-2 py-1 ${
                            qtd > 0 ? "border-green-500 text-green-600" : "border-muted text-muted-foreground"
                          }`}
                        >
                          {tipo.replace("_", " ")}: {qtd}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Dialog Upload Fotos */}
      <Dialog open={dialogUploadOpen} onOpenChange={setDialogUploadOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Anexar Fotos {selectedCarregamento ? `— Carregamento #${selectedCarregamento.id}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo da Foto</label>
              <Select value={fotoTipo} onValueChange={(v) => setFotoTipo(v as FotoTipo)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="antes_carregamento">Antes do Carregamento</SelectItem>
                  <SelectItem value="durante_carregamento">Durante o Carregamento</SelectItem>
                  <SelectItem value="apos_carregamento">Após o Carregamento</SelectItem>
                  <SelectItem value="nota_fiscal">Nota Fiscal</SelectItem>
                  <SelectItem value="lacre">Lacre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Selecionar Imagens (máx. 10) / Câmera (mobile)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={(e) => validateFiles(e.target.files)}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: {ALLOWED_EXTENSIONS.join(", ")}
              </p>
            </div>
            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {previews.map((src, idx) => (
                  <img
                    key={idx}
                    src={src}
                    alt={`preview-${idx}`}
                    className="h-24 w-full rounded object-cover border"
                  />
                ))}
              </div>
            )}
            {files.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {files.length} arquivo(s) pronto(s) para upload.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogUploadOpen(false)} disabled={uploading}>
              Cancelar
            </Button>
            <Button
              className="bg-gradient-primary"
              onClick={handleUpload}
              disabled={uploading || !selectedCarregamento}
            >
              {uploading ? "Enviando..." : "Confirmar Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Atualizar Status */}
      <Dialog open={dialogStatusOpen} onOpenChange={setDialogStatusOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Atualizar Status {statusItem ? `— Carregamento #${statusItem.id}` : ""}
            </DialogTitle>
          </DialogHeader>
          {statusItem && (
            <div className="space-y-4 py-2">
              <div className="space-y-1 text-sm">
                <p>Status atual: <span className="font-medium">{getStatusText(statusItem.status)}</span></p>
                <p className="text-muted-foreground">Fluxo: aguardando → em_andamento → concluido (ou cancelado)</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Novo Status</label>
                <Select value={statusTarget} onValueChange={(v) => setStatusTarget(v as StatusCarregamento)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {nextValidStatuses(statusItem.status).map(s => (
                      <SelectItem key={s} value={s}>
                        {getStatusText(s)}
                      </SelectItem>
                    ))}
                    {/* Garantir cancelado sempre disponível se não final */}
                    {statusItem.status !== "concluido" && statusItem.status !== "cancelado" &&
                      !nextValidStatuses(statusItem.status).includes("cancelado") && (
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Observação {statusTarget === "cancelado" && "(obrigatória)"}
                </label>
                <Textarea
                  value={statusObservation}
                  onChange={(e) => setStatusObservation(e.target.value)}
                  placeholder="Detalhes da mudança"
                />
              </div>
              {statusTarget === "concluido" && (
                <div className="rounded border p-3 text-xs">
                  <p className="font-medium mb-1">Pré-requisitos:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Foto antes</li>
                    <li>Foto após</li>
                    <li>Foto nota fiscal</li>
                  </ul>
                  {!verifyRequiredPhotos(statusItem) && (
                    <p className="mt-2 text-destructive">
                      Ainda faltam fotos obrigatórias.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDialogStatusOpen(false); setStatusItem(null); }}
              disabled={statusLoading}
            >
              Cancelar
            </Button>
            <Button
              className="bg-gradient-primary"
              onClick={handleUpdateStatus}
              disabled={
                statusLoading ||
                !statusItem ||
                !statusTarget ||
                (statusTarget === "cancelado" && !statusObservation.trim())
              }
            >
              {statusLoading ? "Atualizando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog NF Entregue / Ver NF */}
      <Dialog open={dialogNFOpen} onOpenChange={setDialogNFOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {nfViewMode ? "Nota Fiscal" : "Registrar Nota Fiscal"}
              {nfItem ? ` — Carregamento #${nfItem.id}` : ""}
            </DialogTitle>
          </DialogHeader>

          {nfItem && (
            <div className="space-y-4 py-2 text-sm">
              {nfViewMode ? (
                <>
                  <p><span className="text-muted-foreground">NF:</span> <span className="font-medium">{nfItem.numeroNF}</span></p>
                  <p><span className="text-muted-foreground">Data Emissão:</span> <span className="font-medium">{nfItem.dataEmissaoNF}</span></p>
                  {nfItem.nfFileUrl && (
                    nfItem.nfFileUrl.toLowerCase().endsWith(".pdf") ? (
                      <a
                        href={nfItem.nfFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        Abrir PDF da NF
                      </a>
                    ) : (
                      <img
                        src={nfItem.nfFileUrl}
                        alt="NF"
                        className="rounded border max-h-60 object-contain"
                      />
                    )
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Número da NF</label>
                    <Input
                      value={nfNumber}
                      onChange={(e) => setNfNumber(e.target.value)}
                      placeholder="Ex.: 123456-XYZ"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data de Emissão</label>
                    <Input
                      type="date"
                      value={nfDate}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setNfDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Arquivo da NF (imagem ou PDF)
                    </label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleNFFileChange(e.target.files?.[0] || null)}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Formatos: {ALLOWED_NF_EXTENSIONS.join(", ")}
                    </p>
                    {nfFile && (
                      <p className="text-xs text-muted-foreground">
                        Selecionado: {nfFile.name}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogNFOpen(false);
                setNFItem(null);
                setNfViewMode(false);
              }}
              disabled={nfUploading}
            >
              Fechar
            </Button>
            {!nfViewMode && (
              <Button
                className="bg-gradient-primary"
                onClick={handleSaveNF}
                disabled={nfUploading || !nfItem}
              >
                {nfUploading ? "Salvando..." : "Salvar NF"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Carregamento;
