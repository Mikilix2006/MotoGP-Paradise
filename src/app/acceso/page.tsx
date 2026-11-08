import { redirect } from "next/navigation";

import FormAcceso from "@/components/cuenta/FormAcceso";
import PaginaCuenta, { exigirRegistroAbierto } from "@/components/cuenta/PaginaCuenta";
import { SITE_NAME } from "@/lib/site";
import { getSesion } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: `Acceso | ${SITE_NAME}`, robots: { index: false } };

export default async function AccesoPage({ searchParams }: { searchParams: Promise<{ verificado?: string }> }) {
  exigirRegistroAbierto();
  if (await getSesion()) redirect("/perfil");
  const { verificado } = await searchParams;

  return (
    <PaginaCuenta titulo="Acceso">
      <FormAcceso verificado={verificado === "1"} />
    </PaginaCuenta>
  );
}
