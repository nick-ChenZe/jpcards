import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Field, FieldDescription, FieldGroup, FieldLabel} from '@/components/ui/field';
import {Input} from '@/components/ui/input';
import {cn} from '@/lib/utils';
import {usernameClient} from 'better-auth/client/plugins';
import {createAuthClient} from 'better-auth/react';
import {useCallback} from 'react';
import {toast} from 'sonner';

const authClient = createAuthClient({
    plugins: [
        usernameClient()
    ]
});

export function LoginForm ({
    className,
    ...props
}: React.ComponentProps<'div'>) {
    const handleSubmit = useCallback(
        async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const target = e.target as HTMLFormElement;
            const res = await authClient.signIn.username({
                username: target.username.value,
                password: target.password.value
            });
            if (res.error) {
                toast.error('Login failed', {description: res.error.message});
            } else {
                toast.success('Successfully signed in');
            }
        },
        []
    );

    return (
        <div className={cn('flex flex-col gap-6 w-[400px]', className)} {...props}>
            <Card>
                <CardHeader className="text-center">
                    <CardTitle className="text-xl">Welcome back</CardTitle>
                    <CardDescription>
                        Login to your account
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit}>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="username">Username</FieldLabel>
                                <Input
                                    id="username"
                                    placeholder="Username"
                                    required
                                />
                            </Field>
                            <Field>
                                <div className="flex items-center">
                                    <FieldLabel htmlFor="password">Password</FieldLabel>
                                    <a
                                        href="#"
                                        className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                                    >
                                        Forgot your password?
                                    </a>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    placeholder="********"
                                />
                            </Field>
                            <Field>
                                <Button type="submit">Login</Button>
                                <FieldDescription className="text-center">
                                    Don&apos;t have an account? <a href="#">Sign up</a>
                                </FieldDescription>
                            </Field>
                        </FieldGroup>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
