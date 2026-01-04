// src/app/publisher/page.tsx
import { redirect } from "next/navigation";

export default function PublisherPage() {
  // 🔑 Redirige automáticamente al panel principal de Publisher
  redirect("/publisher/panel");
  return null;
}
