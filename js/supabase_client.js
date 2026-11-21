// Centralized Supabase Client Configuration
const SUPABASE_URL = 'https://hwddmjolzmdurijaitia.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3ZGRtam9sem1kdXJpamFpdGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMzYyNDcsImV4cCI6MjA5MjcxMjI0N30.qC4F-PSpWqHBHFhXAADNyIyyUNJ_P05N4j-Zxoz3hkU';

// Initialize Supabase Client
if (window.supabase) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // Assign to window.supabase for legacy code compatibility that calls supabase.from directly
    window.supabase = window.supabaseClient;
    console.log('Supabase client successfully initialized.');
} else {
    console.error('Supabase JS SDK not loaded before supabase_client.js');
}
