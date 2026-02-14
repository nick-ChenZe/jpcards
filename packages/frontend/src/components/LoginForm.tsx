import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Field, FieldDescription, FieldGroup, FieldLabel} from '@/components/ui/field';
import {Input} from '@/components/ui/input';
import {authClient} from '@/lib/auth';
import {cn} from '@/lib/utils';
import {useCallback, useEffect} from 'react';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import {toast} from 'sonner';

export function LoginForm ({
    className,
    ...props
}: React.ComponentProps<'div'>) {
    const navigate = useNavigate();
    const location = useLocation();
    const from = (location.state as {from?: {pathname: string;};})?.from?.pathname ?? '/';

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
                toast.success('  signed in');
                navigate('/', {replace: true});
            }
        },
        [navigate, from]
    );

    return (
        <div className={cn('flex flex-col gap-6 w-[400px]', className)} {...props}>
            <Card>
                <CardHeader className="text-center">
                    <CardTitle className="text-xl">Welcome back</CardTitle>
                    <CardDescription>Login to your account</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit}>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="username">Username</FieldLabel>
                                <Input
                                    id="username"
                                    name="username"
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
                                    name="password"
                                    type="password"
                                    required
                                    placeholder="********"
                                />
                            </Field>
                            <Field>
                                <Button type="submit">Login</Button>
                                <FieldDescription className="text-center">
                                    Don&apos;t have an account?{' '}
                                    <Link to="/sign-up" className="underline underline-offset-4 hover:text-primary">
                                        Sign up
                                    </Link>
                                </FieldDescription>
                            </Field>
                        </FieldGroup>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
