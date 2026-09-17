import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

import ReplyPreview from './ReplyPreview';
import { Message, MESSAGE_TYPE } from '@/types/chat/api';

const DEVICE_LABEL = 'messages.messageBubble.device.fallback';
const USER_LABEL = 'messages.replyPreview.userFallback';

const makeMessage = (overrides: Partial<Message> = {}): Message =>
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
  }) as Message;

describe('ReplyPreview author label', () => {
  it('names the device when the quoted message came from the phone', () => {
    render(<ReplyPreview message={makeMessage({ content_attributes: { sent_from_device: true } })} isOwn={true} />);

    expect(screen.getByText(DEVICE_LABEL)).toBeTruthy();
    expect(screen.queryByText(USER_LABEL)).toBeNull();
  });

  it('still names the agent who replied from the CRM', () => {
    render(<ReplyPreview message={makeMessage({ sender: { id: 'u-1', name: 'Ana', type: 'user' } })} isOwn={true} />);

    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.queryByText(DEVICE_LABEL)).toBeNull();
  });
});
