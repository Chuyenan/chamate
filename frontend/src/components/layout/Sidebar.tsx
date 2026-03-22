'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Swords, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ConversationList } from '@/components/chat/ConversationList';
import { useConversationStore, Conversation } from '@/stores/conversation-store';
import { apiFetch } from '@/lib/api';

const navItems = [
  { href: '/', label: '对话', icon: MessageSquare },
  { href: '/debate', label: '辩论', icon: Swords },
  { href: '/settings', label: '设置', icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  const {
    conversations,
    currentConversationId,
    setConversations,
    setCurrentConversationId,
    setMessages,
  } = useConversationStore();

  // Fetch conversations on mount and when on home page
  useEffect(() => {
    if (isHomePage) {
      fetchConversations();
    }
  }, [isHomePage]);

  const fetchConversations = async () => {
    try {
      const data = await apiFetch<Conversation[]>('/conversations');
      const converted = data.map(conv => ({
        ...conv,
        createdAt: (conv as unknown as { created_at: string }).created_at,
        updatedAt: (conv as unknown as { updated_at: string }).updated_at,
      }));
      setConversations(converted);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  };

  const handleSelectConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
  }, [setCurrentConversationId]);

  const handleCreateConversation = useCallback(async () => {
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
      setMessages([]);
    } catch (error) {
      toast.error('创建会话失败');
      console.error(error);
    }
  }, [conversations, setConversations, setCurrentConversationId, setMessages]);

  const handleRenameConversation = useCallback(async (id: string, newTitle: string) => {
    try {
      await apiFetch(`/conversations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: newTitle }),
      });
      setConversations(
        conversations.map(c => c.id === id ? { ...c, title: newTitle } : c)
      );
      toast.success('重命名成功');
    } catch (error) {
      toast.error('重命名失败');
      console.error(error);
    }
  }, [conversations, setConversations]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    try {
      await apiFetch(`/conversations/${id}`, { method: 'DELETE' });
      setConversations(conversations.filter(c => c.id !== id));
      if (currentConversationId === id) {
        setCurrentConversationId(null);
        setMessages([]);
      }
      toast.success('删除成功');
    } catch (error) {
      toast.error('删除失败');
      console.error(error);
    }
  }, [conversations, currentConversationId, setConversations, setCurrentConversationId, setMessages]);

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">C</span>
          </div>
          {!collapsed && (
            <span className="font-semibold text-sidebar-foreground">Chamate</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href));
          
          const linkElement = (
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={linkElement} />
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.href}>{linkElement}</div>;
        })}
      </nav>

      {/* Conversation List (only on home page) */}
      {isHomePage && !collapsed && (
        <>
          <Separator className="my-2" />
          <div className="flex-1 overflow-hidden">
            <ConversationList
              conversations={conversations}
              currentConversationId={currentConversationId}
              onSelect={handleSelectConversation}
              onCreate={handleCreateConversation}
              onRename={handleRenameConversation}
              onDelete={handleDeleteConversation}
              collapsed={collapsed}
            />
          </div>
        </>
      )}

      {/* Spacer for non-home pages */}
      {(!isHomePage || collapsed) && <div className="flex-1" />}

      {/* Collapse Button */}
      <div className="p-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn('w-full', collapsed ? 'justify-center' : 'justify-start')}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 mr-2" />
              <span>收起</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
