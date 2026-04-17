import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { useMutation } from '@tanstack/react-query';
import { parse } from 'graphql';
import { useCallback, useState } from 'react';
import { gqlFetcher } from '../lib/graphql-client';

/**
 * Trip-context AI assistant.
 *
 * The resolver is GraphQL (`askTripAssistant`) but the generated client type
 * isn't checked in yet — we parse the query inline and cast to
 * `TypedDocumentNode` so the app compiles before the next `pnpm generate`.
 * Swap to `AskTripAssistantDocument` from `@motovault/graphql` once generated.
 */

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

interface MutationData {
  askTripAssistant: {
    message: string;
    inputTokens: number | null;
    outputTokens: number | null;
  };
}

interface MutationVars {
  input: {
    tripId: string;
    question: string;
    history?: Array<{ role: string; content: string }>;
  };
}

const AskTripAssistantDocument = parse(/* GraphQL */ `
  mutation AskTripAssistant($input: AskTripAssistantInput!) {
    askTripAssistant(input: $input) {
      message
      inputTokens
      outputTokens
    }
  }
`) as TypedDocumentNode<MutationData, MutationVars>;

let nextId = 1;
const makeId = () => `m_${nextId++}_${Date.now()}`;

export function useTripAssistant(tripId: string | undefined) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);

  const mutation = useMutation({
    mutationFn: async (question: string) => {
      if (!tripId) throw new Error('Missing tripId');
      const history = messages
        .slice(-16)
        .map((m) => ({ role: m.role, content: m.content }));
      return gqlFetcher(AskTripAssistantDocument, {
        input: { tripId, question, history },
      });
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
    [mutation, tripId],
  );

  const reset = useCallback(() => setMessages([]), []);

  return {
    messages,
    ask,
    reset,
    isPending: mutation.isPending,
  };
}
