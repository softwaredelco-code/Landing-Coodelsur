/**
 * Eliminación completa de un lead: fila en BD (o JSON local) + objetos en Storage.
 *
 * @see DELETE /api/admin/leads/[id] — endpoint HTTP protegido por cookie admin
 */
import { extractStoragePathsFromDatos } from "@/domain/lead/attachments";
import { deleteLeadFromFile, getLeadFromFile, isDbConnectionError } from "@/infrastructure/persistence/file-store";
import { prisma } from "@/infrastructure/database/prisma";
import { deleteStorageObjects } from "@/infrastructure/storage/upload";

export interface DeleteLeadResult {
  deleted: boolean;
  storage: "database" | "file";
  attachmentsRemoved: number;
}

/** Elimina el lead y sus adjuntos. Retorna `null` si el id no existe. */
export async function deleteLead(leadId: string): Promise<DeleteLeadResult | null> {
  let datosFormulario: unknown = null;
  let storage: "database" | "file" = "database";

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, datosFormulario: true },
    });

    if (!lead) {
      const fileLead = getLeadFromFile(leadId);
      if (!fileLead) return null;
      datosFormulario = fileLead.datosFormulario;
      storage = "file";
      deleteLeadFromFile(leadId);
    } else {
      datosFormulario = lead.datosFormulario;
      await prisma.lead.delete({ where: { id: leadId } });
    }
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;

    const fileLead = getLeadFromFile(leadId);
    if (!fileLead) return null;

    datosFormulario = fileLead.datosFormulario;
    storage = "file";
    deleteLeadFromFile(leadId);
  }

  const paths = extractStoragePathsFromDatos(datosFormulario);
  const attachmentsRemoved = await deleteStorageObjects(paths);

  return { deleted: true, storage, attachmentsRemoved };
}
