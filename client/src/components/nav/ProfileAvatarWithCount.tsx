// src/components/nav/ProfileAvatarWithCount.tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";

export default function ProfileAvatarWithCount() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}` || "U";

  return (
    <div className="relative" data-testid="profile-avatar-with-count">
      <Avatar className="h-9 w-9">
        <AvatarImage src={user?.profileImageUrl ?? ""} alt={user?.firstName ?? "User"} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      {unreadCount > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] leading-[18px] text-center font-semibold shadow"
          data-testid="badge-unread-count"
          aria-label={`${unreadCount} unread notifications`}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </div>
  );
}
