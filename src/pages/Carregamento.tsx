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
import { Truck, Camera, RefreshCcw } from "lucide-react";
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
  releaseId?: number | string;      // para atualizar liberação
  productId?: number | string;      // para atualizar estoque
  warehouseId?: number | string;    // para atualizar estoque
  photosByType: Record<FotoTipo, number>;
}

const REQUIRED_PHOTO_TYPES_FOR_CONCLUDE: FotoTipo[] = [
  "antes_carregamento",
  "apos_carregamento",
  "nota_fiscal"
];

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "heic"];

const Carregamento = () => {
  const { toast } = useToast();
  const { hasRole, user } = useAuth();

  const canUpload = hasRole("admin") || hasRole("armazem") || hasRole("logistica");
  const canUpdateStatus = canUpload; // mesmas roles

  /* Estado local inicial (já usando novo fluxo de status) */
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

  /* ---- Diálogo de Upload de Fotos ---- */
  const [dialogUploadOpen, setDialogUploadOpen] = useState(false);
  const [selectedCarregamento, setSelectedCarregamento] = useState<CarregamentoItem | null>(null);
  const [fotoTipo, setFotoTipo] = useState<FotoTipo | "">("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  /* ---- Diálogo de Atualização de Status ---- */
  const [dialogStatusOpen, setDialogStatusOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<StatusCarregamento | "">("");
  const [statusObservation, setStatusObservation] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusItem, setStatusItem] = useState<CarregamentoItem | null>(null);

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

  const handleOpenDialogStatus = (c: CarregamentoItem) => {
    if (!canUpdateStatus) {
      toast({
        variant: "destructive",
        title: "Permissão insuficiente",
        description: "Apenas Admin, Armazém ou Logística podem atualizar status."
      });
      return;
    }
    if (c.status === "concluido" || c.status === "cancelado") {
      toast({
        variant: "destructive",
        title: "Status final",
        description: "Não é possível alterar status após concluído ou cancelado."
      });
      return;
    }
    setStatusItem(c);
    setDialogStatusOpen(true);
    setStatusTarget("");
    setStatusObservation("");
  };

  /* ----- Upload de Fotos ----- */
  const sanitizeFileName = (name: string) =>
    name
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9._-]/g, "");

  const validateFiles = (incoming: FileList | null) => {
    if (!incoming) return;

    const arr = Array.from(incoming);
    if (arr.length > 10) {
      toast({
        variant: "destructive",
        title: "Limite excedido",
        description: "Selecione no máximo 10 imagens por vez."
      });
      return;
    }

    const valid: File[] = [];
    const previewUrls: string[] = [];
    for (const f of arr) {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast({
          variant: "destructive",
          title: "Formato inválido",
          description: `Arquivo ${f.name} ignorado. Permitidos: ${ALLOWED_EXTENSIONS.join(", ")}`
        });
        continue;
      }
      valid.push(f);
      previewUrls.push(URL.createObjectURL(f));
    }

    setFiles(valid);
    setPreviews(previewUrls);
  };

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
        description: "Selecione ao menos uma imagem para enviar."
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
      setCarregamentos((prev) =>
        prev.map((c) =>
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

    if (sucesso > 0) {
      toast({
        title: "Upload concluído",
        description: `${sucesso} foto(s) anexada(s) com sucesso${
          falhas > 0 ? ` (${falhas} falha(s))` : ""
        }.`
      });
    } else {
      toast({
        variant: "destructive",
        title: "Falha no upload",
        description: "Nenhuma foto foi enviada. Verifique o bucket e as migrations."
      });
    }

    setUploading(false);
    setDialogUploadOpen(false);
    setFiles([]);
    setPreviews([]);
    setFotoTipo("");
  };

  /* ----- Atualização de Status ----- */
  const nextValidStatuses = (current: StatusCarregamento): StatusCarregamento[] => {
    switch (current) {
      case "aguardando":
        return ["em_andamento", "cancelado"];
      case "em_andamento":
        return ["concluido", "cancelado"];
      default:
        return []; // concluido ou cancelado -> final
    }
  };

  const canTransition = (
    from: StatusCarregamento,
    to: StatusCarregamento
  ): boolean => {
    if (from === "concluido" || from === "cancelado") return false;
    const valid = nextValidStatuses(from);
    return valid.includes(to);
  };

  const verifyRequiredPhotos = (item: CarregamentoItem): boolean => {
    for (const tipo of REQUIRED_PHOTO_TYPES_FOR_CONCLUDE) {
      if ((item.photosByType[tipo] || 0) < 1) {
        return false;
      }
    }
    return true;
  };

  const handleUpdateStatus = async () => {
    if (!statusItem) return;
    if (!statusTarget) {
      toast({
        variant: "destructive",
        title: "Selecione o novo status",
        description: "Escolha uma opção válida de status."
      });
      return;
    }
    if (!canUpdateStatus) {
      toast({
        variant: "destructive",
        title: "Permissão insuficiente",
        description: "Você não pode atualizar o status deste carregamento."
      });
      return;
    }

    // fluxo de transição
    if (!canTransition(statusItem.status, statusTarget as StatusCarregamento)) {
      toast({
        variant: "destructive",
        title: "Transição inválida",
        description: `Não é permitido mudar de '${statusItem.status}' para '${statusTarget}'.`
      });
      return;
    }

    // observação obrigatória ao cancelar
    if (statusTarget === "cancelado" && !statusObservation.trim()) {
      toast({
        variant: "destructive",
        title: "Observação obrigatória",
        description: "Informe uma observação ao cancelar."
      });
      return;
    }

    // verificações ao concluir
    if (statusTarget === "concluido") {
      if (!verifyRequiredPhotos(statusItem)) {
        toast({
          variant: "destructive",
          title: "Fotos obrigatórias ausentes",
          description:
            "Para concluir, é necessário pelo menos uma foto de: antes, depois e nota fiscal."
        });
        return;
      }
    }

    setStatusLoading(true);

    // Atualização local
    setCarregamentos((prev) =>
      prev.map((c) =>
        c.id === statusItem.id ? { ...c, status: statusTarget as StatusCarregamento } : c
      )
    );

    // Persistir no backend
    try {
      const { error: updateErr } = await supabase
        .from("carregamentos")
        .update({
          status: statusTarget,
          observacao_status: statusObservation || null,
          updated_by: user?.id ?? null,
          updated_at: new Date().toISOString()
        })
        .eq("id", statusItem.id);

      if (updateErr) {
        toast({
          variant: "destructive",
          title: "Persistência pendente",
          description:
            "Status atualizado localmente; não foi possível salvar no banco (tabela ou migrations podem faltar)."
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Persistência pendente",
        description:
          "Status atualizado localmente; não foi possível salvar no banco (erro inesperado)."
      });
    }

    // Operações ao concluir (atualiza liberação e estoque)
    if (statusTarget === "concluido") {
      await finalizeCarregamentoEffects(statusItem);
    }

    toast({
      title: "Status atualizado",
      description: `Carregamento #${statusItem.id} agora está '${statusTarget}'.`
    });

    setStatusLoading(false);
    setDialogStatusOpen(false);
    setStatusItem(null);
    setStatusTarget("");
    setStatusObservation("");
  };

  // Função: efeitos ao concluir (quantidade retirada + estoque)
  const finalizeCarregamentoEffects = async (item: CarregamentoItem) => {
    // Atualiza quantidade_retirada em liberação
    if (item.releaseId) {
      try {
        // Buscar quantidade atual
        const { data: libData, error: libErr } = await supabase
          .from("liberacoes")
          .select("id, quantidade_retirada")
          .eq("id", item.releaseId)
          .limit(1)
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
              title: "Falha ao atualizar liberação",
              description:
                "Não foi possível ajustar quantidade retirada. Migrations podem estar pendentes."
            });
          }
        }
      } catch {
        toast({
          variant: "destructive",
          title: "Falha ao atualizar liberação",
          description:
            "Erro inesperado ao somar quantidade retirada. Verifique o backend."
        });
      }
    }

    // Atualiza estoque (subtrai)
    if (item.productId && item.warehouseId) {
      try {
        const { data: stockData, error: stockErr } = await supabase
          .from("stock_balances")
          .select("id, quantidade_atual")
          .eq("product_id", item.productId)
          .eq("warehouse_id", item.warehouseId)
          .limit(1)
          .maybeSingle();

        if (!stockErr && stockData) {
          const atual = Number(stockData.quantidade_atual || 0);
            const novo = Math.max(0, atual - item.quantidade); // não deixar negativo
          const { error: upStockErr } = await supabase
            .from("stock_balances")
            .update({
              quantidade_atual: novo,
              updated_at: new Date().toISOString(),
              updated_by: user?.id ?? null
            })
            .eq("id", stockData.id);
          if (upStockErr) {
            toast({
              variant: "destructive",
              title: "Falha ao atualizar estoque",
              description:
                "Não foi possível subtrair quantidade. Migrations podem estar pendentes."
            });
          }
        }
      } catch {
        toast({
          variant: "destructive",
          title: "Falha ao atualizar estoque",
          description: "Erro inesperado ao subtrair quantidade do estoque."
        });
      }
    }
  };

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
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={getStatusBadgeVariant(carr.status)}>
                        {carr.status === "em_andamento"
                          ? "Em Andamento"
                          : carr.status.charAt(0).toUpperCase() + carr.status.slice(1)}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        Fotos: <span className="font-semibold">{carr.fotosTotal}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canUpload}
                          title={
                            canUpload
                              ? "Anexar fotos ao carregamento"
                              : "Apenas Admin, Armazém ou Logística podem anexar"
                          }
                          onClick={() => handleOpenDialogUpload(carr)}
                        >
                          <Camera className="h-4 w-4 mr-1" />
                          Anexar Fotos
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
                              ? "Status final não editável"
                              : canUpdateStatus
                              ? "Atualizar Status"
                              : "Sem permissão"
                          }
                          onClick={() => handleOpenDialogStatus(carr)}
                        >
                          <RefreshCcw className="h-4 w-4 mr-1" />
                          Atualizar Status
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Indicadores das fotos obrigatórias (opcional) */}
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

      {/* Dialog Upload */}
      <Dialog open={dialogUploadOpen} onOpenChange={setDialogUploadOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Anexar Fotos{" "}
              {selectedCarregamento
                ? `— Carregamento #${selectedCarregamento.id}`
                : ""}
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
                Formatos aceitos: jpg, jpeg, png, heic
              </p>
            </div>

            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {previews.map((src, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={src}
                      alt={`preview-${idx}`}
                      className="h-24 w-full rounded object-cover border"
                    />
                  </div>
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
              Atualizar Status{" "}
              {statusItem ? `— Carregamento #${statusItem.id}` : ""}
            </DialogTitle>
          </DialogHeader>

          {statusItem && (
            <div className="space-y-4 py-2">
              <div className="space-y-2 text-sm">
                <p>
                  Status atual:{" "}
                  <span className="font-medium">
                    {statusItem.status === "em_andamento"
                      ? "Em Andamento"
                      : statusItem.status.charAt(0).toUpperCase() +
                        statusItem.status.slice(1)}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Fluxo: aguardando → em_andamento → concluido (ou cancelado a qualquer momento)
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Novo Status</label>
                <Select
                  value={statusTarget}
                  onValueChange={(v) => setStatusTarget(v as StatusCarregamento)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {nextValidStatuses(statusItem.status).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s === "em_andamento"
                          ? "Em Andamento"
                          : s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                    {/* cancelar sempre disponível se não for final */}
                    {statusItem.status !== "concluido" &&
                      statusItem.status !== "cancelado" &&
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
                  placeholder="Detalhes da mudança de status"
                />
              </div>

              {statusTarget === "concluido" && (
                <div className="rounded border p-3 text-xs">
                  <p className="font-medium mb-1">Pré-requisitos para concluir:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>1+ foto de antes do carregamento</li>
                    <li>1+ foto de após o carregamento</li>
                    <li>1+ foto de nota fiscal</li>
                  </ul>
                  {!verifyRequiredPhotos(statusItem) && (
                    <p className="mt-2 text-destructive">
                      Fotos obrigatórias ainda incompletas.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogStatusOpen(false);
                setStatusItem(null);
              }}
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
    </div>
  );
};

export default Carregamento;
