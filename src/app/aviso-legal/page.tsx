import { Header } from "@/components/Header";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata = {
  title: `Aviso legal | ${SITE_NAME}`,
};

export default function AvisoLegalPage() {
  if (!CONTACT_EMAIL && process.env.NODE_ENV === "production") {
    throw new Error("Falta el correo de contacto: rellena CONTACT_EMAIL en src/lib/site.ts antes de compilar para producción.");
  }

  const correo = CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-white underline decoration-red-500 underline-offset-4 hover:text-red-500">{CONTACT_EMAIL}</a>
  ) : (
    "miguel.gonzalezdelgado06@gmail.com"
  );

  return (
    <main className="flex-1">
      <Header />
      <article className="mx-auto max-w-3xl px-5 py-10 md:py-16 [&_h2]:mt-10 [&_h2]:border-t [&_h2]:border-white/10 [&_h2]:pt-6 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-white [&_p]:mt-3 [&_p]:max-w-[65ch] [&_p]:text-base [&_p]:leading-7 [&_p]:text-zinc-400 [&>p:first-of-type]:mt-5 [&>p:first-of-type]:text-sm [&>p:first-of-type]:text-zinc-500">
        <h1 className="page-title text-5xl font-display font-black md:text-7xl">Aviso legal</h1>
        <p>Última actualización: 7 de noviembre de 2026</p>

        <section id="que-es">
          <h2>Qué es {SITE_NAME}</h2>
          <p>{SITE_NAME} es un proyecto personal sin ánimo de lucro, creado con fines formativos y de portfolio. No tiene publicidad, no vende nada y no genera ingresos.</p>
          <p>Contacto: {correo}</p>
        </section>

        <section id="relacion-con-motogp">
          <h2>Relación con MotoGP</h2>
          <p>{SITE_NAME} es un proyecto independiente. No está afiliado, patrocinado ni autorizado por MotoGP Sports Entertainment Group, S.L., Dorna Sports, S.L., la FIM, los equipos ni los pilotos. MotoGP™ y las demás marcas citadas pertenecen a sus titulares y se mencionan solo para identificar la competición.</p>
        </section>

        <section id="datos">
          <h2>Origen y fiabilidad de los datos</h2>
          <p>Los resultados, calendarios y clasificaciones proceden de información publicada en motogp.com. Se ofrecen tal cual, sin garantía, y pueden contener errores o retrasos. Para datos oficiales, consulta motogp.com.</p>
        </section>

        <section id="retirada">
          <h2>Corrección o retirada de contenido</h2>
          <p>Si eres titular de derechos, piloto o persona citada y quieres corregir o retirar algún contenido, escribe a {correo} y lo atenderé en cuanto sea posible.</p>
        </section>

        <section id="privacidad">
          <h2>Privacidad</h2>
          <p>{SITE_NAME} no tiene registro, formularios, analíticas ni publicidad, y no conserva tu dirección IP. La web se aloja en Clouding. Si escribes al correo de contacto, tu dirección y tu mensaje se usarán solo para responderte y se borrarán cuando ya no hagan falta. Puedes ejercer tus derechos en ese mismo correo y reclamar ante la Agencia Española de Protección de Datos.</p>
        </section>

        <section id="almacenamiento">
          <h2>Almacenamiento en tu navegador</h2>
          <p>{SITE_NAME} no usa cookies. Si cambias entre tema claro y oscuro, tu elección se guarda en tu navegador (localStorage) y no se envía a ningún sitio. Puedes borrarla desde los ajustes del navegador.</p>
        </section>

        <section id="creditos">
          <h2>Créditos</h2>
          <p>Banderas: flag-icons, de Panayiotis Lipiridis (licencia MIT).</p>
        </section>
      </article>
    </main>
  );
}
