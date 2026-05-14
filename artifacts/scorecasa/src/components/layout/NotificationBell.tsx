import { useState, useRef, useEffect } from "react";
import { Bell, X, CheckCheck } from "lucide-react";
import { useGetNotifications, useMarkAllNotificationsRead, useMarkNotificationRead, getGetNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const STATUS_ICONS: Record<string, string> = {
  approved: "✅",
  rejected: "❌",
  analyzing: "🔍",
  in_progress: "⏳",
  pending: "📋",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  return `${Math.floor(hrs / 24)}d atrás`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryKey = getGetNotificationsQueryKey();

  const { data } = useGetNotifications({
    query: {
      queryKey,
      refetchInterval: 15000,
    },
  });

  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const prevUnreadRef = useRef<number>(0);
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current && prevUnreadRef.current !== 0) {
      const newest = notifications.find((n) => !n.isRead);
      if (newest) {
        const icon = (newest.newStatus && STATUS_ICONS[newest.newStatus]) || (newest.type === "property_interest" ? "🏠" : "🔔");
        toast({ title: `${icon} ${newest.message}` });
      }
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleMarkAll = () => {
    markAll.mutate(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });
  };

  const handleMarkOne = (id: number) => {
    markOne.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        data-testid="button-notifications"
        className="relative p-2 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-all duration-150"
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-white text-[10px] font-bold px-1"
            style={{ background: "#10A65A" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-full top-0 ml-2 w-80 rounded-xl shadow-2xl z-50 overflow-hidden border border-white/10"
          style={{ background: "#0A1650" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-white font-semibold text-sm">Notificações</span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 text-xs text-blue-300 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Lidas
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-blue-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-80">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-blue-300 text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Nenhuma notificação
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-white/5 transition-colors ${
                    !n.isRead ? "bg-white/5" : ""
                  } hover:bg-white/10 cursor-pointer`}
                  onClick={() => !n.isRead && handleMarkOne(n.id)}
                >
                  <span className="text-base flex-shrink-0 mt-0.5">
                    {(n.newStatus && STATUS_ICONS[n.newStatus]) || (n.type === "property_interest" ? "🏠" : "🔔")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium leading-snug">{n.message}</p>
                    <p className="text-blue-400 text-[11px] mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                      style={{ background: "#10A65A" }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
