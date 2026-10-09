import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Supabase env vars missing — using mock data')
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '')

// ─── Knowledge base helpers ──────────────────────────────────────────────────

export async function getKnowledgeItems() {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) { console.error('getKnowledgeItems:', error); return [] }
  return data
}

export async function saveKnowledgeItem(item) {
  if (item.id) {
    const { error } = await supabase
      .from('knowledge_base')
      .update({ title: item.title, content: item.content, category: item.category, active: item.active, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('knowledge_base')
      .insert({ title: item.title, content: item.content, category: item.category, active: item.active })
    if (error) throw error
  }
}

export async function deleteKnowledgeItem(id) {
  const { error } = await supabase.from('knowledge_base').delete().eq('id', id)
  if (error) throw error
}

// ─── Leads helpers ───────────────────────────────────────────────────────────

export async function getLeads(channel) {
  let query = supabase.from('leads').select('*').order('created_at', { ascending: false })
  if (channel) query = query.eq('channel', channel)
  const { data, error } = await query
  if (error) { console.error('getLeads:', error); return [] }
  return data
}

export async function upsertLead(lead) {
  const { error } = await supabase.from('leads').upsert(lead)
  if (error) throw error
}

export async function updateLeadStatus(id, status) {
  const { error } = await supabase.from('leads').update({ status }).eq('id', id)
  if (error) throw error
}

// ─── Conversations helpers ───────────────────────────────────────────────────

export async function getConversations(leadId) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })
  if (error) { console.error('getConversations:', error); return [] }
  return data
}

export async function insertMessage(msg) {
  const { error } = await supabase.from('conversations').insert(msg)
  if (error) throw error
}

// ─── AI query logs ───────────────────────────────────────────────────────────

export async function logAiQuery(entry) {
  const { error } = await supabase.from('ai_query_logs').insert(entry)
  if (error) console.error('logAiQuery:', error)
}

export async function getAiLogs() {
  const { data, error } = await supabase
    .from('ai_query_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) { console.error('getAiLogs:', error); return [] }
  return data
}
