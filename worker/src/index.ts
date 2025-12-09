// worker/src/index.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import PostalMime from 'postal-mime';

// Types
interface Env {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_KEY: string;
    EMAIL_DOMAIN: string;
    TTL_MINUTES: string;
    CORS_ORIGIN: string;
}

interface Session {
    id: string;
    created_at: string;
}

interface Mailbox {
    id: string;
    session_id: string;
    local_part: string;
    domain: string;
    created_at: string;
    expires_at: string;
    is_active: boolean;
}

interface Email {
    id: string;
    mailbox_id: string;
    from_address: string;
    from_name: string | null;
    to_address: string;
    subject: string | null;
    text_body: string | null;
    html_body: string | null;
    raw_headers: Record<string, string> | null;
    has_attachments: boolean;
    is_read: boolean;
    received_at: string;
}

// Helpers
// function getSupabase(env: Env): SupabaseClient {
//     return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
// }
// ADD YOUR CREDENTIALS HERE (temporarily)
const HARDCODED_SUPABASE_URL = 'https://lthrzhlwxtagbulpndfm.supabase.co';
const HARDCODED_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0aHJ6aGx3eHRhZ2J1bHBuZGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNzc3ODYsImV4cCI6MjA3OTg1Mzc4Nn0.C5uuK5YhrcuVtYjduseoDy7odaJ-mG1ATYxMzzWfzVE';


function getSupabase(env: Env) {
    const url = env.SUPABASE_URL || HARDCODED_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_KEY || HARDCODED_SUPABASE_KEY;

    if (!url || !key || url.includes('YOUR_PROJECT_ID')) {
        throw new Error('Please add your Supabase credentials');
    }

    return createClient(url, key);
}
function generateLocalPart(length = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

function getCookie(request: Request, name: string): string | null {
    const cookies = request.headers.get('Cookie') || '';
    const match = cookies.match(new RegExp(`${name}=([^;]+)`));
    return match ? match[1] : null;
}

function corsHeaders(env: Env): Record<string, string> {
    return {
        'Access-Control-Allow-Origin': env.CORS_ORIGIN,
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true',
    };
}

function jsonResponse(data: unknown, status: number, env: Env, setCookie?: string): Response {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...corsHeaders(env),
    };
    if (setCookie) {
        headers['Set-Cookie'] = setCookie;
    }
    return new Response(JSON.stringify(data), { status, headers });
}

// Session Management
// async function getOrCreateSession(request: Request, env: Env): Promise<{ sessionId: string; isNew: boolean }> {
//     const supabase = getSupabase(env);
//     let sessionId = getCookie(request, 'session_id');
//     let isNew = false;

//     if (sessionId) {
//         const { data } = await supabase
//             .from('sessions')
//             .select('id')
//             .eq('id', sessionId)
//             .single();

//         if (data) {
//             await supabase
//                 .from('sessions')
//                 .update({ last_active: new Date().toISOString() })
//                 .eq('id', sessionId);
//             return { sessionId, isNew: false };
//         }
//     }

//     // Create new session
//     const { data: newSession } = await supabase
//         .from('sessions')
//         .insert({})
//         .select('id')
//         .single();

//     return { sessionId: newSession!.id, isNew: true };
// }

async function getOrCreateSession(env: Env): Promise<{ sessionId: string; isNew: boolean }> {
    const supabase = getSupabase(env);

    // Generate ID on client side as fallback
    const newId = crypto.randomUUID();

    const { error } = await supabase
        .from('sessions')
        .insert({ id: newId });

    if (error) {
        console.error('Insert error:', error);
        throw new Error(`Failed to create session: ${error.message}`);
    }

    return { sessionId: newId, isNew: true };
}





// Route Handlers
async function handleGetMailbox(sessionId: string, env: Env): Promise<Response> {
    const supabase = getSupabase(env);

    // Find active mailbox
    const { data: mailbox } = await supabase
        .from('mailboxes')
        .select('*')
        .eq('session_id', sessionId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (mailbox) {
        const ttlSeconds = Math.floor((new Date(mailbox.expires_at).getTime() - Date.now()) / 1000);
        return jsonResponse({
            id: mailbox.id,
            email: `${mailbox.local_part}@${mailbox.domain}`,
            local_part: mailbox.local_part,
            domain: mailbox.domain,
            created_at: mailbox.created_at,
            expires_at: mailbox.expires_at,
            ttl_seconds: ttlSeconds,
        }, 200, env);
    }

    // No active mailbox, create one
    return handleCreateMailbox(sessionId, env);
}

async function handleCreateMailbox(sessionId: string, env: Env): Promise<Response> {
    const supabase = getSupabase(env);

    // Deactivate existing mailboxes
    await supabase
        .from('mailboxes')
        .update({ is_active: false })
        .eq('session_id', sessionId);

    // Create new mailbox
    const localPart = generateLocalPart(10);
    const domain = env.EMAIL_DOMAIN;
    const ttlMinutes = parseInt(env.TTL_MINUTES) || 60;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const { data: mailbox, error } = await supabase
        .from('mailboxes')
        .insert({
            session_id: sessionId,
            local_part: localPart,
            domain: domain,
            expires_at: expiresAt.toISOString(),
            is_active: true,
        })
        .select()
        .single();

    if (error) {
        return jsonResponse({ error: error.message }, 500, env);
    }

    return jsonResponse({
        id: mailbox.id,
        email: `${mailbox.local_part}@${mailbox.domain}`,
        local_part: mailbox.local_part,
        domain: mailbox.domain,
        created_at: mailbox.created_at,
        expires_at: mailbox.expires_at,
        ttl_seconds: ttlMinutes * 60,
    }, 201, env);
}

async function handleGetMessages(sessionId: string, mailboxId: string, env: Env): Promise<Response> {
    const supabase = getSupabase(env);

    // Verify ownership
    const { data: mailbox } = await supabase
        .from('mailboxes')
        .select('id')
        .eq('id', mailboxId)
        .eq('session_id', sessionId)
        .single();

    if (!mailbox) {
        return jsonResponse({ error: 'Mailbox not found' }, 404, env);
    }

    // Get messages
    const { data: messages } = await supabase
        .from('emails')
        .select('id, from_address, from_name, subject, received_at, is_read, has_attachments')
        .eq('mailbox_id', mailboxId)
        .order('received_at', { ascending: false })
        .limit(50);

    return jsonResponse({
        messages: (messages || []).map(m => ({
            id: m.id,
            from: m.from_name ? `${m.from_name} <${m.from_address}>` : m.from_address,
            from_address: m.from_address,
            from_name: m.from_name,
            subject: m.subject || '(No Subject)',
            received_at: m.received_at,
            is_read: m.is_read,
            has_attachments: m.has_attachments,
        })),
        count: messages?.length || 0,
    }, 200, env);
}

async function handleGetMessage(sessionId: string, messageId: string, showHeaders: boolean, env: Env): Promise<Response> {
    const supabase = getSupabase(env);

    const { data: email } = await supabase
        .from('emails')
        .select('*, mailboxes!inner(session_id)')
        .eq('id', messageId)
        .single();

    if (!email || email.mailboxes.session_id !== sessionId) {
        return jsonResponse({ error: 'Message not found' }, 404, env);
    }

    // Mark as read
    await supabase
        .from('emails')
        .update({ is_read: true })
        .eq('id', messageId);

    const response: Record<string, unknown> = {
        id: email.id,
        from: email.from_name ? `${email.from_name} <${email.from_address}>` : email.from_address,
        from_address: email.from_address,
        from_name: email.from_name,
        to: email.to_address,
        subject: email.subject || '(No Subject)',
        text_body: email.text_body,
        html_body: email.html_body,
        received_at: email.received_at,
        has_attachments: email.has_attachments,
    };

    if (showHeaders) {
        response.headers = email.raw_headers;
    }

    return jsonResponse(response, 200, env);
}

async function handleDeleteMessage(sessionId: string, messageId: string, env: Env): Promise<Response> {
    const supabase = getSupabase(env);

    const { data: email } = await supabase
        .from('emails')
        .select('id, mailboxes!inner(session_id)')
        .eq('id', messageId)
        .single();

    if (!email || email.mailboxes.session_id !== sessionId) {
        return jsonResponse({ error: 'Message not found' }, 404, env);
    }

    await supabase.from('emails').delete().eq('id', messageId);

    return jsonResponse({ success: true }, 200, env);
}

// Test endpoint - simulate receiving email (for local development)
async function handleTestEmail(body: any, env: Env): Promise<Response> {
    const supabase = getSupabase(env);
    const { to, from, fromName, subject, text, html } = body;

    if (!to) {
        return jsonResponse({ error: 'Missing "to" address' }, 400, env);
    }

    const [localPart, domain] = to.split('@');

    // Find mailbox
    const { data: mailbox } = await supabase
        .from('mailboxes')
        .select('id')
        .eq('local_part', localPart.toLowerCase())
        .eq('domain', domain.toLowerCase())
        .gt('expires_at', new Date().toISOString())
        .single();

    if (!mailbox) {
        return jsonResponse({ error: 'Mailbox not found or expired' }, 404, env);
    }

    // Insert email
    const { data: email, error } = await supabase
        .from('emails')
        .insert({
            mailbox_id: mailbox.id,
            from_address: from || 'test@example.com',
            from_name: fromName || 'Test Sender',
            to_address: to,
            subject: subject || 'Test Email',
            text_body: text || 'This is a test email.',
            html_body: html || '<p>This is a test email.</p>',
            has_attachments: false,
        })
        .select()
        .single();

    if (error) {
        return jsonResponse({ error: error.message }, 500, env);
    }

    return jsonResponse({ success: true, email }, 201, env);
}

// Email handler for Cloudflare Email Routing
async function handleEmailReceived(message: EmailMessage, env: Env): Promise<void> {
    const supabase = getSupabase(env);

    try {
        const toAddress = message.to;
        const [localPart, domain] = toAddress.split('@');

        // Find mailbox
        const { data: mailbox } = await supabase
            .from('mailboxes')
            .select('id')
            .eq('local_part', localPart.toLowerCase())
            .eq('domain', domain.toLowerCase())
            .gt('expires_at', new Date().toISOString())
            .single();

        if (!mailbox) {
            console.log(`No mailbox found for ${toAddress}`);
            return;
        }

        // Parse email
        const rawEmail = await new Response(message.raw).arrayBuffer();
        const parser = new PostalMime();
        const parsed = await parser.parse(rawEmail);

        // Extract headers
        const headers: Record<string, string> = {};
        if (parsed.headers) {
            for (const header of parsed.headers) {
                headers[header.key] = header.value;
            }
        }

        const hasAttachments = parsed.attachments && parsed.attachments.length > 0;

        // Insert email
        const { data: email } = await supabase
            .from('emails')
            .insert({
                mailbox_id: mailbox.id,
                from_address: parsed.from?.address || message.from,
                from_name: parsed.from?.name || null,
                to_address: toAddress,
                subject: parsed.subject || null,
                text_body: parsed.text || null,
                html_body: parsed.html || null,
                raw_headers: headers,
                has_attachments: hasAttachments,
            })
            .select('id')
            .single();

        // Save attachment metadata
        if (hasAttachments && email) {
            const attachments = parsed.attachments!.map(att => ({
                email_id: email.id,
                filename: att.filename || 'unnamed',
                content_type: att.mimeType,
                size_bytes: att.content?.length || 0,
            }));

            await supabase.from('attachments').insert(attachments);
        }

        console.log(`Email saved for ${toAddress}`);
    } catch (error) {
        console.error('Email processing error:', error);
    }
}

// Scheduled cleanup
async function handleScheduled(env: Env): Promise<void> {
    const supabase = getSupabase(env);
    const { data } = await supabase.rpc('cleanup_expired_mailboxes');
    console.log('Cleanup completed:', data);
}

// Main request handler
async function handleRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    // Health check (no auth needed)
    if (path === '/api/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }, 200, env);
    }

    // Test email endpoint (no auth needed)
    if (path === '/api/test/email' && method === 'POST') {
        const body = await request.json();
        return handleTestEmail(body, env);
    }

    // Get or create session
    const { sessionId, isNew } = await getOrCreateSession(request, env);
    const setCookie = isNew
        ? `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
        : undefined;

    try {
        let response: Response;

        // GET /api/mailbox
        if (path === '/api/mailbox' && method === 'GET') {
            response = await handleGetMailbox(sessionId, env);
        }
        // POST /api/mailbox
        else if (path === '/api/mailbox' && method === 'POST') {
            response = await handleCreateMailbox(sessionId, env);
        }
        // GET /api/mailbox/:id/messages
        else if (path.match(/^\/api\/mailbox\/[^/]+\/messages$/) && method === 'GET') {
            const mailboxId = path.split('/')[3];
            response = await handleGetMessages(sessionId, mailboxId, env);
        }
        // GET /api/messages/:id
        else if (path.match(/^\/api\/messages\/[^/]+$/) && method === 'GET') {
            const messageId = path.split('/')[3];
            const showHeaders = url.searchParams.get('headers') === 'true';
            response = await handleGetMessage(sessionId, messageId, showHeaders, env);
        }
        // DELETE /api/messages/:id
        else if (path.match(/^\/api\/messages\/[^/]+$/) && method === 'DELETE') {
            const messageId = path.split('/')[3];
            response = await handleDeleteMessage(sessionId, messageId, env);
        }
        // 404
        else {
            response = jsonResponse({ error: 'Not Found' }, 404, env);
        }

        // Add session cookie if new
        if (setCookie) {
            const headers = new Headers(response.headers);
            headers.set('Set-Cookie', setCookie);
            return new Response(response.body, { status: response.status, headers });
        }

        return response;
    } catch (error: any) {
        console.error('Request error:', error);
        return jsonResponse({ error: error.message }, 500, env);
    }
}

// Export handlers
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        return handleRequest(request, env);
    },

    async email(message: EmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
        await handleEmailReceived(message, env);
    },

    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        await handleScheduled(env);
    },
};

// Type declaration for Cloudflare Email
interface EmailMessage {
    readonly from: string;
    readonly to: string;
    readonly raw: ReadableStream;
    readonly rawSize: number;
}