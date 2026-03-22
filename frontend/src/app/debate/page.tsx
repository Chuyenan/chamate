'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Loader2, MessageSquare, ArrowRight, FileText, Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { getApiKey } from '@/lib/indexeddb';
import { useDebateStore, Debate, DebateDetail, DebateRound } from '@/stores/debate-store';
import { useSettingsStore } from '@/stores/settings-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

interface ModelItem {
  id: string;
  name: string;
}

interface ProviderModels {
  provider: string;
  models: ModelItem[];
}

// 简单的Markdown渲染（仅处理基本格式）
function renderMarkdown(text: string) {
  if (!text) return null;
  
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let inList = false;
  
  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc pl-6 my-2 space-y-1">
          {listItems.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };
  
  const formatInline = (line: string) => {
    return line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>');
  };
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // 标题
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(<h3 key={index} className="font-semibold text-base mt-3 mb-1">{trimmed.slice(4)}</h3>);
    } else if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(<h2 key={index} className="font-semibold text-lg mt-4 mb-2">{trimmed.slice(3)}</h2>);
    } else if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(<h1 key={index} className="font-bold text-xl mt-4 mb-2">{trimmed.slice(2)}</h1>);
    }
    // 列表项
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) {
      inList = true;
      const content = trimmed.replace(/^[-*]\s|^\d+\.\s/, '');
      listItems.push(content);
    }
    // 空行
    else if (!trimmed) {
      flushList();
      elements.push(<br key={index} />);
    }
    // 普通段落
    else {
      flushList();
      elements.push(
        <p key={index} className="my-1" dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />
      );
    }
  });
  
  flushList();
  return <div className="prose prose-sm max-w-none">{elements}</div>;
}

export default function DebatePage() {
  const {
    debates,
    currentDebateId,
    currentDebate,
    isLoading,
    isStreaming,
    streamingPro,
    streamingCon,
    streamingPhase,
    summary,
    isSummaryStreaming,
    setDebates,
    setCurrentDebateId,
    setCurrentDebate,
    setIsLoading,
    setIsStreaming,
    setStreamingPhase,
    appendStreamingPro,
    appendStreamingCon,
    setSummary,
    appendSummary,
    setIsSummaryStreaming,
    resetStreaming,
    addDebate,
    addRoundToCurrentDebate,
  } = useDebateStore();

  const { selectedProvider, selectedModel } = useSettingsStore();
  
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [newStance, setNewStance] = useState('');
  const [creating, setCreating] = useState(false);
  const [allModels, setAllModels] = useState<ProviderModels[]>([]);
  const [tempProvider, setTempProvider] = useState(selectedProvider);
  const [tempModel, setTempModel] = useState(selectedModel);
  
  const contentRef = useRef<HTMLDivElement>(null);

  // 加载模型列表
  useEffect(() => {
    async function loadModels() {
      try {
        const data = await apiFetch<{ providers: ProviderModels[] }>('/models');
        setAllModels(data.providers);
      } catch (error) {
        console.error('Failed to load models:', error);
      }
    }
    loadModels();
  }, []);

  // 加载辩论列表
  useEffect(() => {
    async function loadDebates() {
      setIsLoading(true);
      try {
        const data = await apiFetch<Debate[]>('/debates');
        setDebates(data);
      } catch (error) {
        toast.error('加载辩论列表失败');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
    loadDebates();
  }, [setDebates, setIsLoading]);

  // 加载辩论详情
  const loadDebateDetail = useCallback(async (id: string) => {
    setIsLoading(true);
    setSummary('');
    resetStreaming();
    try {
      const data = await apiFetch<DebateDetail>(`/debates/${id}`);
      setCurrentDebate(data);
      setCurrentDebateId(id);
    } catch (error) {
      toast.error('加载辩论详情失败');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [setCurrentDebate, setCurrentDebateId, setIsLoading, setSummary, resetStreaming]);

  // 创建辩论
  const handleCreate = useCallback(async () => {
    if (!newTopic.trim() || !newStance.trim()) {
      toast.error('请填写主题和立场');
      return;
    }

    setCreating(true);
    try {
      const debate = await apiFetch<Debate>('/debates', {
        method: 'POST',
        body: JSON.stringify({ topic: newTopic.trim(), user_stance: newStance.trim() }),
      });
      addDebate(debate);
      setShowNewDialog(false);
      setNewTopic('');
      setNewStance('');
      loadDebateDetail(debate.id);
      toast.success('辩论已创建');
    } catch (error) {
      toast.error('创建失败');
      console.error(error);
    } finally {
      setCreating(false);
    }
  }, [newTopic, newStance, addDebate, loadDebateDetail]);

  // 执行辩论轮次（SSE流式）
  const handleNextRound = useCallback(async () => {
    if (!currentDebateId) return;

    const saved = await getApiKey(tempProvider);
    if (!saved?.apiKey) {
      toast.error(`请先在设置中配置 ${tempProvider} 的 API Key`);
      return;
    }

    resetStreaming();
    setIsStreaming(true);
    setStreamingPhase('pro');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': saved.apiKey,
    };
    if (saved.baseUrl) {
      headers['X-Base-URL'] = saved.baseUrl;
    }

    try {
      const response = await fetch(`${API_BASE}/debates/${currentDebateId}/rounds`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: tempModel, provider: tempProvider }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: '请求失败' }));
        throw new Error(error.detail || '请求失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let proContent = '';
      let conContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              // 完成，刷新辩论详情
              await loadDebateDetail(currentDebateId);
              setIsStreaming(false);
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                toast.error(parsed.error);
                setIsStreaming(false);
                return;
              }
              if (parsed.type === 'pro') {
                proContent += parsed.content;
                appendStreamingPro(parsed.content);
              } else if (parsed.type === 'pro_done') {
                setStreamingPhase('con');
              } else if (parsed.type === 'con') {
                conContent += parsed.content;
                appendStreamingCon(parsed.content);
              } else if (parsed.type === 'con_done') {
                // con完成
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '执行辩论失败');
      setIsStreaming(false);
    }
  }, [currentDebateId, tempProvider, tempModel, resetStreaming, setIsStreaming, setStreamingPhase, appendStreamingPro, appendStreamingCon, loadDebateDetail]);

  // 生成总结（SSE流式）
  const handleSummary = useCallback(async () => {
    if (!currentDebateId || !currentDebate?.rounds.length) {
      toast.error('需要至少一轮辩论才能生成总结');
      return;
    }

    const saved = await getApiKey(tempProvider);
    if (!saved?.apiKey) {
      toast.error(`请先在设置中配置 ${tempProvider} 的 API Key`);
      return;
    }

    setSummary('');
    setIsSummaryStreaming(true);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': saved.apiKey,
    };
    if (saved.baseUrl) {
      headers['X-Base-URL'] = saved.baseUrl;
    }

    try {
      const response = await fetch(`${API_BASE}/debates/${currentDebateId}/summary`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: tempModel, provider: tempProvider }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: '请求失败' }));
        throw new Error(error.detail || '请求失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setIsSummaryStreaming(false);
              // 刷新辩论详情获取更新后的状态
              await loadDebateDetail(currentDebateId);
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                toast.error(parsed.error);
                setIsSummaryStreaming(false);
                return;
              }
              if (parsed.content) {
                appendSummary(parsed.content);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '生成总结失败');
      setIsSummaryStreaming(false);
    }
  }, [currentDebateId, currentDebate, tempProvider, tempModel, setSummary, setIsSummaryStreaming, appendSummary, loadDebateDetail]);

  // 滚动到底部
  useEffect(() => {
    if (contentRef.current && (isStreaming || isSummaryStreaming)) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [streamingPro, streamingCon, summary, isStreaming, isSummaryStreaming]);

  const currentModels = allModels.find((p) => p.provider === tempProvider)?.models || [];
  const formatDate = (date: string) => new Date(date).toLocaleDateString('zh-CN');

  return (
    <div className="flex h-full">
      {/* 左侧辩论列表 */}
      <aside className="w-72 border-r bg-muted/30 flex flex-col">
        <div className="p-3 border-b">
          <Button onClick={() => setShowNewDialog(true)} className="w-full" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            新建辩论
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoading && debates.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : debates.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">暂无辩论</p>
            ) : (
              debates.map((debate) => (
                <button
                  key={debate.id}
                  onClick={() => loadDebateDetail(debate.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-md transition-colors',
                    currentDebateId === debate.id
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50'
                  )}
                >
                  <div className="font-medium text-sm truncate">{debate.topic}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={debate.status === 'completed' ? 'secondary' : 'outline'} className="text-xs">
                      {debate.status === 'completed' ? '已结束' : '进行中'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(debate.created_at)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* 右侧内容区 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!currentDebate ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Swords className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>选择或创建一个辩论开始</p>
            </div>
          </div>
        ) : (
          <>
            {/* 头部信息 */}
            <header className="p-4 border-b bg-muted/30">
              <h2 className="text-lg font-semibold">{currentDebate.topic}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium">您的立场：</span>{currentDebate.user_stance}
              </p>
            </header>

            {/* 辩论内容 */}
            <ScrollArea className="flex-1" ref={contentRef}>
              <div className="p-4 space-y-6">
                {/* 已有轮次 */}
                {currentDebate.rounds.map((round) => (
                  <RoundDisplay key={round.id} round={round} />
                ))}

                {/* 流式显示区域 */}
                {isStreaming && (
                  <div className="space-y-4">
                    {streamingPro && (
                      <Card className="border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            正方观点 · 第 {(currentDebate.rounds.length || 0) + 1} 轮
                            {streamingPhase === 'pro' && <Loader2 className="w-4 h-4 animate-spin" />}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm">
                          {renderMarkdown(streamingPro)}
                        </CardContent>
                      </Card>
                    )}
                    {streamingCon && (
                      <Card className="border-l-4 border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-orange-700 dark:text-orange-400 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            反方观点 · 第 {(currentDebate.rounds.length || 0) + 1} 轮
                            {streamingPhase === 'con' && <Loader2 className="w-4 h-4 animate-spin" />}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm">
                          {renderMarkdown(streamingCon)}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* 总结区域 */}
                {(summary || isSummaryStreaming) && (
                  <Card className="border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        辩论总结
                        {isSummaryStreaming && <Loader2 className="w-4 h-4 animate-spin" />}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      {renderMarkdown(summary)}
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>

            {/* 底部操作栏 */}
            <footer className="p-4 border-t bg-muted/30">
              <div className="flex items-center gap-3">
                {/* 模型选择 */}
                <Select value={tempProvider} onValueChange={(v) => v && setTempProvider(v)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allModels.map((p) => (
                      <SelectItem key={p.provider} value={p.provider}>
                        {p.provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={tempModel} onValueChange={(v) => v && setTempModel(v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentModels.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex-1" />

                {/* 操作按钮 */}
                <Button
                  onClick={handleNextRound}
                  disabled={isStreaming || isSummaryStreaming || currentDebate.status === 'completed'}
                >
                  {isStreaming ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="w-4 h-4 mr-2" />
                  )}
                  下一轮辩论
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSummary}
                  disabled={isStreaming || isSummaryStreaming || !currentDebate.rounds.length}
                >
                  {isSummaryStreaming ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  生成总结
                </Button>
              </div>
            </footer>
          </>
        )}
      </main>

      {/* 新建辩论Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建辩论</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">辩论主题</label>
              <Input
                placeholder="例如：人工智能是否会取代人类工作"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium">您的立场/观点</label>
              <Textarea
                placeholder="例如：AI会创造更多新工作机会，而非完全取代"
                value={newStance}
                onChange={(e) => setNewStance(e.target.value)}
                className="mt-1.5"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 辩论轮次展示组件
function RoundDisplay({ round }: { round: DebateRound }) {
  return (
    <div className="space-y-4">
      {/* 正方 */}
      <Card className="border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            正方观点 · 第 {round.round_number} 轮
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {renderMarkdown(round.pro_argument || '')}
        </CardContent>
      </Card>

      {/* 反方 */}
      <Card className="border-l-4 border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-orange-700 dark:text-orange-400 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            反方观点 · 第 {round.round_number} 轮
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {renderMarkdown(round.con_argument || '')}
        </CardContent>
      </Card>
    </div>
  );
}
