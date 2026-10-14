import AuthPageLayout from '../layouts/AuthPageLayout';
import LoginForm from '../components/auth/LoginForm';

function LoginPage() {
  return (
    <AuthPageLayout>
      <LoginForm />
    </AuthPageLayout>
  );
}

export default LoginPage;
