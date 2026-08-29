import { NextResponse } from "next/server";

import {
getCurrentGrandPrixData,
} from "@/services/currentGrandPrixService";

export async function GET() {
try {
const grandPrix = await getCurrentGrandPrixData();

if (!grandPrix) {
  return NextResponse.json(
    {
      error: "No se encontró ningún Gran Premio actual",
    },
    {
      status: 404,
    }
  );
}

return NextResponse.json({
  data: grandPrix,
});

} catch (error) {
console.error(
"Error obteniendo el Gran Premio:",
error
);

return NextResponse.json(
  {
    error:
      "No se pudo obtener la información del Gran Premio",
  },
  {
    status: 500,
  }
);

}
}
