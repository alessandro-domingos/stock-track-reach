import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Truck, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type CarregamentoStatus =
  | "aguardando"
  | "liberado"
  | "carregando"
  | "carregado"
  | "nf_entregue";

interface CarregamentoItem {
  id: number;
  cliente: string;
  produto: string;
  quantidade: number;
  placa: string;
  motorista: string;
  horario: string;
  status: CarregamentoStatus;
  fotos: number;
}

type FotoTipo =
  | "antes_carregamento"
  | "durante_carregamento"
  | "apos_carregamento"
  | "nota_fiscal"
  | "lacre";

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "heic"];

const Carregamento = () => {
  const { toast } = useToast();
  const { hasRole, user } = useAuth();

  const canUpload = hasRole("admin") || hasRole("armazem") || hasRole("logistica");

  const [carregamentos, setCarregamentos] = useState<CarregamentoItem[]>([
    {
      id: 1,
      cliente: "Cliente ABC",
      produto: "Ureia",
      quantidade: 4.0,
      placa: "ABC-1234",
      motorista: "João Silva",
      horario: "14:00",
      status: "carregando",
      fotos: 2,
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
      fotos: 0,
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
      fotos: 1,
    },
  ]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCarregamento, setSelectedCarregamento] = useState<CarregamentoItem | null>(null);
  const [fotoTipo, setFotoTipo] = useState<FotoTipo | "">("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

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

  const handleOpenDialog = (c: CarregamentoItem) => {
    if (!canUpload) {
      toast({
        variant: "destructive",
        title: "Permissão insuficiente",
        description: "Apenas Admin, Armazém ou Logística podem anexar fotos.",
      });
      return;
    }
    setSelectedCarregamento(c);
    setDialogOpen(true);
    setFotoTipo("");
    setFiles([]);
    setPreviews([]);
  };

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
        description: "Selecione no máximo 10 imagens por vez.",
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
          description: `Arquivo ${f.name} ignorado. Permitidos: ${ALLOWED_EXTENSIONS.join(", ")}`,
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
        description: "Selecione o tipo da foto.",
      });
      return;
    }
    if (files.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhuma imagem",
        description: "Selecione ao menos uma imagem para enviar.",
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
            contentType: file.type,
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

        // Inserir registro na tabela fotos_carregamento
        const { error: insertError } = await supabase
          .from("fotos_carregamento")
          .insert({
            carregamento_id: carregamentoId,
            url: publicUrl,
            tipo: fotoTipo,
            uploaded_by: user?.id ?? null,
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          // Mesmo se falhar a inserção, consideramos o upload feito para contar no card
          falhas++;
        } else {
          sucesso++;
        }
      } catch {
        falhas++;
      }
    }

    // Atualiza contador de fotos localmente (incrementa pelo número de uploads bem sucedidos)
    if (sucesso > 0) {
      setCarregamentos((prev) =>
        prev.map((c) =>
          c.id === carregamentoId ? { ...c, fotos: c.fotos + sucesso } : c
        )
      );
    }

    if (sucesso > 0) {
      toast({
        title: "Upload concluído",
        description: `${sucesso} foto(s) anexada(s) com sucesso${falhas > 0 ? ` (${falhas} falha(s))` : ""}.`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Falha no upload",
        description: "Nenhuma foto foi enviada. Verifique o bucket e as migrations.",
      });
    }

    setUploading(false);
    setDialogOpen(false);
    setFiles([]);
    setPreviews([]);
    setFotoTipo("");
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
                      <Badge variant={getStatusColor(carr.status)}>
                        {getStatusText(carr.status)}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        Fotos: <span className="font-semibold">{carr.fotos}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canUpload}
                        title={
                          canUpload
                            ? "Anexar fotos ao carregamento"
                            : "Apenas Admin, Armazém ou Logística podem anexar"
                        }
                        onClick={() => handleOpenDialog(carr)}
                      >
                        <Camera className="h-4 w-4 mr-1" />
                        Anexar Fotos
                      </Button>
                    </div>
                  </div>

                  {/* Espaço para outras ações futuras */}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={uploading}>
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
    </div>
  );
};

export default Carregamento;
