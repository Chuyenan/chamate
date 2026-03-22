'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { MessageList } from '@/components/chat/MessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { useConversationStore, Conversation, Message } from '@/stores/conversation-store';
import { useSettingsStore } from '@/stores/settings-store';
import { apiFetch, apiStream } from '@/lib/api';
import { getApiKey } from '@/lib/indexeddb';

interface ConversationDetail {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: {
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant';
    content: string;
    model?: string;
    provider?: string;
    created_at: string;
  }[];
}

export default function ChatPage() {
  const {
    conversations,
    currentConversationId,
    messages,
    isLoading,
    isStreaming,
    setConversations,
    setCurrentConversationId,
    setMessages,
    addMessage,
    updateLastMessage,
    setIsLoading,
    setIsStreaming,
  } = useConversationStore();

  const { selectedProvider } = useSettingsStore();
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  // Check API key when provider changes
  useEffect(() => {
    checkApiKey(selectedProvider);
  }, [selectedProvider]);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      fetchMessages(currentConversationId);
    } else {
      setMessages([]);
    }
  }, [currentConversationId]);

  const checkApiKey = async (provider: string) => {
    try {
      const keyData = await getApiKey(provider);
      setHasApiKey(!!keyData?.apiKey);
    } catch {
      setHasApiKey(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const data = await apiFetch<Conversation[]>('/conversations');
      // Convert snake_case to camelCase
      const converted = data.map(conv => ({
        ...conv,
        createdAt: (conv as unknown as { created_at: string }).created_at,
        updatedAt: (conv as unknown as { updated_at: string }).updated_at,
      }));
      setConversations(converted);
    } catch (error) {
      toast.error('获取会话列表失败');
      console.error(error);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    setIsLoading(true);
    try {
      const data = await apiFetch<ConversationDetail>(`/conversations/${conversationId}`);
      const converted: Message[] = data.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        model: msg.model,
        provider: msg.provider,
        createdAt: msg.created_at,
      }));
      setMessages(converted);
    } catch (error) {
      toast.error('获取消息历史失败');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const createConversation = async (): Promise<string | null> => {
    try {
      const data = await apiFetch<{ id: string; title: string; created_at: string; updated_at: string }>(
        '/conversations',
        {
          method: 'POST',
          body: JSON.stringify({ title: '新对话' }),
        }
      );
      const newConv: Conversation = {
        id: data.id,
        title: data.title,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
      setConversations([newConv, ...conversations]);
      setCurrentConversationId(data.id);
      return data.id;
    } catch (error) {
      toast.error('创建会话失败');
      console.error(error);
      return null;
    }
  };

  const handleSend = useCallback(async (message: string, provider: string, model: string) => {
    // Get or create conversation
    let convId = currentConversationId;
    if (!convId) {
      convId = await createConversation();
      if (!convId) return;
    }

    // Get API key
    const keyData = await getApiKey(provider);
    if (!keyData?.apiKey) {
      toast.error(`请先配置 ${provider} 的 API Key`);
      return;
    }

    // Add user message locally
    const userMessage: Message = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };
    addMessage(userMessage);

    // Add placeholder for assistant message
    const assistantMessage: Message = {
      id: `temp-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      model,
      provider,
      createdAt: new Date().toISOString(),
    };
    addMessage(assistantMessage);

    setIsStreaming(true);
    let fullContent = '';

    try {
      await apiStream(
        '/chat',
        {
          conversation_id: convId,
          message,
          model,
          provider,
        },
        {
          apiKey: keyData.apiKey,
          provider,
          onMessage: (content) => {
            fullContent += content;
            updateLastMessage(fullContent);
          },
          onDone: () => {
            setIsStreaming(false);
            // Refresh conversation list to update title if it was auto-generated
            fetchConversations();
          },
          onError: (error) => {
            toast.error(error);
            setIsStreaming(false);
          },
        }
      );
    } catch (error) {
      toast.error('发送消息失败');
      console.error(error);
      setIsStreaming(false);
    }
  }, [currentConversationId, conversations, addMessage, updateLastMessage, setIsStreaming]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, [setIsStreaming]);

  // Find current conversation title
  const currentConversation = conversations.find(c => c.id === currentConversationId);

  return (
    <div className="flex flex-col h-full">
      {/* Header with conversation title */}
      {currentConversation && (
        <div className="border-b px-4 py-2 bg-muted/30">
          <h2 className="text-sm font-medium truncate">{currentConversation.title}</h2>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          isStreaming={isStreaming}
        />
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={isStreaming}
        hasApiKey={hasApiKey}
      />
    </div>
  );
}
