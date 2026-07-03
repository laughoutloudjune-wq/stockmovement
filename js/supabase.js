import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pnycjpmnjusocmeaawfd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_3-07doE-etejJ44IoMMZnQ_5iwkULN6';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
