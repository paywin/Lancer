/** Set AUTH_REQUIRED=true to restore Google login and the email allowlist. */
export const autenticacaoObrigatoria = () => process.env.AUTH_REQUIRED?.trim().toLowerCase() === "true";
export const USUARIO_PUBLICO = "acesso-livre";
