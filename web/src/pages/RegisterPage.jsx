import AuthPageLayout from '../layouts/AuthPageLayout';
import RegisterForm from '../components/auth/RegisterForm';

function RegisterPage() {
  return (
    <AuthPageLayout>
      <RegisterForm />
    </AuthPageLayout>
  );
}

export default RegisterPage;
