import type { Message } from '@/types/chat/api';

/**
 * A message typed on the phone has no author, only this marker. Without the check the bubble
 * falls back to the generic agent label and hides where the reply came from.
 */
export const isSentFromDevice = (message: Pick<Message, 'content_attributes'>): boolean =>
  message.content_attributes?.sent_from_device === true;
