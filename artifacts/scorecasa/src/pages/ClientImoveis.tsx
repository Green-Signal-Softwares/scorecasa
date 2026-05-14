import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { Imoveis } from "@/pages/Imoveis";

export function ClientImoveis() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading: loadingMe } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });

  useEffect(() => {
    if (!loadingMe && me && me.role !== "client") setLocation("/dashboard");
    if (!loadingMe && !me) setLocation("/login");
  }, [loadingMe, me, setLocation]);

  if (loadingMe || !me || me.role !== "client") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07113A" }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ClientLayout userName={me.name} activePage="imoveis">
      <Imoveis />
    </ClientLayout>
  );
}
