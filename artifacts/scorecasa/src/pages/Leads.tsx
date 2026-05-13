import { useState } from "react";
import { Link } from "wouter";
import {
  useGetLeads,
  useCreateLead,
  useDeleteLead,
  useGetBrokers,
  getGetLeadsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Plus, Trash2, ChevronRight, Filter, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pendente", color: "#92400E", bg: "#FEF3C7" },
  analyzing: { label: "Em Analise", color: "#1E40AF", bg: "#DBEAFE" },
  approved: { label: "Aprovado", color: "#065F46", bg: "#D1FAE5" },
  rejected: { label: "Reprovado", color: "#991B1B", bg: "#FEE2E2" },
  in_progress: { label: "Em Andamento", color: "#7C3AED", bg: "#EDE9FE" },
};

const createLeadSchema = z.object({
  name: z.string().min(3, "Nome obrigatorio"),
  cpf: z.string().min(11, "CPF invalido"),
  email: z.string().email("Email invalido"),
  phone: z.string().min(10, "Telefone invalido"),
  income: z.coerce.number().min(1000, "Renda minima R$ 1.000"),
  propertyValue: z.coerce.number().min(50000, "Valor minimo R$ 50.000"),
  brokerId: z.string().optional(),
});

type CreateLeadForm = z.infer<typeof createLeadSchema>;

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#374151", bg: "#F3F4F6" };
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

function formatCPF(cpf: string) {
  const digits = cpf.replace(/\D/g, "");
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

export function Leads() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useGetLeads(
    { search: search || undefined, status: statusFilter as any || undefined, page, limit: 15 },
    { query: { queryKey: getGetLeadsQueryKey({ search: search || undefined, status: statusFilter as any || undefined, page, limit: 15 }) } }
  );

  const { data: brokers } = useGetBrokers({});
  const createLead = useCreateLead();
  const deleteLead = useDeleteLead();

  const form = useForm<CreateLeadForm>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: { name: "", cpf: "", email: "", phone: "", income: 0, propertyValue: 0 },
  });

  const onSubmit = (formData: CreateLeadForm) => {
    createLead.mutate(
      {
        data: {
          ...formData,
          brokerId: formData.brokerId ? Number(formData.brokerId) : null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["getLeads"] });
          setCreateOpen(false);
          form.reset();
          toast({ title: "Lead criado com sucesso" });
        },
      }
    );
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Excluir o lead "${name}"?`)) return;
    deleteLead.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["getLeads"] });
        toast({ title: "Lead excluido" });
      },
    });
  };

  const totalPages = data ? Math.ceil(data.total / 15) : 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} clientes cadastrados</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="text-white gap-2" style={{ background: "#0D1B8C" }} data-testid="button-add-lead">
              <Plus className="w-4 h-4" />
              Novo Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Lead</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Nome completo</FormLabel>
                      <FormControl><Input {...field} data-testid="input-lead-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="cpf" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl><Input {...field} placeholder="000.000.000-00" data-testid="input-lead-cpf" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl><Input {...field} placeholder="(11) 99999-9999" data-testid="input-lead-phone" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input {...field} type="email" data-testid="input-lead-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="income" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Renda mensal (R$)</FormLabel>
                      <FormControl><Input {...field} type="number" data-testid="input-lead-income" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="propertyValue" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor do imovel (R$)</FormLabel>
                      <FormControl><Input {...field} type="number" data-testid="input-lead-property-value" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="brokerId" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Corretor (opcional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-lead-broker">
                            <SelectValue placeholder="Selecionar corretor..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(brokers ?? []).map((b) => (
                            <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="flex-1 text-white" style={{ background: "#0D1B8C" }} disabled={createLead.isPending} data-testid="button-save-lead">
                    {createLead.isPending ? "Salvando..." : "Cadastrar Lead"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF ou email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
            data-testid="input-search-leads"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Renda</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Imovel</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chance</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Score Caixa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                      <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-12" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                      <td className="px-4 py-3" />
                    </tr>
                  ))
                : (data?.data ?? []).map((lead) => (
                    <tr key={lead.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`row-lead-${lead.id}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{lead.name}</div>
                        <div className="text-xs text-muted-foreground">{formatCPF(lead.cpf)}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{formatBRL(lead.income)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{formatBRL(lead.propertyValue)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${lead.approvalChance}%`,
                                background: lead.approvalChance >= 70 ? "#10A65A" : lead.approvalChance >= 40 ? "#F59E0B" : "#EF4444",
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-foreground">{lead.approvalChance}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="font-mono text-sm font-semibold text-foreground">{lead.scoreCaixa}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/leads/${lead.id}`}>
                            <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" data-testid={`button-view-lead-${lead.id}`}>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </Link>
                          <button
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-500"
                            onClick={() => handleDelete(lead.id, lead.name)}
                            data-testid={`button-delete-lead-${lead.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {!isLoading && (data?.data?.length ?? 0) === 0 && (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <div className="text-sm font-medium text-foreground">Nenhum lead encontrado</div>
            <div className="text-xs text-muted-foreground mt-1">Ajuste os filtros ou cadastre um novo lead</div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Pagina {page} de {totalPages} — {data?.total} resultados
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Anterior</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Proximo</Button>
          </div>
        </div>
      )}
    </div>
  );
}
