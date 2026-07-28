import { toast } from 'react-hot-toast';

export interface SocketErrorPayload {
  mensagem: string;
  codigoDiagnostico?: string;
}

export function showSocketError({
  mensagem,
  codigoDiagnostico,
}: SocketErrorPayload) {
  const description = codigoDiagnostico
    ? `${mensagem}\nCódigo: ${codigoDiagnostico}`
    : mensagem;

  toast.error(description, {
    duration: codigoDiagnostico ? 7000 : 4000,
  });
}
