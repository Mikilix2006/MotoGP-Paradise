import Link from "next/link";

import PaginaLegal from "@/components/PaginaLegal";
import { exigirRegistroAbierto } from "@/components/cuenta/PaginaCuenta";
import { Correo, ENLACE_LEGAL, titular } from "@/components/legal";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata = { title: `Condiciones de uso | ${SITE_NAME}` };

export default function CondicionesPage() {
  exigirRegistroAbierto();
  const responsable = titular();

  return (
    <PaginaLegal titulo="Condiciones de uso" actualizacion="8 de noviembre de 2026">
      <section id="objeto">
        <h2>Qué es esto</h2>
        <p>
          {SITE_NAME} es un proyecto personal, gratuito y sin ánimo de lucro de {responsable}. Estas condiciones regulan el uso de la cuenta de usuario. Consultar resultados y gráficas no necesita cuenta.
        </p>
      </section>

      <section id="cuenta">
        <h2>Tu cuenta</h2>
        <ul>
          <li>Tienes que tener 14 años o más.</li>
          <li>Los datos que des (correo y alias) deben ser tuyos y verdaderos. Una persona, una cuenta.</li>
          <li>
            Eres responsable de mantener en secreto tu contraseña. Si sospechas que alguien accede a tu cuenta, cámbiala y avisa en <Correo />.
          </li>
          <li>Puedes eliminar la cuenta cuando quieras desde Perfil, pestaña Seguridad.</li>
        </ul>
      </section>

      <section id="uso">
        <h2>Uso aceptable</h2>
        <p>
          No está permitido usar un alias ofensivo, que suplante a otra persona o que incluya datos personales de terceros. Tampoco intentar acceder a cuentas ajenas, automatizar registros ni sobrecargar el servicio. El titular puede cambiar un alias inadecuado y suspender o eliminar las cuentas que incumplan estas normas.
        </p>
      </section>

      <section id="servicio">
        <h2>Disponibilidad y responsabilidad</h2>
        <p>
          El servicio se ofrece tal cual, sin garantías de disponibilidad: puede cambiar, interrumpirse o terminar. Los datos deportivos proceden de información pública de motogp.com y pueden contener errores. El titular no responde de los daños derivados del uso del servicio, salvo lo que la ley no permita excluir.
        </p>
      </section>

      <section id="datos">
        <h2>Tus datos</h2>
        <p>
          Cómo se tratan tus datos personales se explica en la{" "}
          <Link href="/privacidad" className={ENLACE_LEGAL}>
            política de privacidad
          </Link>
          .
        </p>
      </section>

      <section id="cambios">
        <h2>Cambios y ley aplicable</h2>
        <p>Si estas condiciones cambian de forma relevante, se avisará en la web. Se rigen por la ley española.</p>
      </section>
    </PaginaLegal>
  );
}
