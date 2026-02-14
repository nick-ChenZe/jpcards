import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Field, FieldDescription, FieldGroup, FieldLabel} from '@/components/ui/field';
import {Input} from '@/components/ui/input';
import {authClient} from '@/lib/auth';
import {cn} from '@/lib/utils';
import {useCallback} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {toast} from 'sonner';

export function SignUpForm ({
    className,
    ...props
}: React.ComponentProps<'div'>) {
    const navigate = useNavigate();

    const handleSubmit = useCallback(
        async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const target = e.target as HTMLFormElement;
            const res = await authClient.signUp.email({
                email: target.email.value,
                name: target.name.value,
                password: target.password.value,
                username: target.username.value || undefined
            });

            if (res.error) {
                toast.error('Sign up failed', {description: res.error.message});
            } else {
                toast.success('Account created successfully');
                navigate('/');
            }
        },
        [navigate]
    );

    return (
        <div className={cn('flex flex-col gap-6 w-[400px]', className)} {...props}>
            <Card>
                <CardHeader className="text-center">
                    <CardTitle className="text-xl">Create an account</CardTitle>
                    <CardDescription>Sign up to get started</CardDescription>
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
                                <FieldLabel htmlFor="name">Name</FieldLabel>
                                <Input
                                    id="name"
                                    name="name"
                                    placeholder="Your name"
                                    required
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="email">Email</FieldLabel>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="email@example.com"
                                    required
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="password">Password</FieldLabel>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    placeholder="********"
                                />
                            </Field>
                            <Field>
                                <Button type="submit">Sign up</Button>
                                <FieldDescription className="text-center">
                                    Already have an account?{' '}
                                    <Link to="/login" className="underline underline-offset-4 hover:text-primary">
                                        Log in
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
