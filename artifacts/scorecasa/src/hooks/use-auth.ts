import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

export function useRequireAuth() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
      staleTime: 60_000,
    },
  });

  useEffect(() => {
    if (!isLoading && isError) {
      setLocation("/login");
    }
  }, [isLoading, isError, setLocation]);

  return { user, isLoading, isAuthenticated: !!user && !isError };
}

export function useRequireBrokerAuth() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
      staleTime: 60_000,
    },
  });

  useEffect(() => {
    if (!isLoading) {
      if (isError || !user) {
        setLocation("/login");
      } else if (user.role === "client") {
        setLocation("/portal");
      }
    }
  }, [isLoading, isError, user, setLocation]);

  const isBroker = !!user && !isError && user.role !== "client";
  return { user, isLoading, isAuthenticated: isBroker };
}

export function useRedirectIfAuthenticated() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
      staleTime: 60_000,
    },
  });

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === "client") {
        setLocation("/portal");
      } else {
        setLocation("/dashboard");
      }
    }
  }, [isLoading, user, setLocation]);

  return { isLoading };
}
