'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Square, Settings2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings-store';

// 模型配置
const PROVIDERS = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'qwen', name: 'Qwen (通义千问)' },
  { id: 'zhipu', name: 'Zhipu (智谱)' },
];

const MODELS: Record<string, { id: string; name: string }[]> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
  ],
  qwen: [
    { id: 'qwen3.5-plus', name: 'Qwen3.5-Plus（最新）' },
    { id: 'qwen3-max', name: 'Qwen3-Max' },
    { id: 'qwen3-235b-a22b', name: 'Qwen3-235B' },
    { id: 'qwen3-30b-a3b', name: 'Qwen3-30B' },
    { id: 'qwen3-32b', name: 'Qwen3-32B' },
    { id: 'qwen3-14b', name: 'Qwen3-14B' },
    { id: 'qwen3-8b', name: 'Qwen3-8B' },
    { id: 'qwen3-4b', name: 'Qwen3-4B' },
    { id: 'qwen3-1.7b', name: 'Qwen3-1.7B' },
    { id: 'qwen3-0.6b', name: 'Qwen3-0.6B' },
    { id: 'qwen-max-latest', name: 'Qwen-Max-Latest' },
    { id: 'qwen-plus-latest', name: 'Qwen-Plus-Latest' },
    { id: 'qwen-turbo-latest', name: 'Qwen-Turbo-Latest' },
    { id: 'qwen-max', name: 'Qwen-Max' },
    { id: 'qwen-plus', name: 'Qwen-Plus' },
    { id: 'qwen-turbo', name: 'Qwen-Turbo' },
  ],
  zhipu: [
    { id: 'glm-4-plus', name: 'GLM-4 Plus' },
    { id: 'glm-4', name: 'GLM-4' },
    { id: 'glm-4-flash', name: 'GLM-4 Flash' },
  ],
};

interface ChatInputProps {
  onSend: (message: string, provider: string, model: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  hasApiKey?: boolean;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled = false,
  hasApiKey = true,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { selectedProvider, selectedModel, setSelectedProvider, setSelectedModel } = useSettingsStore();

  // Auto resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, [message]);

  // Reset model when provider changes
  useEffect(() => {
    const providerModels = MODELS[selectedProvider];
    if (providerModels && !providerModels.find(m => m.id === selectedModel)) {
      setSelectedModel(providerModels[0].id);
    }
  }, [selectedProvider, selectedModel, setSelectedModel]);

  const handleSend = () => {
    if (!message.trim() || isStreaming || disabled) return;
    onSend(message.trim(), selectedProvider, selectedModel);
    setMessage('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const currentModels = MODELS[selectedProvider] || [];
  const canSend = message.trim() && !isStreaming && !disabled && hasApiKey;

  return (
    <div className="border-t bg-background p-4">
      {/* API Key Warning */}
      {!hasApiKey && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-destructive/10 text-destructive rounded-md text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>请先在设置页面配置 {PROVIDERS.find(p => p.id === selectedProvider)?.name} 的 API Key</span>
        </div>
      )}

      {/* Model Selection */}
      <div className="flex items-center gap-2 mb-3">
        <Settings2 className="w-4 h-4 text-muted-foreground" />
        <Select value={selectedProvider} onValueChange={(v) => v && setSelectedProvider(v)}>
          <SelectTrigger className="w-[140px] h-8">
            <SelectValue placeholder="选择提供商" />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((provider) => (
              <SelectItem key={provider.id} value={provider.id}>
                {provider.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedModel} onValueChange={(v) => v && setSelectedModel(v)}>
          <SelectTrigger className="w-[160px] h-8">
            <SelectValue placeholder="选择模型" />
          </SelectTrigger>
          <SelectContent>
            {currentModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Input Area */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasApiKey ? "输入消息，Enter 发送，Shift+Enter 换行..." : "请先配置 API Key"}
            disabled={isStreaming || disabled || !hasApiKey}
            className={cn(
              'min-h-[44px] max-h-[200px] resize-none pr-12',
              'scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent'
            )}
            rows={1}
          />
        </div>
        {isStreaming ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onClick={onStop}
                  variant="destructive"
                  size="icon"
                  className="h-[44px] w-[44px]"
                >
                  <Square className="w-4 h-4" />
                </Button>
              }
            />
            <TooltipContent>停止生成</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onClick={handleSend}
                  disabled={!canSend}
                  size="icon"
                  className="h-[44px] w-[44px]"
                >
                  <Send className="w-4 h-4" />
                </Button>
              }
            />
            <TooltipContent>Enter 发送</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
