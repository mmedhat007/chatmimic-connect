// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.land/manual/examples/supabase

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the request body
    const { uid } = await req.json()

    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      // Supabase API URL - env var exported by default.
      Deno.env.get('SUPABASE_URL') ?? '',
      // Supabase API ANON KEY - env var exported by default.
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      // Create client with Auth context of the user that called the function.
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Create the main table
    const { error: createError } = await supabaseClient.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS "${uid}" (
          id SERIAL PRIMARY KEY,
          company_info JSONB,
          roles JSONB,
          communication_style JSONB,
          scenarios JSONB,
          knowledge_base JSONB,
          compliance_rules JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `
    })

    if (createError) {
      console.error('Error creating table:', createError)
      return new Response(
        JSON.stringify({ error: 'Error creating table', details: createError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Create the embeddings table
    const { error: createEmbeddingsError } = await supabaseClient.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS "${uid}_embeddings" (
          id SERIAL PRIMARY KEY,
          content TEXT,
          embedding VECTOR(1536),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `
    })

    if (createEmbeddingsError) {
      console.error('Error creating embeddings table:', createEmbeddingsError)
      return new Response(
        JSON.stringify({ error: 'Error creating embeddings table', details: createEmbeddingsError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Create the WhatsApp configuration table
    const { error: createWhatsAppConfigError } = await supabaseClient.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS "${uid}_whatsapp_config" (
          id SERIAL PRIMARY KEY,
          phone_number_id TEXT,
          whatsapp_business_account_id TEXT,
          access_token TEXT,
          verify_token TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `
    })

    if (createWhatsAppConfigError) {
      console.error('Error creating WhatsApp config table:', createWhatsAppConfigError)
      return new Response(
        JSON.stringify({ error: 'Error creating WhatsApp config table', details: createWhatsAppConfigError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}) 