import { useState } from "react";
import { Users, UserPlus, Shield, ShieldCheck, Trash2, CheckCircle2, AlertTriangle, Key, Sparkles, Mail, Lock, User, Briefcase } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  title: string;
  permissions: string[];
  isOwner: boolean;
  createdAt: string;
}

interface TeamData {
  mainOwnerId: number;
  userRole: string;
  userLimit: number | null;
  leadLimit: number | null;
  usedCount: number;
  subUsersCount: number;
  canInvite: boolean;
  planLabel: string;
  members: TeamMember[];
}

const AVAILABLE_PERMISSIONS = [
  { id: "leads_view", label: "Visualizar Leads da Equipe", desc: "Acesso a todos os clientes da empresa" },
  { id: "leads_create", label: "Cadastrar Novos Leads", desc: "Permite inserir novos clientes no sistema" },
  { id: "simulations", label: "Simular Financiamentos", desc: "Acesso às ferramentas de simulação bancária" },
  { id: "properties", label: "Acessar Vitrine de Imóveis", desc: "Visualizar e associar imóveis a clientes" },
  { id: "processes", label: "Gerenciar Esteira de Processos", desc: "Acompanhamento de aprovações Caixa/SIRIC" },
];

export function Equipe() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  // Form State para cadastro
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    title: "Corretor da Equipe",
    permissions: ["leads_view", "leads_create", "simulations", "properties"],
  });

  // Form State para edição de permissões
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editTitle, setEditTitle] = useState("");

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  // Fetch Team Data
  const { data: teamData, isLoading, error } = useQuery<TeamData>({
    queryKey: ["/api/team"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/team`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar equipe");
      return res.json();
    },
  });

  // Mutation: Cadastrar Membro
  const inviteMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await fetch(`${BASE}/api/team/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao convidar membro");
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Sucesso!", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      setShowInviteModal(false);
      setForm({
        name: "",
        email: "",
        password: "",
        title: "Corretor da Equipe",
        permissions: ["leads_view", "leads_create", "simulations", "properties"],
      });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // Mutation: Editar Permissões
  const updatePermsMutation = useMutation({
    mutationFn: async ({ id, title, permissions }: { id: number; title: string; permissions: string[] }) => {
      const res = await fetch(`${BASE}/api/team/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, permissions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar permissões");
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Sucesso!", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      setShowEditModal(false);
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // Mutation: Remover Membro
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/team/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao remover membro");
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Removido!", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const toggleFormPermission = (permId: string) => {
    setForm((prev) => {
      const exists = prev.permissions.includes(permId);
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter((p) => p !== permId)
          : [...prev.permissions, permId],
      };
    });
  };

  const toggleEditPermission = (permId: string) => {
    setEditPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const openEditModal = (member: TeamMember) => {
    setEditingMember(member);
    setEditTitle(member.title);
    setEditPermissions(member.permissions ?? []);
    setShowEditModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-3 border-[#0D1B8C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { usedCount, userLimit, canInvite, members = [], planLabel } = teamData || {
    usedCount: 1,
    userLimit: null,
    canInvite: true,
    members: [],
    planLabel: "Plano Padrão",
  };

  const hasTeamSupport = typeof userLimit === "number" && userLimit > 1;
  const isUnlimited = userLimit != null && userLimit >= 999;
  const progressPercent = !hasTeamSupport
    ? 100
    : isUnlimited
    ? 100
    : Math.min(100, Math.round((usedCount / userLimit) * 100));

  const handleOpenInviteModal = () => {
    if (!hasTeamSupport || !canInvite) {
      toast({
        title: "Upgrade de Plano Necessário",
        description: `Seu plano atual (${planLabel}) não inclui vagas para equipe. Redirecionando para os planos...`,
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation("/financeiro");
      }, 500);
      return;
    }
    setShowInviteModal(true);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header com Boas-Vindas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EEF2FF] text-[#0D1B8C] text-xs font-bold mb-2">
            <Users className="w-3.5 h-3.5" />
            Gestão Multi-Usuários
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#07113A] tracking-tight">
            Equipe e Acessos
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Cadastre os membros da sua equipe, defina as permissões individuais e compartilhe a carteira de clientes.
          </p>
        </div>

        <button
          onClick={handleOpenInviteModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#0D1B8C] hover:bg-[#0B1770] text-white font-bold text-sm transition-all shadow-lg shadow-[#0D1B8C]/20"
        >
          <UserPlus className="w-4 h-4" />
          Convidar Membro
        </button>
      </div>

      {/* Card de Status da Cota da Equipe */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-gradient-to-br from-[#07113A] to-[#0D1B8C] text-white p-6 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Cota do Plano {planLabel}
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-white/10 backdrop-blur-md font-semibold border border-white/10">
                {!hasTeamSupport ? "Plano Individual" : isUnlimited ? "Usuários Ilimitados" : `${usedCount} de ${userLimit} vagas ocupadas`}
              </span>
            </div>

            <h3 className="text-xl font-bold mb-2">
              {!hasTeamSupport
                ? "Seu plano atual não inclui vagas de equipe"
                : isUnlimited
                ? "Sua equipe não possui limite de usuários"
                : `Uso da Equipe: ${usedCount} / ${userLimit}`}
            </h3>
            <p className="text-xs text-white/70 max-w-lg mb-6">
              Como assinante proprietário, todos os leads cadastrados pelos seus corretores e assistentes ficam centralizados no seu painel.
            </p>
          </div>

          {hasTeamSupport && !isUnlimited && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium text-white/80">
                <span>Capacidade utilizada</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    progressPercent >= 100 ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Banner de Upgrade se Cota Atingida ou Sem Suporte a Equipe */}
        {(!canInvite || !hasTeamSupport) ? (
          <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-3xl flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 mb-3">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-amber-900 text-base mb-1">
                {!hasTeamSupport ? "Plano sem Equipe" : "Limite Atingido"}
              </h4>
              <p className="text-xs text-amber-700 leading-relaxed">
                {!hasTeamSupport
                  ? `Seu plano atual (${planLabel}) é para uso individual. Faça upgrade para adicionar corretores e assistentes.`
                  : `Sua equipe atingiu a capacidade máxima permitida pelo plano ${planLabel}.`}
              </p>
            </div>
            <Link href="/financeiro">
              <span className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all shadow-md cursor-pointer">
                Fazer Upgrade de Plano
              </span>
            </Link>
          </div>
        ) : (
          <div className="bg-emerald-50 border-2 border-emerald-100 p-6 rounded-3xl flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-3">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-emerald-950 text-base mb-1">Cota Disponível</h4>
              <p className="text-xs text-emerald-700 leading-relaxed">
                Você pode adicionar novos corretores para colaborar e acelerar o atendimento de leads.
              </p>
            </div>
            <button
              onClick={handleOpenInviteModal}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-md"
            >
              Novo Membro
            </button>
          </div>
        )}
      </div>

      {/* Tabela de Membros da Equipe */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-[#07113A] text-lg flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#0D1B8C]" />
            Membros Cadastrados ({members.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="py-4 px-6">Membro</th>
                <th className="py-4 px-6">Cargo / Função</th>
                <th className="py-4 px-6">Permissões de Acesso</th>
                <th className="py-4 px-6">Tipo</th>
                <th className="py-4 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm ${
                        member.isOwner ? "bg-[#0D1B8C] text-white" : "bg-purple-100 text-purple-700"
                      }`}>
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-[#07113A]">{member.name}</div>
                        <div className="text-xs text-gray-400">{member.email}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-6 font-medium text-gray-700">
                    {member.title}
                  </td>

                  <td className="py-4 px-6">
                    <div className="flex flex-wrap gap-1.5">
                      {member.isOwner ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                          Acesso Total Proprietário
                        </span>
                      ) : (
                        (member.permissions ?? []).map((permId) => {
                          const pObj = AVAILABLE_PERMISSIONS.find((p) => p.id === permId);
                          return (
                            <span key={permId} className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {pObj?.label ?? permId}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </td>

                  <td className="py-4 px-6">
                    {member.isOwner ? (
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#EEF2FF] text-[#0D1B8C]">
                        Assinante / Owner
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                        Equipe
                      </span>
                    )}
                  </td>

                  <td className="py-4 px-6 text-right">
                    {!member.isOwner && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(member)}
                          className="px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-xs font-semibold text-gray-700 transition-all"
                        >
                          Permissões
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remover ${member.name} da equipe?`)) {
                              deleteMutation.mutate(member.id);
                            }
                          }}
                          className="p-1.5 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all"
                          title="Remover Membro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Convidar Membro */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-[#07113A]">Cadastrar Novo Membro</h3>
                <p className="text-xs text-gray-500 mt-0.5">Preencha as credenciais do seu colaborador</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nome Completo *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="ex: João Silva"
                    className="w-full pl-10 pr-3.5 h-10 rounded-xl border border-input text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">E-mail de Acesso *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="joao@corretora.com"
                      className="w-full pl-10 pr-3.5 h-10 rounded-xl border border-input text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Senha Inicial *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Mínimo 6 digitos"
                      className="w-full pl-10 pr-3.5 h-10 rounded-xl border border-input text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Cargo / Função</label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="ex: Corretor Sênior ou Operador CCA"
                    className="w-full pl-10 pr-3.5 h-10 rounded-xl border border-input text-sm"
                  />
                </div>
              </div>

              {/* Seleção de Permissões */}
              <div>
                <label className="text-xs font-bold text-[#07113A] uppercase tracking-wider block mb-2">
                  Permissões de Acesso do Usuário
                </label>
                <div className="space-y-2 border border-gray-100 rounded-2xl p-3 bg-gray-50/50">
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const checked = form.permissions.includes(perm.id);
                    return (
                      <label key={perm.id} className="flex items-start gap-3 p-2 rounded-xl hover:bg-white transition-all cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFormPermission(perm.id)}
                          className="mt-0.5 rounded border-gray-300 text-[#0D1B8C]"
                        />
                        <div>
                          <div className="text-xs font-bold text-[#07113A]">{perm.label}</div>
                          <div className="text-[11px] text-gray-500">{perm.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button onClick={() => setShowInviteModal(false)} className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200">
                Cancelar
              </button>
              <button
                onClick={() => inviteMutation.mutate(form)}
                disabled={inviteMutation.isPending || !form.name || !form.email || !form.password}
                className="px-5 py-2 text-xs font-bold rounded-xl text-white bg-[#0D1B8C] hover:bg-[#0B1770] disabled:opacity-50 shadow-md"
              >
                {inviteMutation.isPending ? "Cadastrando..." : "Cadastrar Membro"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Permissões */}
      {showEditModal && editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#07113A]">Editar Permissões</h3>
                <p className="text-xs text-gray-500">{editingMember.name}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Cargo / Função</label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3.5 h-10 rounded-xl border border-input text-sm mb-4"
              />

              <label className="text-xs font-bold text-[#07113A] uppercase tracking-wider block mb-2">
                Permissões Ativas
              </label>
              <div className="space-y-2 border border-gray-100 rounded-2xl p-3 bg-gray-50/50">
                {AVAILABLE_PERMISSIONS.map((perm) => {
                  const checked = editPermissions.includes(perm.id);
                  return (
                    <label key={perm.id} className="flex items-start gap-3 p-2 rounded-xl hover:bg-white transition-all cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEditPermission(perm.id)}
                        className="mt-0.5 rounded border-gray-300 text-[#0D1B8C]"
                      />
                      <div>
                        <div className="text-xs font-bold text-[#07113A]">{perm.label}</div>
                        <div className="text-[11px] text-gray-500">{perm.desc}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200">
                Cancelar
              </button>
              <button
                onClick={() =>
                  updatePermsMutation.mutate({
                    id: editingMember.id,
                    title: editTitle,
                    permissions: editPermissions,
                  })
                }
                disabled={updatePermsMutation.isPending}
                className="px-5 py-2 text-xs font-bold rounded-xl text-white bg-[#0D1B8C] hover:bg-[#0B1770] disabled:opacity-50"
              >
                {updatePermsMutation.isPending ? "Salvando..." : "Salvar Permissões"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Equipe;
