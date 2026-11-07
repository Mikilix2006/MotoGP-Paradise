// textos-raros: biografías de la API con codificación doble, entidades y etiquetas.
export const textosRaros = {
  // "España" y "Márquez" en UTF-8 leídos como Latin-1.
  dobleCodificacion: "Nacido en EspaÃ±a, MÃ¡rquez gana.",
  // Mezcla de Latin-1 válido con un carácter fuera de Latin-1: no se debe reconvertir.
  mezclaNoLatin1: "Ã± y €",
  entidades: "Tom &amp; Jerry &quot;campeones&quot; &#241; &#xF1; &lt;b&gt; &nbsp;fin",
  dobleEntidad: "&amp;lt;",
  conScript: "Hola<script>alert('x')</script> mundo<style>p{color:red}</style>!",
  parrafos: "<p>Uno</p><p>Dos</p>",
  saltos: "Línea 1<br>Línea 2<br />Línea 3",
  bloques: "<h2>Título</h2><div>Texto</div><ul><li>a</li><li>b</li></ul>",
  soloEtiquetas: "<p> </p><br>",
} as const;
