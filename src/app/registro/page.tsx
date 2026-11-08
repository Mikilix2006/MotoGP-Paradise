import { redirect } from "next/navigation";

import FormRegistro from "@/components/cuenta/FormRegistro";
import PaginaCuenta, { exigirRegistroAbierto } from "@/components/cuenta/PaginaCuenta";
import { SITE_NAME } from "@/lib/site";
import { getSesion } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: `Crear cuenta | ${SITE_NAME}`, robots: { index: false } };

export default async function RegistroPage() {
  exigirRegistroAbierto();
  if (await getSesion()) redirect("/perfil");

  return (
    <PaginaCuenta titulo="Registro">
      <FormRegistro />
    </PaginaCuenta>
  );
}
