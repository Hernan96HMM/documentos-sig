import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { obtenerSnapshot } from "@/lib/queries";
import { ListadoMaestro } from "@/components/ListadoMaestro";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // El primer render sale del servidor con los datos ya puestos; a partir de
  // ahí la pantalla se mantiene al día sola por SSE.
  const inicial = await obtenerSnapshot();

  return (
    <ListadoMaestro
      inicial={inicial}
      usuario={{ nombre: session.user.nombre, rol: session.user.rol }}
    />
  );
}
