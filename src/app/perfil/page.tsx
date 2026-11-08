import { redirect } from "next/navigation";

import PaginaCuenta, { exigirRegistroAbierto } from "@/components/cuenta/PaginaCuenta";
import PerfilTabs from "@/components/cuenta/PerfilTabs";
import { SITE_NAME } from "@/lib/site";
import { getSesion, usuarioPublico } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: `Perfil | ${SITE_NAME}`, robots: { index: false } };

export default async function PerfilPage() {
  exigirRegistroAbierto();
  const sesion = await getSesion();
  if (!sesion) redirect("/acceso");

  return (
    <PaginaCuenta titulo="Perfil">
      <PerfilTabs usuario={usuarioPublico(sesion.user)} />
    </PaginaCuenta>
  );
}
