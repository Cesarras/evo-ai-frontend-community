import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

import MessageBubble from './MessageBubble';
import { Message, MESSAGE_TYPE } from '@/types/chat/api';

const DEVICE_LABEL = 'messages.messageBubble.device.fallback';
const AGENT_LABEL = 'messages.messageBubble.agent.fallback';

const makeOutgoing = (overrides: Partial<Message> = {}): Message =>
  ({
    id: 'msg-1',
    content: 'respondi pelo celular',
    content_attributes: {},
    content_type: 'text',
    conversation_id: 'conv-1',
    created_at: 1_700_000_000,
    external_source_ids: {},
    message_type: MESSAGE_TYPE.OUTGOING,
    private: false,
    sender: null,
    source_id: null,
    status: 'delivered',
    attachments: [],
    ...overrides,
  }) as unknown as Message;

const renderBubble = (message: Message) =>
  render(<MessageBubble message={message} isOwn={true} isFromAgent={true} showTimestamp={true} />);

describe('MessageBubble author label', () => {
  it('says the message came from the phone when the backend marked it', () => {
    renderBubble(makeOutgoing({ content_attributes: { sent_from_device: true } }));

    expect(screen.getByText(DEVICE_LABEL)).toBeTruthy();
  });

  it('does not fall back to the generic agent label for a message from the phone', () => {
    renderBubble(makeOutgoing({ content_attributes: { sent_from_device: true } }));

    expect(screen.queryByText(AGENT_LABEL)).toBeNull();
  });

  it('still names the agent who replied from the CRM', () => {
    renderBubble(makeOutgoing({ sender: { id: 'u-1', name: 'Ana', type: 'user' } } as Partial<Message>));

    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.queryByText(DEVICE_LABEL)).toBeNull();
  });
});
