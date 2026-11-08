import PaginaLegal from "@/components/PaginaLegal";
import { exigirRegistroAbierto } from "@/components/cuenta/PaginaCuenta";
import { Correo, titular } from "@/components/legal";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata = { title: `Política de privacidad | ${SITE_NAME}` };

export default function PrivacidadPage() {
  exigirRegistroAbierto();
  const responsable = titular();

  return (
    <PaginaLegal titulo="Política de privacidad" actualizacion="8 de noviembre de 2026">
      <section id="responsable">
        <h2>Quién es el responsable</h2>
        <p>
          {responsable}, titular de {SITE_NAME}, un proyecto personal sin ánimo de lucro. Contacto para cualquier asunto de privacidad: <Correo />.
        </p>
      </section>

      <section id="datos">
        <h2>Qué datos tratamos</h2>
        <p>Solo los de tu cuenta, y solo si decides crearla:</p>
        <ul>
          <li>Tu correo electrónico.</li>
          <li>Tu alias (el nombre público que eliges).</li>
          <li>Tu contraseña, guardada únicamente como huella irreversible (hash): nadie, ni el titular, puede leerla.</li>
          <li>El color de la web que elijas, si lo cambias.</li>
          <li>Si activas la verificación en dos pasos, la clave del 2FA y tus códigos de recuperación.</li>
          <li>Las fechas de creación y de última actualización de tu cuenta.</li>
        </ul>
        <p>No pedimos nombre real, teléfono ni fecha de nacimiento, y no usamos analíticas ni publicidad.</p>
      </section>

      <section id="finalidad">
        <h2>Para qué y con qué base legal</h2>
        <ul>
          <li>Crear y mantener tu cuenta, permitirte acceder y personalizar la web: ejecución del servicio que solicitas (art. 6.1.b RGPD).</li>
          <li>Enviarte los correos necesarios del servicio (confirmar tu correo, recuperar la contraseña). No enviamos correos comerciales.</li>
          <li>Proteger las cuentas frente a abusos y accesos no autorizados: interés legítimo (art. 6.1.f RGPD).</li>
        </ul>
        <p>Tu dirección IP solo se usa un momento, en la memoria del servidor, para limitar los intentos de acceso. No se guarda en ninguna base de datos ni en registros.</p>
      </section>

      <section id="conservacion">
        <h2>Cuánto tiempo los conservamos</h2>
        <p>
          Mientras tengas la cuenta. Si la eliminas desde tu perfil, se borra al instante. Las copias de seguridad diarias del servidor se conservan 14 días y después se sobrescriben, así que tus datos desaparecen también de ellas en ese plazo.
        </p>
      </section>

      <section id="destinatarios">
        <h2>Con quién se comparten</h2>
        <p>
          No se venden ni se ceden. Para funcionar intervienen dos proveedores: el alojamiento del servidor (Clouding) y el servicio que envía los correos de la cuenta. Solo reciben lo imprescindible para prestar su servicio. El alias es público únicamente en las funciones donde se muestre (por ejemplo, los futuros rankings de Predicciones).
        </p>
      </section>

      <section id="derechos">
        <h2>Tus derechos</h2>
        <p>
          Puedes acceder a tus datos, rectificarlos, suprimirlos, oponerte a su tratamiento, limitarlo y pedir su portabilidad escribiendo a <Correo />. Eliminar la cuenta lo puedes hacer tú mismo en Perfil, pestaña Seguridad. Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).
        </p>
      </section>

      <section id="edad">
        <h2>Edad mínima</h2>
        <p>Para crear una cuenta tienes que tener 14 años o más (art. 7 de la LOPDGDD). Si descubrimos una cuenta de alguien menor de esa edad, la eliminaremos.</p>
      </section>

      <section id="cookies">
        <h2>Cookies y almacenamiento en tu navegador</h2>
        <p>Solo usamos lo imprescindible, por lo que no hace falta pedirte consentimiento:</p>
        <ul>
          <li>
            <strong>Sesión</strong> (cookie): te mantiene con la sesión iniciada. Dura hasta 30 días y se borra al cerrar sesión.
          </li>
          <li>
            <strong>Color</strong> (cookie <code>acento</code>): recuerda el color que elegiste para pintarlo sin parpadeo. Dura un año y se borra al cerrar sesión.
          </li>
          <li>
            <strong>Tema</strong> (localStorage): recuerda si prefieres el modo claro u oscuro. No se envía a ningún sitio.
          </li>
        </ul>
      </section>

      <section id="seguridad">
        <h2>Seguridad</h2>
        <p>
          Las contraseñas se guardan con hash, la conexión va cifrada (HTTPS) y los accesos tienen límite de intentos. Si ocurriera una brecha de seguridad que afecte a tus datos, se comunicará a la autoridad y a las personas afectadas en el plazo legal de 72 horas.
        </p>
      </section>
    </PaginaLegal>
  );
}
