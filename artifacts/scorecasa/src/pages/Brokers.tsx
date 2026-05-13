import { useState } from "react";
import {
  useGetBrokers,
  useCreateBroker,
  useUpdateBroker,
  getGetBrokersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Plus, UserCheck, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const createBrokerSchema = z.object({
  name: z.string().min(3, "Nome obrigatorio"),
  email: z.string().email("Email invalido"),
  phone: z.string().min(10, "Telefone invalido"),
  creci: z.string().min(3, "CRECI obrigatorio"),
});

type CreateBrokerForm = z.infer<typeof createBrokerSchema>;

export function Brokers() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: brokers, isLoading } = useGetBrokers(
    { search: search || undefined },
    { query: { queryKey: getGetBrokersQueryKey({ search: search || undefined }) } }
  );

  const createBroker = useCreateBroker();
  const updateBroker = useUpdateBroker();

  const form = useForm<CreateBrokerForm>({
    resolver: zodResolver(createBrokerSchema),
    defaultValues: { name: "", email: "", phone: "", creci: "" },
  });

  const onSubmit = (data: CreateBrokerForm) => {
    createBroker.mutate(
      { data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["getBrokers"] });
          setCreateOpen(false);
          form.reset();
          toast({ title: "Corretor cadastrado com sucesso" });
        },
      }
    );
  };

  const toggleStatus = (id: number, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    updateBroker.mutate(
      { id, data: { status: newStatus as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["getBrokers"] });
          toast({ title: `Corretor ${newStatus === "active" ? "ativado" : "desativado"}` });
        },
      }
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Corretores</h1>
          <p className="text-sm text-muted-foreground">{brokers?.length ?? 0} corretores cadastrados</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="text-white gap-2" style={{ background: "#0D1B8C" }} data-testid="button-add-broker">
              <Plus className="w-4 h-4" />
              Novo Corretor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cadastrar Corretor</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl><Input {...field} data-testid="input-broker-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input {...field} type="email" data-testid="input-broker-email" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl><Input {...field} placeholder="(11) 99999-9999" data-testid="input-broker-phone" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="creci" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CRECI</FormLabel>
                    <FormControl><Input {...field} placeholder="CRECI-SP 12345" data-testid="input-broker-creci" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="flex-1 text-white" style={{ background: "#0D1B8C" }} disabled={createBroker.isPending} data-testid="button-save-broker">
                    {createBroker.isPending ? "Salvando..." : "Cadastrar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar corretor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-brokers"
        />
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))
          : (brokers ?? []).map((broker) => {
              const isActive = broker.status === "active";
              const approvalRate = broker.totalLeads > 0
                ? Math.round((broker.approvedLeads / broker.totalLeads) * 100)
                : 0;

              return (
                <div
                  key={broker.id}
                  className="bg-card rounded-xl border border-card-border p-5 shadow-sm"
                  data-testid={`card-broker-${broker.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm"
                        style={{ background: "#0D1B8C" }}
                      >
                        {broker.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground">{broker.name}</div>
                        <div className="text-xs text-muted-foreground">{broker.creci}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleStatus(broker.id, broker.status)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      data-testid={`button-toggle-broker-${broker.id}`}
                    >
                      {isActive
                        ? <ToggleRight className="w-5 h-5" style={{ color: "#10A65A" }} />
                        : <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                      }
                    </button>
                  </div>

                  <div className="space-y-1 mb-3">
                    <div className="text-xs text-muted-foreground">{broker.email}</div>
                    <div className="text-xs text-muted-foreground">{broker.phone}</div>
                  </div>

                  <div className="border-t border-border/50 pt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-base font-bold text-foreground">{broker.totalLeads}</div>
                      <div className="text-xs text-muted-foreground">Leads</div>
                    </div>
                    <div>
                      <div className="text-base font-bold" style={{ color: "#10A65A" }}>{broker.approvedLeads}</div>
                      <div className="text-xs text-muted-foreground">Aprovados</div>
                    </div>
                    <div>
                      <div className="text-base font-bold" style={{ color: approvalRate >= 60 ? "#10A65A" : approvalRate >= 40 ? "#F59E0B" : "#EF4444" }}>
                        {approvalRate}%
                      </div>
                      <div className="text-xs text-muted-foreground">Taxa</div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${approvalRate}%`,
                          background: approvalRate >= 60 ? "#10A65A" : approvalRate >= 40 ? "#F59E0B" : "#EF4444",
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 text-center">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={isActive ? { color: "#065F46", background: "#D1FAE5" } : { color: "#374151", background: "#F3F4F6" }}
                    >
                      {isActive ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </div>
              );
            })}
      </div>

      {!isLoading && (brokers ?? []).length === 0 && (
        <div className="py-16 text-center bg-card rounded-xl border border-card-border">
          <UserCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <div className="text-sm font-medium text-foreground">Nenhum corretor encontrado</div>
          <div className="text-xs text-muted-foreground mt-1">Cadastre um novo corretor para comecar</div>
        </div>
      )}
    </div>
  );
}
