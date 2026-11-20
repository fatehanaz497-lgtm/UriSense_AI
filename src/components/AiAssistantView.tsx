import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Bot, FileText, Menu, Plus, Send, Trash2, User, X } from 'lucide-react';
import type { ChatSession, PatientRecord, UrinalysisTestRecord } from '../../shared/urinalysis.ts';
import { api } from '../lib/api.ts';

const SUGGESTED_QUESTIONS = [
  'What is urinalysis?',
  'Explain my urine test results.',
  'What does protein in urine mean?',
  'What is the normal urine pH?',
  'What does glucose in urine indicate?',
  'Explain the difference between normal and abnormal results.',
];

function FormattedAssistantText({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);
  return (
    <div className="space-y-2.5 text-sm leading-relaxed text-[#24364B]">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
          const title = trimmed.replace(/^#{2,3}\s+/, '');
          return (
            <h4 key={i} className="text-sm font-bold text-[#164B78] pt-1">
              {title}
            </h4>
          );
        }
        const lines = trimmed.split('\n');
        if (lines.every((l) => l.trim().startsWith('- ') || l.trim().startsWith('* '))) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {lines.map((l, idx) => (
                <li key={idx}>{l.trim().replace(/^[-*]\s+/, '').replace(/\*\*/g, '')}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {trimmed.replace(/\*\*/g, '')}
          </p>
        );
      })}
    </div>
  );
}

interface AiAssistantViewProps {
  patients: PatientRecord[];
  tests: UrinalysisTestRecord[];
  initialAttachedTest?: UrinalysisTestRecord | null;
}

export function AiAssistantView({ patients, tests, initialAttachedTest }: AiAssistantViewProps) {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    initialAttachedTest?.patientId || ''
  );
  const [selectedTestId, setSelectedTestId] = useState<string>(initialAttachedTest?.id || '');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await api.getChats();
        if (!mounted) return;
        if (res.chats.length > 0 && !initialAttachedTest) {
          setChats(res.chats);
          setActiveChatId(res.chats[0].id);
          setSelectedPatientId(res.chats[0].patientId || '');
          setSelectedTestId(res.chats[0].testId || '');
        } else {
          const created = await api.createChat({
            title: initialAttachedTest
              ? `Review ${initialAttachedTest.patientName}`
              : 'New Consultation',
            patientId: initialAttachedTest?.patientId || null,
            testId: initialAttachedTest?.id || null,
          });
          if (!mounted) return;
          setChats([created.chat, ...res.chats]);
          setActiveChatId(created.chat.id);
          setSelectedPatientId(created.chat.patientId || '');
          setSelectedTestId(created.chat.testId || '');
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unable to load chat history.');
        }
      } finally {
        if (mounted) setLoadingChats(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [initialAttachedTest]);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages.length, sending]);

  const patientTests = selectedPatientId
    ? tests.filter((t) => t.patientId === selectedPatientId)
    : tests;

  async function handleNewChat() {
    setError(null);
    try {
      const res = await api.createChat({
        title: 'New Consultation',
        patientId: selectedPatientId || null,
        testId: selectedTestId || null,
      });
      setChats((prev) => [res.chat, ...prev]);
      setActiveChatId(res.chat.id);
      setMobileSidebarOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start new chat.');
    }
  }

  async function handleSelectChat(chat: ChatSession) {
    setActiveChatId(chat.id);
    setSelectedPatientId(chat.patientId || '');
    setSelectedTestId(chat.testId || '');
    setError(null);
    setMobileSidebarOpen(false);
  }

  async function handleClearChat() {
    if (!activeChat) return;
    setError(null);
    try {
      const res = await api.updateChat(activeChat.id, { clearMessages: true });
      setChats((prev) => prev.map((c) => (c.id === res.chat.id ? res.chat : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear chat.');
    }
  }

  async function handleDeleteChat(id: string) {
    try {
      await api.deleteChat(id);
      const remaining = chats.filter((c) => c.id !== id);
      if (remaining.length === 0) {
        const created = await api.createChat({ title: 'New Consultation' });
        setChats([created.chat]);
        setActiveChatId(created.chat.id);
      } else {
        setChats(remaining);
        if (activeChatId === id) {
          setActiveChatId(remaining[0].id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete chat.');
    }
  }

  async function handleContextChange(nextPatientId: string, nextTestId: string) {
    setSelectedPatientId(nextPatientId);
    setSelectedTestId(nextTestId);
    if (activeChat) {
      try {
        const res = await api.updateChat(activeChat.id, {
          patientId: nextPatientId || null,
          testId: nextTestId || null,
        });
        setChats((prev) => prev.map((c) => (c.id === res.chat.id ? res.chat : c)));
      } catch {
        // Non-fatal
      }
    }
  }

  async function sendPrompt(promptText: string) {
    const trimmed = promptText.trim();
    if (!trimmed || sending || !activeChat) return;

    setError(null);
    setInput('');
    setSending(true);

    // Optimistically display user message
    const tempUserMsgId = `TEMP-${Date.now()}`;
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChat.id
          ? {
              ...c,
              messages: [
                ...c.messages,
                {
                  id: tempUserMsgId,
                  role: 'user',
                  content: trimmed,
                  timestamp: new Date().toISOString(),
                },
              ],
            }
          : c
      )
    );

    try {
      const res = await api.sendChatMessage(activeChat.id, {
        message: trimmed,
        patientId: selectedPatientId || null,
        testId: selectedTestId || null,
      });
      setChats((prev) => prev.map((c) => (c.id === res.chat.id ? res.chat : c)));
    } catch (err) {
      // Remove optimistic message on error and show clear message
      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChat.id
            ? { ...c, messages: c.messages.filter((m) => m.id !== tempUserMsgId) }
            : c
        )
      );
      setInput(trimmed);
      setError(err instanceof Error ? err.message : 'Failed to get response from UriSense Assistant.');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPrompt(input);
    }
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#F8FBFF] border-r border-[#D6E4F0] w-64">
      <div className="p-3.5 border-b border-[#D6E4F0] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleNewChat}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-[#2685D8] hover:bg-[#164B78] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>New Chat</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          className="md:hidden p-1.5 text-[#64748B] hover:text-[#164B78]"
          aria-label="Close chat history"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
        <div className="px-2 py-1 text-[11px] font-semibold text-[#64748B]">Chat History</div>
        {chats.map((c) => {
          const isActive = c.id === activeChat?.id;
          return (
            <div
              key={c.id}
              className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                isActive ? 'bg-[#EAF5FF] text-[#164B78] font-semibold' : 'text-[#24364B] hover:bg-white'
              }`}
              onClick={() => handleSelectChat(c)}
            >
              <span className="truncate">{c.title || 'New Consultation'}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteChat(c.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-[#64748B] hover:text-[#DC2626] transition-opacity cursor-pointer"
                aria-label="Delete chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-[#D6E4F0] shadow-[0_1px_3px_rgba(22,75,120,0.05)] overflow-hidden flex h-[calc(100vh-148px)] min-h-[540px] relative">
      {/* Desktop Chat History Sidebar */}
      <div className="hidden md:block shrink-0">{sidebarContent}</div>

      {/* Mobile Chat History Drawer */}
      {mobileSidebarOpen && (
        <div className="absolute inset-0 z-30 md:hidden flex">
          <div className="h-full">{sidebarContent}</div>
          <div className="flex-1 bg-[#164B78]/20" onClick={() => setMobileSidebarOpen(false)} />
        </div>
      )}

      {/* Main Conversational Area */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
        {/* Assistant Top Context Bar */}
        <div className="px-4 sm:px-6 py-3 border-b border-[#D6E4F0] bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-md text-[#164B78] hover:bg-[#EAF5FF]"
              aria-label="Open chat history"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-[#EAF5FF] border border-[#D6E4F0] flex items-center justify-center text-[#2685D8]">
              <Bot className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#164B78] leading-tight">UriSense Assistant</h2>
              <p className="text-[11px] text-[#64748B]">Educational urinalysis &amp; IoT guidance</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Patient & Report Context Attachment */}
            <div className="flex items-center gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5 text-[#2685D8] hidden sm:block" aria-hidden="true" />
              <select
                value={selectedPatientId}
                onChange={(e) => {
                  const nextP = e.target.value;
                  const firstTest = nextP ? tests.find((t) => t.patientId === nextP)?.id || '' : '';
                  handleContextChange(nextP, firstTest);
                }}
                aria-label="Attach patient context"
                className="px-2.5 py-1.5 text-xs bg-[#F8FBFF] border border-[#D6E4F0] rounded-lg text-[#24364B] max-w-[150px]"
              >
                <option value="">No patient attached</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedTestId}
                onChange={(e) => {
                  const tId = e.target.value;
                  const matched = tests.find((t) => t.id === tId);
                  handleContextChange(matched?.patientId || selectedPatientId, tId);
                }}
                aria-label="Attach test report context"
                className="px-2.5 py-1.5 text-xs bg-[#F8FBFF] border border-[#D6E4F0] rounded-lg text-[#24364B] max-w-[175px]"
              >
                <option value="">No report attached</option>
                {patientTests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} · {t.overallStatus}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleClearChat}
              disabled={!activeChat || activeChat.messages.length === 0}
              className="px-2.5 py-1.5 text-xs font-medium text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
            >
              Clear Chat
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-white">
          {loadingChats ? (
            <div className="h-full flex items-center justify-center text-xs text-[#64748B]">
              Loading conversation...
            </div>
          ) : !activeChat || activeChat.messages.length === 0 ? (
            <div className="max-w-2xl mx-auto py-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF5FF] border border-[#D6E4F0] flex items-center justify-center text-[#2685D8] mx-auto mb-4">
                <Bot className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-[#164B78]">Welcome to UriSense Assistant</h3>
              <p className="text-xs sm:text-sm text-[#64748B] mt-1.5 max-w-lg mx-auto leading-relaxed">
                Ask about any urine test parameter, attach a patient report above for personalized explanations, or learn
                how the ESP32 urinalysis analyzer works.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-6 text-left">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendPrompt(q)}
                    className="p-3.5 rounded-xl bg-[#F8FBFF] hover:bg-[#EAF5FF] border border-[#D6E4F0] text-xs font-medium text-[#164B78] transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {activeChat.messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id} className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && (
                      <div className="w-7 h-7 rounded-full bg-[#EAF5FF] border border-[#D6E4F0] flex items-center justify-center text-[#2685D8] shrink-0">
                        <Bot className="w-4 h-4" aria-hidden="true" />
                      </div>
                    )}

                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                        isUser
                          ? 'bg-[#2685D8] text-white rounded-br-sm'
                          : 'bg-[#EAF5FF] text-[#24364B] border border-[#D6E4F0] rounded-bl-sm'
                      }`}
                    >
                      {isUser ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <FormattedAssistantText content={msg.content} />
                      )}
                      <div
                        className={`text-[10px] mt-1.5 font-mono tabular-nums ${
                          isUser ? 'text-white/80 text-right' : 'text-[#64748B]'
                        }`}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    {isUser && (
                      <div className="w-7 h-7 rounded-full bg-[#164B78] flex items-center justify-center text-white shrink-0">
                        <User className="w-3.5 h-3.5" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                );
              })}

              {sending && (
                <div className="flex items-end gap-2.5 justify-start">
                  <div className="w-7 h-7 rounded-full bg-[#EAF5FF] border border-[#D6E4F0] flex items-center justify-center text-[#2685D8] shrink-0">
                    <Bot className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className="bg-[#EAF5FF] border border-[#D6E4F0] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#2685D8] animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-[#2685D8] animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-[#2685D8] animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Error Toast + Bottom Chat Input */}
        <div className="p-4 border-t border-[#D6E4F0] bg-white">
          {error && (
            <div className="max-w-3xl mx-auto mb-3 p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626]">
              {error}
            </div>
          )}

          <div className="max-w-3xl mx-auto flex items-end gap-2.5 bg-[#F8FBFF] border border-[#D6E4F0] focus-within:border-[#2685D8] rounded-2xl px-3.5 py-2.5">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask UriSense Assistant about urinalysis results or parameters..."
              className="flex-1 bg-transparent text-sm text-[#24364B] placeholder:text-[#64748B] resize-none focus:outline-none max-h-32 py-1"
            />
            <button
              type="button"
              onClick={() => sendPrompt(input)}
              disabled={sending || !input.trim()}
              className="p-2.5 rounded-xl bg-[#2685D8] hover:bg-[#164B78] text-white transition-colors disabled:opacity-40 shrink-0 cursor-pointer"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="max-w-3xl mx-auto text-[11px] text-[#64748B] mt-2 text-center">
            Educational assistant only — does not diagnose disease or replace a qualified healthcare professional.
          </p>
        </div>
      </div>
    </div>
  );
}
