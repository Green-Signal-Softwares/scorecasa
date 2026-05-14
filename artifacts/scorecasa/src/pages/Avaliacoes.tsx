import { useState } from "react";
import {
  useGetMe,
  useGetMyRatings,
  useCreateRating,
} from "@workspace/api-client-react";
import { getGetMyRatingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, Award, MessageSquare, TrendingUp, X, Plus } from "lucide-react";

function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Componente de estrelas ────────────────────────────────────────────────────
function StarDisplay({ value, size = "md" }: { value: number; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-3.5 h-3.5", md: "w-5 h-5", lg: "w-7 h-7" };
  const cls = sizes[size];
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cls}
          style={{ color: n <= value ? "#F59E0B" : "#E5E7EB", fill: n <= value ? "#F59E0B" : "none" }}
        />
      ))}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className="w-8 h-8"
            style={{
              color: n <= (hover || value) ? "#F59E0B" : "#E5E7EB",
              fill: n <= (hover || value) ? "#F59E0B" : "none",
            }}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-sm font-semibold text-amber-500">
          {["", "Ruim", "Regular", "Bom", "Ótimo", "Excelente"][value]}
        </span>
      )}
    </div>
  );
}

// ── Card de avaliação ─────────────────────────────────────────────────────────
function RatingCard({ rating }: { rating: any }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold text-[#07113A] text-sm">{rating.fromUserName}</div>
          {rating.propertyTitle && (
            <div className="text-xs text-gray-400 mt-0.5">{rating.propertyTitle}</div>
          )}
        </div>
        <div className="text-xs text-gray-400">{formatDate(rating.createdAt)}</div>
      </div>
      <StarDisplay value={rating.stars} size="md" />
      {rating.comment && (
        <div className="mt-3 flex items-start gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gray-600 leading-relaxed italic">"{rating.comment}"</p>
        </div>
      )}
    </div>
  );
}

// ── Modal para dar avaliação ─────────────────────────────────────────────────
function GiveRatingModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (data: any) => void }) {
  const [form, setForm] = useState({
    toUserId: "", toUserName: "", toUserRole: "broker" as "broker" | "correspondent",
    stars: 0, comment: "", propertyTitle: "",
  });

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.toUserId || !form.toUserName || form.stars === 0) return;
    onSave({
      toUserId: Number(form.toUserId),
      toUserName: form.toUserName,
      toUserRole: form.toUserRole,
      stars: form.stars,
      comment: form.comment || undefined,
      propertyTitle: form.propertyTitle || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="font-bold text-lg text-[#07113A]">Avaliar profissional</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">ID do profissional *</label>
              <Input
                type="number"
                value={form.toUserId}
                onChange={(e) => setForm({ ...form, toUserId: e.target.value })}
                placeholder="Ex.: 5"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Tipo *</label>
              <select
                value={form.toUserRole}
                onChange={(e) => setForm({ ...form, toUserRole: e.target.value as any })}
                className="w-full h-10 px-3 rounded-lg border border-input text-sm bg-white"
              >
                <option value="broker">Corretor</option>
                <option value="correspondent">Correspondente</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Nome do profissional *</label>
            <Input
              value={form.toUserName}
              onChange={(e) => setForm({ ...form, toUserName: e.target.value })}
              placeholder="Nome completo"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Imóvel (opcional)</label>
            <Input
              value={form.propertyTitle}
              onChange={(e) => setForm({ ...form, propertyTitle: e.target.value })}
              placeholder="Ex.: Apt 3q Jardins"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-2 block">Avaliação *</label>
            <StarPicker value={form.stars} onChange={(v) => setForm({ ...form, stars: v })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Comentário (opcional)</label>
            <textarea
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              placeholder="Conte como foi sua experiência..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-input text-sm resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button
              type="submit"
              className="flex-1 text-white"
              style={{ background: "#F59E0B" }}
              disabled={form.stars === 0}
            >
              Enviar avaliação
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── View principal (corretor / correspondente) ────────────────────────────────
function MyRatingsView() {
  const { data: ratingSummary, isLoading } = useGetMyRatings({});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createRating = useCreateRating();
  const [modalOpen, setModalOpen] = useState(false);

  const summary = ratingSummary as any;
  const ratings = summary?.ratings ?? [];
  const average = summary?.average ?? 0;
  const total = summary?.total ?? 0;

  function handleCreate(data: any) {
    createRating.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyRatingsQueryKey() });
        toast({ title: "Avaliação enviada!" });
        setModalOpen(false);
      },
    });
  }

  // Distribuição de estrelas
  const starDist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of ratings) starDist[r.stars] = (starDist[r.stars] ?? 0) + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>Minhas Avaliações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Avaliações recebidas dos seus clientes</p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          variant="outline"
          className="flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Avaliar profissional
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Score principal */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center text-center">
          <div className="text-6xl font-bold mb-1" style={{ color: "#F59E0B" }}>
            {average > 0 ? average.toFixed(1) : "—"}
          </div>
          {average > 0 && <StarDisplay value={Math.round(average)} size="lg" />}
          <div className="text-xs text-gray-400 mt-2">{total} avaliações recebidas</div>
          {average >= 4.5 && (
            <div className="mt-3 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{ background: "#10A65A" }}>
              <Award className="w-3.5 h-3.5" /> Top Avaliado
            </div>
          )}
        </div>

        {/* Distribuição */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Distribuição</div>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((n) => {
              const count = starDist[n] ?? 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={n} className="flex items-center gap-2">
                  <div className="flex items-center gap-1 w-10 flex-shrink-0">
                    <span className="text-xs font-semibold text-gray-600">{n}</span>
                    <Star className="w-3 h-3 text-amber-400" style={{ fill: "#F59E0B" }} />
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-5 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Estatísticas */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col justify-between">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Destaques</div>
          <div className="space-y-3">
            {[
              { label: "Avaliações 5 estrelas", value: String(starDist[5] ?? 0), icon: Star, color: "#F59E0B" },
              { label: "Nota média",            value: average > 0 ? average.toFixed(1) : "—", icon: TrendingUp, color: "#10A65A" },
              { label: "Total de avaliações",   value: String(total), icon: MessageSquare, color: "#0D1B8C" },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50">
                    <Icon className="w-4 h-4" style={{ color: stat.color }} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">{stat.label}</div>
                    <div className="font-bold text-[#07113A]">{stat.value}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lista de avaliações */}
      <div>
        <div className="text-sm font-semibold text-[#07113A] mb-3">Avaliações dos clientes</div>
        {isLoading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#0D1B8C] border-t-transparent rounded-full animate-spin" /></div>
        ) : ratings.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Star className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <div className="font-semibold text-gray-400">Nenhuma avaliação ainda</div>
            <div className="text-xs text-gray-300 mt-1">Após concluir uma operação, peça ao cliente para te avaliar</div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ratings.map((r: any) => <RatingCard key={r.id} rating={r} />)}
          </div>
        )}
      </div>

      <GiveRatingModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleCreate} />
    </div>
  );
}

// ── View cliente — dar avaliação ──────────────────────────────────────────────
function ClientRatingView() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createRating = useCreateRating();
  const [modalOpen, setModalOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleCreate(data: any) {
    createRating.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({});
        toast({ title: "Avaliação enviada! Obrigado pelo feedback." });
        setModalOpen(false);
        setSubmitted(true);
      },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>Avaliações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Avalie seu corretor ou correspondente ao final do processo</p>
      </div>

      {submitted ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-[#F0FDF4]">
            <Award className="w-8 h-8 text-[#10A65A]" />
          </div>
          <div className="font-bold text-xl text-[#07113A] mb-2">Avaliação enviada!</div>
          <div className="text-sm text-gray-400">Obrigado pelo feedback. Ele ajuda outros clientes e os profissionais a melhorarem.</div>
          <Button onClick={() => setSubmitted(false)} variant="outline" className="mt-5">Avaliar outro profissional</Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <Star className="w-16 h-16 text-amber-300 mx-auto mb-4" style={{ fill: "#FCD34D" }} />
          <div className="font-bold text-xl text-[#07113A] mb-2">Avalie seu profissional</div>
          <div className="text-sm text-gray-400 max-w-sm mx-auto mb-6">
            Sua avaliação é como no Uber — ajuda outros clientes a escolher os melhores profissionais da plataforma.
          </div>
          <Button
            onClick={() => setModalOpen(true)}
            className="text-white"
            style={{ background: "#F59E0B" }}
          >
            Dar avaliação com estrelas
          </Button>
        </div>
      )}

      <GiveRatingModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleCreate} />
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export function Avaliacoes() {
  const { data: me } = useGetMe({});
  const role = (me as any)?.role ?? "client";

  if (role === "client") return <ClientRatingView />;
  return <MyRatingsView />;
}
