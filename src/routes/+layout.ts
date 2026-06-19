import { createSupabaseBrowserClient } from '$lib/supabase/client';
import { isBrowser } from '@supabase/ssr';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data, depends }) => {
	depends('supabase:auth');

	const supabase = isBrowser() ? createSupabaseBrowserClient() : null;

	return { supabase, session: data.session, user: data.user };
};
