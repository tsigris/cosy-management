import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eytpewhenrnoueipjmuk.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5dHBld2hlbnJub3VlaXBqbXVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNjA0MTIsImV4cCI6MjA4NTkzNjQxMn0.fsaHjnY4o49_jUAvm5rlmuVfSOBNBO8Zporc60wwqZk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)