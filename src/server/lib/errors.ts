export type ErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'QUOTA_EXHAUSTED'
  | 'UPSTREAM'
  | 'CONFIG'
  | 'INTERNAL';

const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  QUOTA_EXHAUSTED: 503,
  UPSTREAM: 502,
  CONFIG: 500,
  INTERNAL: 500,
};

/** Mensagens exibidas ao usuário; nunca expõem detalhes internos. */
const PUBLIC_MESSAGE: Record<ErrorCode, string> = {
  VALIDATION: 'Dados inválidos.',
  UNAUTHENTICATED: 'Faça login para continuar.',
  FORBIDDEN: 'Seu acesso não inclui este conteúdo.',
  NOT_FOUND: 'Não encontrado.',
  RATE_LIMITED: 'Muitas requisições. Tente novamente em instantes.',
  QUOTA_EXHAUSTED: 'Serviço temporariamente indisponível.',
  UPSTREAM: 'Falha ao consultar um serviço externo.',
  CONFIG: 'Erro de configuração do servidor.',
  INTERNAL: 'Erro inesperado.',
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;
  /** Indica se vale tentar de novo (rede, 5xx, 429). */
  readonly retryable: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    options: { details?: Record<string, unknown>; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.details = options.details;
    this.retryable = options.retryable ?? false;
  }

  get status(): number {
    return HTTP_STATUS[this.code];
  }

  get publicMessage(): string {
    return PUBLIC_MESSAGE[this.code];
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Converte qualquer erro em resposta HTTP segura (sem stack nem mensagem interna). */
export function toErrorResponse(error: unknown): { status: number; body: { error: { code: ErrorCode; message: string } } } {
  const appError = isAppError(error) ? error : new AppError('INTERNAL', 'Unhandled error', { cause: error });
  return {
    status: appError.status,
    body: { error: { code: appError.code, message: appError.publicMessage } },
  };
}
