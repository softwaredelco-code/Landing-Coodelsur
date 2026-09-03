import { siteConfig } from "@/shared/config/site";
import { formatCOP } from "@/shared/utils";
import { getEmailTransport, sendOutboundEmail } from "@/infrastructure/email/send";

const ESTADO_LABELS: Record<string, string> = {
  recibido: "Recibida — en revisión",
  revisado: "Revisada",
  contactado: "Contactado por un asesor",
  descartado: "No procede",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;color:#64748b;font-size:14px;width:42%;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
  </tr>`;
}

function getString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (value == null || value === "") return "—";
  return String(value);
}

export interface LeadConfirmationEmailInput {
  to: string;
  leadId: string;
  nombre: string;
  tipoCredito: string;
  estado?: string;
  datosFormulario: Record<string, unknown>;
}

export function buildLeadConfirmationEmail(input: LeadConfirmationEmailInput) {
  const data = input.datosFormulario;
  const estado = input.estado ?? "recibido";
  const estadoLabel = ESTADO_LABELS[estado] ?? estado;
  const capital = Number(data.capitalSeleccionado ?? 0);
  const valorCuota = Number(data.valorCuota ?? 0);

  const subject = `Coodelsur — Solicitud recibida (#${input.leadId.slice(0, 8)})`;

  const html = `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">
        <p style="margin:0 0 8px;color:#0d9488;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Coodelsur</p>
        <h1 style="margin:0 0 12px;color:#0f172a;font-size:24px;">Tu solicitud fue recibida</h1>
        <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
          Hola ${escapeHtml(input.nombre)}, recibimos tu solicitud de crédito. Un asesor de Coodelsur la revisará y se comunicará contigo pronto.
        </p>
        <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="margin:0 0 6px;color:#0f766e;font-size:12px;font-weight:700;text-transform:uppercase;">Estado actual</p>
          <p style="margin:0;color:#134e4a;font-size:16px;font-weight:700;">${escapeHtml(estadoLabel)}</p>
          <p style="margin:8px 0 0;color:#475569;font-size:13px;">Número de solicitud: <strong>${escapeHtml(input.leadId)}</strong></p>
        </div>
        <h2 style="margin:0 0 12px;color:#0f172a;font-size:18px;">Resumen de tu solicitud</h2>
        <table style="width:100%;border-collapse:collapse;">
          ${row("Producto", input.tipoCredito.replace(/_/g, " "))}
          ${row("Nombre", input.nombre)}
          ${row("E-mail", input.to)}
          ${row("Identificación", `${getString(data, "tipoIdentificacion")} ${getString(data, "cedula")}`)}
          ${row("Celular", getString(data, "telefono"))}
          ${row("Capital solicitado", capital > 0 ? formatCOP(capital) : "—")}
          ${row("Cuotas", getString(data, "cantidadCuotas"))}
          ${row("Valor cuota", valorCuota > 0 ? formatCOP(valorCuota) : "—")}
          ${row("Destino del crédito", getString(data, "destinoCredito"))}
          ${row("Departamento", getString(data, "departamento"))}
          ${row("Municipio", getString(data, "municipio"))}
          ${row("Sector", getString(data, "sectorDomicilio"))}
          ${row("Dirección", getString(data, "direccion"))}
          ${row("Barrio", getString(data, "barrio"))}
        </table>
        <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
          Si necesitas actualizar algún dato, responde a este correo o escríbenos a
          <a href="mailto:${siteConfig.contact.email}" style="color:#0d9488;">${siteConfig.contact.email}</a>.
        </p>
      </div>
      <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;text-align:center;">
        © ${new Date().getFullYear()} Coodelsur SAS · Este correo confirma el recibo de tu solicitud.
      </p>
    </div>
  </body>
</html>`;

  const text = [
    `Hola ${input.nombre},`,
    "",
    "Recibimos tu solicitud de crédito en Coodelsur.",
    `Estado: ${estadoLabel}`,
    `Número de solicitud: ${input.leadId}`,
    "",
    "Resumen:",
    `- Capital: ${capital > 0 ? formatCOP(capital) : "—"}`,
    `- Cuotas: ${getString(data, "cantidadCuotas")}`,
    `- Valor cuota: ${valorCuota > 0 ? formatCOP(valorCuota) : "—"}`,
    "",
    `Contacto: ${siteConfig.contact.email}`,
  ].join("\n");

  return { subject, html, text };
}

export async function sendLeadConfirmationEmail(
  input: LeadConfirmationEmailInput,
): Promise<{ sent: boolean; transport?: string; reason?: string }> {
  const { subject, html, text } = buildLeadConfirmationEmail(input);
  const result = await sendOutboundEmail({
    to: input.to,
    subject,
    html,
    text,
  });

  return {
    sent: result.sent,
    transport: result.transport,
    reason: result.reason,
  };
}

export { getEmailTransport };
