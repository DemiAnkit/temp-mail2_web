// frontend/src/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

export async function api<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Request failed');
    }

    return res.json();
}

export const mailboxApi = {
    get: () => api<MailboxResponse>('/api/mailbox'),
    create: () => api<MailboxResponse>('/api/mailbox', { method: 'POST' }),
    getMessages: (id: string) => api<MessagesResponse>(`/api/mailbox/${id}/messages`),
};

export const messagesApi = {
    get: (id: string, headers = false) =>
        api<EmailDetail>(`/api/messages/${id}?headers=${headers}`),
    delete: (id: string) =>
        api<{ success: boolean }>(`/api/messages/${id}`, { method: 'DELETE' }),
};

export const testApi = {
    sendEmail: (data: TestEmailData) =>
        api<{ success: boolean }>('/api/test/email', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};

// Types
export interface MailboxResponse {
    id: string;
    email: string;
    local_part: string;
    domain: string;
    created_at: string;
    expires_at: string;
    ttl_seconds: number;
}

export interface EmailSummary {
    id: string;
    from: string;
    from_address: string;
    from_name: string | null;
    subject: string;
    received_at: string;
    is_read: boolean;
    has_attachments: boolean;
}

export interface MessagesResponse {
    messages: EmailSummary[];
    count: number;
}

export interface EmailDetail {
    id: string;
    from: string;
    from_address: string;
    from_name: string | null;
    to: string;
    subject: string;
    text_body: string | null;
    html_body: string | null;
    received_at: string;
    has_attachments: boolean;
    headers?: Record<string, string>;
}

export interface TestEmailData {
    to: string;
    from?: string;
    fromName?: string;
    subject?: string;
    text?: string;
    html?: string;
}