import { create } from 'zustand';

// Types
export interface DebateRound {
  id: string;
  debate_id: string;
  round_number: number;
  pro_argument: string | null;
  con_argument: string | null;
  created_at: string;
}

export interface Debate {
  id: string;
  topic: string;
  user_stance: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DebateDetail extends Debate {
  rounds: DebateRound[];
}

interface DebateStore {
  debates: Debate[];
  currentDebateId: string | null;
  currentDebate: DebateDetail | null;
  isLoading: boolean;
  isStreaming: boolean;
  streamingPro: string;
  streamingCon: string;
  streamingPhase: 'idle' | 'pro' | 'con';
  summary: string;
  isSummaryStreaming: boolean;
  
  // Actions
  setDebates: (debates: Debate[]) => void;
  setCurrentDebateId: (id: string | null) => void;
  setCurrentDebate: (debate: DebateDetail | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsStreaming: (streaming: boolean) => void;
  setStreamingPro: (content: string) => void;
  appendStreamingPro: (content: string) => void;
  setStreamingCon: (content: string) => void;
  appendStreamingCon: (content: string) => void;
  setStreamingPhase: (phase: 'idle' | 'pro' | 'con') => void;
  setSummary: (summary: string) => void;
  appendSummary: (content: string) => void;
  setIsSummaryStreaming: (streaming: boolean) => void;
  resetStreaming: () => void;
  addDebate: (debate: Debate) => void;
  addRoundToCurrentDebate: (round: DebateRound) => void;
}

export const useDebateStore = create<DebateStore>((set) => ({
  debates: [],
  currentDebateId: null,
  currentDebate: null,
  isLoading: false,
  isStreaming: false,
  streamingPro: '',
  streamingCon: '',
  streamingPhase: 'idle',
  summary: '',
  isSummaryStreaming: false,
  
  setDebates: (debates) => set({ debates }),
  setCurrentDebateId: (id) => set({ currentDebateId: id }),
  setCurrentDebate: (debate) => set({ currentDebate: debate }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  setStreamingPro: (content) => set({ streamingPro: content }),
  appendStreamingPro: (content) => set((state) => ({ streamingPro: state.streamingPro + content })),
  setStreamingCon: (content) => set({ streamingCon: content }),
  appendStreamingCon: (content) => set((state) => ({ streamingCon: state.streamingCon + content })),
  setStreamingPhase: (phase) => set({ streamingPhase: phase }),
  setSummary: (summary) => set({ summary }),
  appendSummary: (content) => set((state) => ({ summary: state.summary + content })),
  setIsSummaryStreaming: (streaming) => set({ isSummaryStreaming: streaming }),
  resetStreaming: () => set({ 
    streamingPro: '', 
    streamingCon: '', 
    streamingPhase: 'idle',
    isStreaming: false 
  }),
  addDebate: (debate) => set((state) => ({ debates: [debate, ...state.debates] })),
  addRoundToCurrentDebate: (round) => set((state) => ({
    currentDebate: state.currentDebate 
      ? { ...state.currentDebate, rounds: [...state.currentDebate.rounds, round] }
      : null
  })),
}));
