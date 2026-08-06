import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { listTrash } from "@/lib/trash";
import { TrashScreen } from "./TrashScreen";

export const metadata: Metadata = { title: "Trash" };

export default async function TrashPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const rows = await listTrash(user.id);
  return <TrashScreen rows={rows} />;
}
