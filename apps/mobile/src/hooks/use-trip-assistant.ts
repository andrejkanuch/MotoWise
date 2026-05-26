import {
  AskTripAssistantDocument,
  type AskTripAssistantMutation,
  type AskTripAssistantMutationVariables,
  AssistantMessageRole,
} from '@motovault/graphql';
import { useMutation } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useCallback, useState } from 'react';
import { gqlFetcher } from '../lib/graphql-client';
import { useProGate } from './use-pro-gate';

/**
 * Trip-context AI assistant. Wraps the `askTripAssistant` GraphQL mutation and
 * keeps a local message history so consumers can render a chat-style UI.
 */

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

const makeId = () => Crypto.randomUUID();

export function useTripAssistant(tripId: string | undefined) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const { requirePro } = useProGate();

  const mutation = useMutation<AskTripAssistantMutation, Error, string>({
    mutationFn: async (question: string) => {
      if (!tripId) throw new Error('Missing tripId');
      const history = messages.slice(-16).map((m) => ({
        role: m.role === 'assistant' ? AssistantMessageRole.Assistant : AssistantMessageRole.User,
        content: m.content,
      }));
      const variables: AskTripAssistantMutationVariables = {
        input: { tripId, question, history },
      };
      return gqlFetcher(AskTripAssistantDocument, variables);
    },
  });

  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || !tripId) return;
      const userMsg: AssistantMessage = {
        id: makeId(),
        role: 'user',
        content: question,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      try {
        const res = await mutation.mutateAsync(question);
        const aiMsg: AssistantMessage = {
          id: makeId(),
          role: 'assistant',
          content: res.askTripAssistant.message,
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        if (err instanceof Error && /free plan allows|upgrade to pro/i.test(err.message)) {
          requirePro('trip_assistant');
          return;
        }
        const errorMsg: AssistantMessage = {
          id: makeId(),
          role: 'assistant',
          content:
            err instanceof Error
              ? `Something went wrong: ${err.message}`
              : "Something went wrong — I couldn't answer that.",
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    },
    [mutation, requirePro, tripId],
  );

  const reset = useCallback(() => setMessages([]), []);

  return {
    messages,
    ask,
    reset,
    isPending: mutation.isPending,
  };
}
