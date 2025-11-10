// src/hooks/useNotifications.ts
import { useQuery } from "@tanstack/react-query";
import { fetchNotifications, ApiNotification } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export function useNotifications() {
  const { user } = useAuth();
  const enabled = !!user?.id;

  const { data = [], isLoading, refetch } = useQuery<ApiNotification[]>({
    queryKey: ["notifications", user?.id],
    enabled,
    queryFn: fetchNotifications,
    refetchInterval: enabled ? 10000 : false, // 10s polling when signed-in
    staleTime: 5000,
  });

  const unreadCount = data.filter((n) => !n.isRead).length;

  return { notifications: data, unreadCount, isLoading, refetch };
}
