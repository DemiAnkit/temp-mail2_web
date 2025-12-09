// frontend/src/app/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import DOMPurify from 'dompurify';
import {
  mailboxApi,
  messagesApi,
  testApi,
  MailboxResponse,
  EmailSummary,
  EmailDetail,
} from '@/lib/api';

export default function Home() {
  const [mailbox, setMailbox] = useState<MailboxResponse | null>(null);
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ttl, setTtl] = useState(0);
  const [showHeaders, setShowHeaders] = useState(false);
  const [showHtml, setShowHtml] = useState(true);

  // Load mailbox on mount
  useEffect(() => {
    loadMailbox();
  }, []);

  // Load mailbox
  const loadMailbox = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await mailboxApi.get();
      setMailbox(data);
      setTtl(data.ttl_seconds);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load emails when mailbox changes
  useEffect(() => {
    if (mailbox) {
      loadEmails();
    }
  }, [mailbox?.id]);

  // Load emails
  const loadEmails = async () => {
    if (!mailbox) return;
    try {
      const data = await mailboxApi.getMessages(mailbox.id);
      setEmails(data.messages);
    } catch (err: any) {
      console.error('Failed to load emails:', err);
    }
  };

  // Poll for new emails
  useEffect(() => {
    if (!mailbox) return;
    const interval = setInterval(loadEmails, 5000);
    return () => clearInterval(interval);
  }, [mailbox?.id]);

  // TTL countdown
  useEffect(() => {
    if (ttl <= 0) return;
    const interval = setInterval(() => {
      setTtl((prev) => {
        if (prev <= 1) {
          createNewMailbox();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [ttl > 0]);

  // Create new mailbox
  const createNewMailbox = async () => {
    try {
      setLoading(true);
      setSelectedEmail(null);
      setEmails([]);
      const data = await mailboxApi.create();
      setMailbox(data);
      setTtl(data.ttl_seconds);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // View email
  const viewEmail = async (emailId: string) => {
    try {
      const data = await messagesApi.get(emailId, true);
      setSelectedEmail(data);
      setEmails((prev) =>
        prev.map((e) => (e.id === emailId ? { ...e, is_read: true } : e))
      );
    } catch (err: any) {
      console.error('Failed to load email:', err);
    }
  };

  // Delete email
  const deleteEmail = async (emailId: string) => {
    try {
      await messagesApi.delete(emailId);
      setEmails((prev) => prev.filter((e) => e.id !== emailId));
      if (selectedEmail?.id === emailId) {
        setSelectedEmail(null);
      }
    } catch (err: any) {
      console.error('Failed to delete email:', err);
    }
  };

  // Copy email
  const copyEmail = () => {
    if (mailbox) {
      navigator.clipboard.writeText(mailbox.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Format TTL
  const formatTTL = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading && !mailbox) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !mailbox) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Error: {error}</p>
          <button
            onClick={loadMailbox}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-blue-400">📧 TempMail</h1>
          <p className="text-gray-400 text-sm">
            Disposable temporary email service
          </p>
        </div>
      </header>

      {/* Email Address Bar */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 w-full">
            <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-3 border border-gray-700">
              <span className="text-green-400 font-mono text-lg flex-1 truncate">
                {mailbox?.email}
              </span>
              <button
                onClick={copyEmail}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition text-sm"
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-mono text-yellow-400">
                {formatTTL(ttl)}
              </div>
              <div className="text-xs text-gray-400">expires</div>
            </div>
            <button
              onClick={createNewMailbox}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition disabled:opacity-50"
            >
              🔄 New
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Email List */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div className="p-3 bg-gray-700 border-b border-gray-600 flex justify-between items-center">
              <h2 className="font-semibold">Inbox ({emails.length})</h2>
              <button
                onClick={loadEmails}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                ↻ Refresh
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-700">
              {emails.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <div className="text-4xl mb-2">📭</div>
                  <p>No emails yet</p>
                  <p className="text-sm mt-2">Waiting for mail...</p>
                </div>
              ) : (
                emails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => viewEmail(email.id)}
                    className={`p-3 cursor-pointer hover:bg-gray-700 transition ${selectedEmail?.id === email.id
                        ? 'bg-gray-700 border-l-4 border-blue-500'
                        : ''
                      }`}
                  >
                    <div className="flex items-start gap-2">
                      {!email.is_read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div
                          className={`font-medium truncate ${email.is_read ? 'text-gray-300' : 'text-white'
                            }`}
                        >
                          {email.from_name || email.from_address}
                        </div>
                        <div className="text-sm text-gray-400 truncate">
                          {email.subject}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDistanceToNow(new Date(email.received_at), {
                            addSuffix: true,
                          })}
                        </div>
                      </div>
                      {email.has_attachments && (
                        <span className="text-gray-400">📎</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Email View */}
          <div className="lg:col-span-2 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            {selectedEmail ? (
              <>
                <div className="p-4 bg-gray-700 border-b border-gray-600">
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <h2 className="text-xl font-semibold flex-1">
                      {selectedEmail.subject}
                    </h2>
                    <button
                      onClick={() => deleteEmail(selectedEmail.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                  <div className="text-sm text-gray-300 space-y-1">
                    <div>
                      <span className="text-gray-400">From:</span>{' '}
                      {selectedEmail.from}
                    </div>
                    <div>
                      <span className="text-gray-400">To:</span>{' '}
                      {selectedEmail.to}
                    </div>
                    <div>
                      <span className="text-gray-400">Date:</span>{' '}
                      {new Date(selectedEmail.received_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setShowHtml(!showHtml)}
                      className={`px-3 py-1 rounded text-sm transition ${showHtml ? 'bg-blue-600' : 'bg-gray-600'
                        }`}
                    >
                      {showHtml ? '📄 HTML' : '📝 Text'}
                    </button>
                    <button
                      onClick={() => setShowHeaders(!showHeaders)}
                      className={`px-3 py-1 rounded text-sm transition ${showHeaders ? 'bg-blue-600' : 'bg-gray-600'
                        }`}
                    >
                      🔧 Headers
                    </button>
                  </div>
                </div>

                {showHeaders && selectedEmail.headers && (
                  <div className="p-4 bg-gray-900 border-b border-gray-700 max-h-40 overflow-auto">
                    <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">
                      {Object.entries(selectedEmail.headers).map(
                        ([key, value]) => (
                          <div key={key}>
                            <span className="text-blue-400">{key}:</span>{' '}
                            {String(value)}
                          </div>
                        )
                      )}
                    </pre>
                  </div>
                )}

                <div className="p-4 max-h-[50vh] overflow-auto bg-white text-gray-900">
                  {showHtml && selectedEmail.html_body ? (
                    <div
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(selectedEmail.html_body),
                      }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-mono text-sm">
                      {selectedEmail.text_body || 'No content'}
                    </pre>
                  )}
                </div>
              </>
            ) : (
              <div className="h-96 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <div className="text-5xl mb-3">📬</div>
                  <p>Select an email to view</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Test Email Form */}
        <TestEmailForm
          emailAddress={mailbox?.email || ''}
          onSent={loadEmails}
        />
      </main>

      {/* Footer */}
      <footer className="mt-8 p-4 text-center text-gray-500 text-sm border-t border-gray-800">
        <p>Emails auto-delete after expiration. No registration required.</p>
      </footer>
    </div>
  );
}

// Test Email Form Component
function TestEmailForm({
  emailAddress,
  onSent,
}: {
  emailAddress: string;
  onSent: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    from: 'sender@example.com',
    fromName: 'Test Sender',
    subject: 'Test Email Subject',
    text: 'This is a test email.\n\nSent from the TempMail test form.',
    html: '<h1>Test Email</h1><p>This is a <strong>test</strong> email.</p><p>Sent from the TempMail test form.</p>',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailAddress) return;

    setSending(true);
    try {
      await testApi.sendEmail({
        to: emailAddress,
        from: form.from,
        fromName: form.fromName,
        subject: form.subject,
        text: form.text,
        html: form.html,
      });
      onSent();
    } catch (err) {
      console.error('Failed to send test email:', err);
      alert('Failed to send test email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-semibold mb-3">
        🧪 Send Test Email (Development)
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="email"
            placeholder="From email"
            value={form.from}
            onChange={(e) => setForm({ ...form, from: e.target.value })}
            className="px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder="From name"
            value={form.fromName}
            onChange={(e) => setForm({ ...form, fromName: e.target.value })}
            className="px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Subject"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <textarea
          placeholder="Email body (text)"
          value={form.text}
          onChange={(e) => setForm({ ...form, text: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !emailAddress}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition disabled:opacity-50"
        >
          {sending ? 'Sending...' : '📤 Send Test Email'}
        </button>
      </form>
    </div>
  );
}