/** Google login is required unless explicitly disabled for local development. */
export const autenticacaoObrigatoria = () => process.env.AUTH_REQUIRED?.trim().toLowerCase() !== "false";
export const USUARIO_PUBLICO = "acesso-livre";
export const DURACAO_SESSAO = 90 * 24 * 60 * 60;
