import { supabase } from './supabase.js';

const CATEGORY_KEYWORDS = [
  { key: 'เหล็ก', label: 'เหล็ก' },
  { key: 'ปูน', label: 'ปูน' },
  { key: 'ไม้', label: 'ไม้' },
  { key: 'ท่อ', label: 'ท่อ' },
];

export function categorize(name) {
  const hit = CATEGORY_KEYWORDS.find(c => name.includes(c.key));
  return hit ? hit.label : 'อื่นๆ';
}

// Categories are user-defined (stored per-material). This is just the seed
// list offered before any custom ones exist.
export const DEFAULT_CATEGORIES = [...CATEGORY_KEYWORDS.map(c => c.label), 'อื่นๆ'];

export function distinctCategories(materials) {
  const set = new Set(DEFAULT_CATEGORIES);
  materials.forEach(m => { if (m.category) set.add(m.category); });
  return Array.from(set).sort();
}

export async function fetchMaterials() {
  const { data, error } = await supabase.from('materials').select('*').order('name');
  if (error) throw error;
  return (data || []).map(m => ({ ...m, category: m.category || categorize(m.name) }));
}

export async function fetchProjects() {
  const { data, error } = await supabase.from('projects').select('*').order('name');
  if (error) throw error;
  return data || [];
}

export async function fetchContractors() {
  const { data, error } = await supabase.from('contractors').select('*').order('name');
  if (error) throw error;
  return data || [];
}

export async function fetchRequesters() {
  const { data, error } = await supabase.from('requesters').select('*').order('name');
  if (error) throw error;
  return data || [];
}

export async function findOrCreateByName(table, name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return null;
  const { data: existing } = await supabase.from(table).select('*').eq('name', trimmed).maybeSingle();
  if (existing) return existing;
  const { data: created, error } = await supabase.from(table).insert({ name: trimmed }).select().single();
  if (error) throw error;
  return created;
}

export function docNo(prefix) {
  const yearBE = new Date().getFullYear() + 543;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${yearBE}-${rand}`;
}
