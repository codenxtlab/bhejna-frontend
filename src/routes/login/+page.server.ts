import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
    default: async ({ request, locals }) => {
        const formData = await request.formData();
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;
        const isSignUp = formData.get('isSignUp') === 'true';

        if (!email || !password) {
            return fail(400, { message: 'Email and password are required', email: email ?? '' });
        }

        if (isSignUp) {
            const { data, error } = await locals.supabase.auth.signUp({
                email,
                password
            });

            if (error) {
                return fail(400, { message: error.message, email });
            }

            if (!data.session) {
                return { message: 'Check your email to confirm your account!', email };
            }
        } else {
            const { error } = await locals.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                return fail(400, { message: error.message, email });
            }
        }

        // Only redirects AFTER cookies are successfully set by the server
        throw redirect(303, '/dashboard');
    }
};
