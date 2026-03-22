'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Check, X, Loader2, Trash2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { saveApiKey, getApiKey, getAllApiKeys, deleteApiKey } from '@/lib/indexeddb';
import { useSettingsStore } from '@/stores/settings-store';

// Provider配置
const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', icon: '🤖', hasBaseUrl: true },
  { id: 'anthropic', name: 'Anthropic', icon: '🔮', hasBaseUrl: false },
  { id: 'qwen', name: '通义千问', icon: '🌟', hasBaseUrl: true },
  { id: 'zhipu', name: '智谱AI', icon: '🧠', hasBaseUrl: false },
];

type ConnectionStatus = 'untested' | 'success' | 'failed';

interface ProviderState {
  hasKey: boolean;
  baseUrl: string;
  apiKey: string;
  showKey: boolean;
  editing: boolean;
  testing: boolean;
  saving: boolean;
  connectionStatus: ConnectionStatus;
}

interface ModelItem {
  id: string;
  name: string;
  max_tokens: number;
}

interface ProviderModels {
  provider: string;
  models: ModelItem[];
}

export default function SettingsPage() {
  const { selectedProvider, selectedModel, setSelectedProvider, setSelectedModel } = useSettingsStore();
  const [providerStates, setProviderStates] = useState<Record<string, ProviderState>>({});
  const [allModels, setAllModels] = useState<ProviderModels[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);

  // 加载所有模型列表
  useEffect(() => {
    async function loadModels() {
      try {
        const data = await apiFetch<{ providers: ProviderModels[] }>('/models');
        setAllModels(data.providers);
      } catch (error) {
        toast.error('加载模型列表失败');
        console.error(error);
      } finally {
        setIsLoadingModels(false);
      }
    }
    loadModels();
  }, []);

  // 从IndexedDB加载已保存的API Key状态
  useEffect(() => {
    async function loadSavedKeys() {
      try {
        const keys = await getAllApiKeys();
        const states: Record<string, ProviderState> = {};
        for (const provider of PROVIDERS) {
          const saved = keys.find((k) => k.provider === provider.id);
          states[provider.id] = {
            hasKey: saved?.hasKey || false,
            baseUrl: saved?.baseUrl || '',
            apiKey: '',
            showKey: false,
            editing: false,
            testing: false,
            saving: false,
            connectionStatus: 'untested',
          };
        }
        setProviderStates(states);
      } catch (error) {
        console.error('Failed to load API keys:', error);
      }
    }
    loadSavedKeys();
  }, []);

  // 更新provider状态
  const updateProviderState = useCallback((providerId: string, updates: Partial<ProviderState>) => {
    setProviderStates((prev) => ({
      ...prev,
      [providerId]: { ...prev[providerId], ...updates },
    }));
  }, []);

  // 开始编辑
  const startEditing = useCallback(async (providerId: string) => {
    try {
      const saved = await getApiKey(providerId);
      updateProviderState(providerId, {
        editing: true,
        apiKey: saved?.apiKey || '',
        baseUrl: saved?.baseUrl || '',
      });
    } catch {
      updateProviderState(providerId, { editing: true });
    }
  }, [updateProviderState]);

  // 保存API Key
  const handleSave = useCallback(async (providerId: string) => {
    const state = providerStates[providerId];
    if (!state?.apiKey.trim()) {
      toast.error('请输入API Key');
      return;
    }

    updateProviderState(providerId, { saving: true });
    try {
      await saveApiKey(providerId, state.apiKey.trim(), state.baseUrl.trim() || undefined);
      updateProviderState(providerId, {
        saving: false,
        editing: false,
        hasKey: true,
        connectionStatus: 'untested',
      });
      toast.success('API Key 已保存');
    } catch (error) {
      updateProviderState(providerId, { saving: false });
      toast.error('保存失败');
      console.error(error);
    }
  }, [providerStates, updateProviderState]);

  // 测试连接
  const handleTest = useCallback(async (providerId: string) => {
    updateProviderState(providerId, { testing: true });
    try {
      const saved = await getApiKey(providerId);
      if (!saved?.apiKey) {
        toast.error('请先保存API Key');
        updateProviderState(providerId, { testing: false });
        return;
      }

      const provider = PROVIDERS.find((p) => p.id === providerId);
      const response = await apiFetch<{ success: boolean; message: string }>('/test-connection', {
        method: 'POST',
        body: JSON.stringify({
          provider: providerId,
          api_key: saved.apiKey,
          base_url: saved.baseUrl || null,
        }),
      });

      if (response.success) {
        updateProviderState(providerId, { testing: false, connectionStatus: 'success' });
        toast.success(`${provider?.name || providerId} 连接成功`);
      } else {
        updateProviderState(providerId, { testing: false, connectionStatus: 'failed' });
        toast.error(response.message || '连接失败');
      }
    } catch (error) {
      updateProviderState(providerId, { testing: false, connectionStatus: 'failed' });
      toast.error('测试连接失败');
      console.error(error);
    }
  }, [updateProviderState]);

  // 删除API Key
  const handleDelete = useCallback(async (providerId: string) => {
    try {
      await deleteApiKey(providerId);
      updateProviderState(providerId, {
        hasKey: false,
        apiKey: '',
        baseUrl: '',
        editing: false,
        connectionStatus: 'untested',
      });
      toast.success('API Key 已删除');
    } catch (error) {
      toast.error('删除失败');
      console.error(error);
    }
  }, [updateProviderState]);

  // 获取当前provider的模型列表
  const currentProviderModels = allModels.find((p) => p.provider === selectedProvider)?.models || [];

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">设置</h1>

      {/* API Key管理区域 */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">API Key 管理</h2>
        <div className="grid gap-4">
          {PROVIDERS.map((provider) => {
            const state = providerStates[provider.id];
            if (!state) return null;

            return (
              <Card key={provider.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{provider.icon}</span>
                      <CardTitle className="text-base">{provider.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* 连接状态指示器 */}
                      {state.connectionStatus === 'success' && (
                        <span className="flex items-center gap-1 text-sm text-green-600">
                          <Check className="w-4 h-4" /> 已连接
                        </span>
                      )}
                      {state.connectionStatus === 'failed' && (
                        <span className="flex items-center gap-1 text-sm text-red-600">
                          <X className="w-4 h-4" /> 连接失败
                        </span>
                      )}
                      {state.hasKey && !state.editing && (
                        <span className="text-sm text-muted-foreground">已配置</span>
                      )}
                    </div>
                  </div>
                  {!state.editing && state.hasKey && (
                    <CardDescription>API Key 已安全存储</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {state.editing ? (
                    <>
                      {/* API Key 输入 */}
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={state.showKey ? 'text' : 'password'}
                            placeholder="输入 API Key"
                            value={state.apiKey}
                            onChange={(e) => updateProviderState(provider.id, { apiKey: e.target.value })}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => updateProviderState(provider.id, { showKey: !state.showKey })}
                          >
                            {state.showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      {/* Base URL 输入（可选） */}
                      {provider.hasBaseUrl && (
                        <Input
                          type="text"
                          placeholder="Base URL（可选）"
                          value={state.baseUrl}
                          onChange={(e) => updateProviderState(provider.id, { baseUrl: e.target.value })}
                        />
                      )}

                      {/* 操作按钮 */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSave(provider.id)}
                          disabled={state.saving}
                        >
                          {state.saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                          保存
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateProviderState(provider.id, { editing: false })}
                        >
                          取消
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEditing(provider.id)}
                      >
                        {state.hasKey ? '修改' : '添加'} API Key
                      </Button>
                      {state.hasKey && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTest(provider.id)}
                            disabled={state.testing}
                          >
                            {state.testing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                            测试连接
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(provider.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            删除
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 默认模型设置 */}
      <section>
        <h2 className="text-lg font-semibold mb-4">默认模型</h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Provider</label>
                <Select value={selectedProvider} onValueChange={(v) => v && setSelectedProvider(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择 Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.icon} {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">模型</label>
                <Select 
                  value={selectedModel} 
                  onValueChange={(v) => v && setSelectedModel(v)}
                  disabled={isLoadingModels}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingModels ? "加载中..." : "选择模型"} />
                  </SelectTrigger>
                  <SelectContent>
                    {currentProviderModels.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              默认模型将用于新对话和辩论，您也可以在使用时临时切换。
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
