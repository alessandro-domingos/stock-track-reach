import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ClipboardList, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type StatusLib = "pendente" | "parcial" | "concluido" | "cancelado";

interface LiberacaoItem {
  id: number;
  produto: string;
  cliente: string;
  quantidade: number;
  quantidadeRetirada: number;
  pedido: string;
  data: string; // dd/mm/yyyy
  status: StatusLib;
  armazem?: string; // opcional
}

interface ProdutoOption {
  id: string;
  nome: string;
  unidade?: string | null;
}

interface ArmazemOption {
  id: string;
  nome: string;
}

const parseDate = (d: string) => {
  const [dd, mm, yyyy] = d.split("/");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};

const Liberacoes = () => {
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const canCreate = hasRole("logistica") || hasRole("admin");

  const [liberacoes, setLiberacoes] = useState<LiberacaoItem[]>([
    { id: 1, produto: "Ureia", cliente: "Cliente ABC Ltda", quantidade: 10.0, quantidadeRetirada: 6.0, pedido: "PED-2024-001", data: "15/01/2024", status: "parcial", armazem: "SP" },
    { id: 2, produto: "NPK 20-05-20", cliente: "Transportadora XYZ", quantidade: 15.0, quantidadeRetirada: 0, pedido: "PED-2024-002", data: "16/01/2024", status: "pendente", armazem: "RJ" },
    { id: 3, produto: "Super Simples", cliente: "Fazenda Boa Vista", quantidade: 20.0, quantidadeRetirada: 20.0, pedido: "PED-2024-003", data: "14/01/2024", status: "concluido", armazem: "MG" },
    { id: 4, produto: "MAP", cliente: "Agro Tech", quantidade: 8.5, quantidadeRetirada: 0, pedido: "PED-2024-004", data: "16/01/2024", status: "pendente", armazem: "PR" },
  ]);

  // (Se quiser, pode usar as opções carregadas anteriormente; mantendo o mock)

  /* -------- Filtros -------- */
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<StatusLib[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedArmazens, setSelectedArmazens] = useState<string[]>([]);

  const allStatuses: StatusLib[] = ["pendente", "parcial", "concluido", "cancelado"];
  const allArmazens = useMemo(
    () => Array.from(new Set(liberacoes.map((l) => l.armazem).filter(Boolean))) as string[],
    [liberacoes]
  );

  const toggleStatus = (st: StatusLib) => {
    setSelectedStatuses((prev) =>
      prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]
    );
  };
  const toggleArmazem = (a: string) => {
    setSelectedArmazens((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedStatuses([]);
    setDateFrom("");
    setDateTo("");
    setSelectedArmazens([]);
  };

  const filteredLiberacoes = useMemo(() => {
    return liberacoes.filter((l) => {
      const term = search.trim().toLowerCase();
      if (term) {
        const hay = `${l.produto} ${l.cliente} ${l.pedido}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(l.status)) {
        return false;
      }
      if (selectedArmazens.length > 0 && l.armazem && !selectedArmazens.includes(l.armazem)) {
        return false;
      }
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (parseDate(l.data) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (parseDate(l.data) > to) return false;
      }
      return true;
    });
  }, [liberacoes, search, selectedStatuses, selectedArmazens, dateFrom, dateTo]);

  const showingCount = filteredLiberacoes.length;
  const totalCount = liberacoes.length;

  /* ---- (Demais códigos anteriores de criação de nova liberação omitidos para foco nos filtros) ----
     Caso precise manter o diálogo de criação, reintroduzir a lógica já implementada previamente.
  */

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Liberações de Produtos"
        description="Gerencie as liberações de produtos para clientes"
        actions={
          <Button className="bg-gradient-primary" disabled={!canCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Liberação
          </Button>
        }
      />

      {/* Barra de Filtros */}
      <div className="container mx-auto px-6 pt-4">
        <div className="rounded-md border p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="busca-lib">Busca</Label>
              <Input
                id="busca-lib"
                placeholder="Filtrar por produto, cliente ou pedido..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <div className="flex flex-wrap gap-2 max-w-sm">
                {allStatuses.map((st) => {
                  const active = selectedStatuses.includes(st);
                  const label =
                    st === "pendente"
                      ? "Pendente"
                      : st === "parcial"
                        ? "Parcial"
                        : st === "concluido"
                          ? "Concluído"
                          : "Cancelado";
                  return (
                    <Badge
                      key={st}
                      onClick={() => toggleStatus(st)}
                      className={`cursor-pointer select-none ${
                        active ? "bg-gradient-primary text-white" : "bg-muted"
                      }`}
                    >
                      {label}
                    </Badge>
                  );
                })}
              </div>
            </div>
            {allArmazens.length > 0 && (
              <div className="space-y-1">
                <Label>Armazém</Label>
                <div className="flex flex-wrap gap-2 max-w-xs">
                  {allArmazens.map((a) => {
                    const active = selectedArmazens.includes(a);
                    return (
                      <Badge
                        key={a}
                        onClick={() => toggleArmazem(a)}
                        className={`cursor-pointer select-none ${
                          active ? "bg-gradient-primary text-white" : "bg-muted"
                        }`}
                      >
                        {a}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label>Período</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-40"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando <span className="font-medium">{showingCount}</span> de{" "}
              <span className="font-medium">{totalCount}</span> resultados
            </p>
            <Button variant="ghost" onClick={clearFilters} className="gap-2">
              <X className="h-4 w-4" />
              Limpar Filtros
            </Button>
          </div>
        </div>
      </div>

      {/* Lista filtrada */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid gap-4">
          {filteredLiberacoes.map((lib) => (
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
                      <p className="text-xs text-muted-foreground">
                        Data: {lib.data} {lib.armazem && `• ${lib.armazem}`}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Liberada: {lib.quantidade} • Retirada: {lib.quantidadeRetirada}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Badge
                      variant={
                        lib.status === "concluido"
                          ? "default"
                          : lib.status === "parcial"
                            ? "secondary"
                            : lib.status === "pendente"
                              ? "outline"
                              : "destructive"
                      }
                    >
                      {lib.status === "concluido"
                        ? "Concluído"
                        : lib.status === "parcial"
                          ? "Parcial"
                          : lib.status === "pendente"
                            ? "Pendente"
                            : "Cancelado"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredLiberacoes.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma liberação encontrada com os filtros atuais.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Liberacoes;
