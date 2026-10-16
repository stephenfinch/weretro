import { requireUser } from "@/server/auth";
import { NOTIFICATION_EVENTS } from "@/server/notifications";
import { NotificationsForm } from "@/components/profile/profile-form";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser("/profile/notifications");
  return <NotificationsForm items={NOTIFICATION_EVENTS} values={user.notificationPreferences} />;
}
