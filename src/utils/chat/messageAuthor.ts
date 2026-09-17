import type { Message } from '@/types/chat/api';

/**
 * Uma mensagem enviada pelo celular chega ao CRM sem identidade nenhuma, então o backend
 * a grava sem autor e apenas marca a origem. Sem essa checagem a bolha cairia no rótulo
 * genérico de atendente e esconderia de onde a resposta saiu.
 */
export const isSentFromDevice = (message: Pick<Message, 'content_attributes'>): boolean =>
  message.content_attributes?.sent_from_device === true;
