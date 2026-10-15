import DirectoryPageLayout from '../layouts/DirectoryPageLayout';

function NotFoundPage() {
  return (
    <DirectoryPageLayout title="Page not found" description="The page you are looking for does not exist or has moved.">
      <p className="directory-empty">
        <a href="/">Go to the home page</a>
      </p>
    </DirectoryPageLayout>
  );
}

export default NotFoundPage;
