import { supabase } from './supabase';

interface EmbeddingMetadata {
  source: string;
  type: 'faq' | 'product' | 'policy' | 'scenario';
  category?: string;
}

interface MatchEmbeddingsParams {
  query_embedding: number[];
  match_threshold: number;
  match_count: number;
  filter?: {
    type: EmbeddingMetadata['type'];
  };
}

export const addToKnowledgeBase = async (
  userUID: string,
  content: string,
  metadata: EmbeddingMetadata
) => {
  try {
    const { data, error } = await supabase
      .from(`${userUID}_embeddings`)
      .insert([
        {
          content,
          metadata,
          embedding: await generateEmbedding(content)
        }
      ]);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding to knowledge base:', error);
    throw error;
  }
};

export const searchKnowledgeBase = async (
  userUID: string,
  query: string,
  type?: EmbeddingMetadata['type'],
  limit: number = 5
) => {
  try {
    const queryEmbedding = await generateEmbedding(query);

    let rpcQuery: MatchEmbeddingsParams = {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: limit
    };

    if (type) {
      rpcQuery = {
        ...rpcQuery,
        filter: { type }
      };
    }

    const { data, error } = await supabase
      .rpc('match_embeddings', rpcQuery);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    throw error;
  }
};

export const deleteFromKnowledgeBase = async (
  userUID: string,
  id: number
) => {
  try {
    const { error } = await supabase
      .from(`${userUID}_embeddings`)
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting from knowledge base:', error);
    throw error;
  }
};

export const updateKnowledgeBaseItem = async (
  userUID: string,
  id: number,
  content: string,
  metadata: Partial<EmbeddingMetadata>
) => {
  try {
    const { error } = await supabase
      .from(`${userUID}_embeddings`)
      .update({
        content,
        metadata,
        embedding: await generateEmbedding(content)
      })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating knowledge base item:', error);
    throw error;
  }
};

const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-3-small'
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}; 