<#
 Genera un volcado SOLO DE DATOS (COPY), filtrado para PostgreSQL 12 y comprimido.
 Uso (PowerShell):
   $env:PGHOST='localhost'; $env:PGPORT='5432'; $env:PGUSER='postgres'; $env:PGDATABASE='motogp_stats'
   $env:PGPASSWORD='...'            # solo en la sesion, nunca en el script
   .\scripts\deploy\volcar-datos.ps1 -Salida C:\ruta\motogp-datos.sql.gz
 Opcional: $env:PG_BIN con la carpeta bin de PostgreSQL si pg_dump no esta en el PATH.
 Excluye _prisma_migrations (las crea `prisma migrate deploy` en destino).
#>
param([Parameter(Mandatory)][string]$Salida)
$ErrorActionPreference = 'Stop'
$pgdump = if ($env:PG_BIN) { Join-Path $env:PG_BIN 'pg_dump.exe' } else { 'pg_dump' }
$tmp = [IO.Path]::GetTempFileName()
try {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  # --no-owner/--no-privileges: el destino tiene otro usuario. UTF8 explicito.
  & $pgdump --data-only --no-owner --no-privileges --encoding=UTF8 --schema=public `
    --exclude-table=public._prisma_migrations --file=$tmp
  if ($LASTEXITCODE -ne 0) { throw "pg_dump fallo ($LASTEXITCODE)" }
  "pg_dump: {0:n1} s, {1:n1} MB sin filtrar" -f $sw.Elapsed.TotalSeconds, ((Get-Item $tmp).Length/1MB)

  # Filtro de lista blanca (equivalente a filtro-volcado.awk) y compresion gzip, sin BOM.
  Add-Type -TypeDefinition @'
using System; using System.IO; using System.IO.Compression; using System.Text; using System.Text.RegularExpressions;
public static class FiltroVolcado {
  static readonly Regex Copy = new Regex(@"^COPY public\.[^ ]+ \(.*\) FROM stdin;$");
  static readonly Regex Set = new Regex(@"^SET (statement_timeout|lock_timeout|idle_in_transaction_session_timeout|client_encoding|standard_conforming_strings|check_function_bodies|xmloption|client_min_messages|row_security) = ");
  public static int Run(string entrada, string salida) {
    int descartadas = 0; bool enCopy = false;
    var utf8 = new UTF8Encoding(false);
    using (var r = new StreamReader(entrada, utf8))
    using (var fs = File.Create(salida))
    using (var gz = new GZipStream(fs, CompressionLevel.Optimal))
    using (var w = new StreamWriter(gz, utf8, 65536) { NewLine = "\n" }) {
      string l;
      while ((l = r.ReadLine()) != null) {
        if (enCopy) { w.WriteLine(l); if (l == @"\.") enCopy = false; continue; }
        if (Copy.IsMatch(l)) { enCopy = true; w.WriteLine(l); continue; }
        if (l.Length == 0 || l.StartsWith("--") || Set.IsMatch(l) ||
            l == "SELECT pg_catalog.set_config('search_path', '', false);") { w.WriteLine(l); continue; }
        descartadas++; Console.Error.WriteLine("descartada: " + l);
      }
    }
    return descartadas;
  }
}
'@
  $sw.Restart()
  $n = [FiltroVolcado]::Run($tmp, $Salida)
  "filtrado+gzip: {0:n1} s, lineas descartadas: {1}, resultado {2:n1} MB" -f $sw.Elapsed.TotalSeconds, $n, ((Get-Item $Salida).Length/1MB)
  $h = (Get-FileHash $Salida -Algorithm SHA256).Hash.ToLower()
  [IO.File]::WriteAllText("$Salida.sha256", "$h  $(Split-Path $Salida -Leaf)`n")
} finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
