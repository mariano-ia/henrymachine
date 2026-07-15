import "server-only";
import { Resend } from "resend";

/**
 * Emails transaccionales en la voz de Henry, vía Resend.
 * PUENTE: RESEND_API_KEY compartida; se manda desde storyhunt.city (dominio
 * verificado en esa cuenta — yacare.io quedó "failed" en la verificación DNS).
 * `EMAIL_FROM` es override: cuando Henry tenga su dominio propio verificado,
 * se cambia esa env var sin tocar código. Sin key, no se manda nada (no rompe la compra).
 */

const FROM = process.env.EMAIL_FROM || "La Nueva York de Henry <henry@storyhunt.city>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://henry-demo-zeta.vercel.app";

let _resend: Resend | null = null;
function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

/**
 * Email de acceso: "tu recorrido te espera". Se manda al comprar (para otro día)
 * o al regalar. El acceso se recupera entrando con ese email en /cuenta.
 */
export async function sendAccessEmail(opts: {
  to: string;
  experienceTitle: string;
  isGift: boolean;
  giftMessage?: string | null;
}): Promise<void> {
  const r = client();
  if (!r) {
    // en producción esto significa que un comprador NO recibe su link de acceso.
    console.warn("[email] RESEND_API_KEY ausente: no se envió el email de acceso", { to: opts.to });
    return;
  }
  try {
    const title = esc(opts.experienceTitle);
    const url = `${SITE}/cuenta`;
    const intro = opts.isGift
      ? `¡Te regalaron un recorrido! <b>${title}</b> es tuyo.`
      : `¡Golazo! Tu recorrido <b>${title}</b> quedó guardado.`;
    const note =
      opts.isGift && opts.giftMessage
        ? `<p style="margin:16px 0;padding:12px 14px;background:#FCFBF9;border-left:3px solid #CC4E2A;font-style:italic;color:#444">"${esc(opts.giftMessage)}"</p>`
        : "";
    const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;color:#1A1A1A">
  <p style="font-size:16px;line-height:1.5">${intro}</p>
  ${note}
  <p style="font-size:15px;line-height:1.6;color:#444">
    Entra cuando quieras con <b>este email</b> y arrancas a caminar Nueva York conmigo,
    parada por parada. Desde cualquier dispositivo.
  </p>
  <p style="margin:24px 0">
    <a href="${url}" style="display:inline-block;background:#CC4E2A;color:#fff;text-decoration:none;
       padding:12px 22px;border-radius:999px;font-weight:600;font-size:15px">Ver mi recorrido</a>
  </p>
  <p style="font-size:14px;color:#888;line-height:1.5">Nos vemos en la esquina, querubín.<br>— Henry</p>
</div>`;
    await r.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.isGift ? `Te regalaron: ${opts.experienceTitle}` : `Tu recorrido: ${opts.experienceTitle}`,
      html,
    });
  } catch (e) {
    // el email nunca rompe la compra, pero SÍ queremos enterarnos: comprador sin acceso.
    console.error("[email] falló el envío del email de acceso", { to: opts.to, error: e });
  }
}

/** Código de login (OTP de 6 dígitos) en la voz de Henry. Devuelve si se envió. */
export async function sendLoginCode(to: string, code: string): Promise<boolean> {
  const r = client();
  if (!r) return false;
  try {
    const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:440px;margin:0 auto;color:#1A1A1A">
  <p style="font-size:16px;line-height:1.5">¡Hola, querubín! Tu código para entrar a tus recorridos:</p>
  <p style="font-size:34px;font-weight:700;letter-spacing:8px;text-align:center;
     background:#FCFBF9;border:1px solid #eee;border-radius:12px;padding:16px 0;margin:18px 0">${esc(code)}</p>
  <p style="font-size:14px;color:#888;line-height:1.5">Vence en 10 minutos. Si no lo pediste, ignóralo.<br>— Henry</p>
</div>`;
    const res = await r.emails.send({
      from: FROM,
      to,
      subject: "Tu código para entrar",
      html,
    });
    if (res.error) console.error("[email] Resend rechazó el código de login", { error: res.error });
    return !res.error;
  } catch (e) {
    console.error("[email] falló el envío del código de login", { error: e });
    return false;
  }
}
