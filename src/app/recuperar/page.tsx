import FormRecuperar from "@/components/cuenta/FormRecuperar";
import PaginaCuenta, { exigirRegistroAbierto } from "@/components/cuenta/PaginaCuenta";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata = { title: `Recuperar contraseña | ${SITE_NAME}`, robots: { index: false } };

export default async function RecuperarPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  exigirRegistroAbierto();
  const { token, error } = await searchParams;

  return (
    <PaginaCuenta titulo="Recuperar">
      {/* Better Auth redirige aquí con ?error=INVALID_TOKEN si el enlace del correo caducó o ya se usó. */}
      {error && (
        <p role="alert" className="mx-auto mb-4 max-w-md text-sm font-semibold text-red-400">
          El enlace no es válido o ha caducado. Pide uno nuevo.
        </p>
      )}
      <FormRecuperar token={error ? undefined : token} />
    </PaginaCuenta>
  );
}
