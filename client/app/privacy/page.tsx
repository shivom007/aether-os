export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto p-8 prose prose-invert prose-blue">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>
      
      <h2 className="text-2xl font-semibold mt-8 mb-4">1. Information We Collect</h2>
      <p className="mb-4">
        When you use Project Aether, we collect basic information needed to provide the service. This includes:
      </p>
      <ul className="list-disc pl-6 mb-6">
        <li>Account information (email address, password)</li>
        <li>Authentication tokens for linked providers (Google Drive, Dropbox, AWS)</li>
        <li>Metadata about the files you store (filenames, sizes, chunk distributions)</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">2. How We Use Your Information</h2>
      <p className="mb-4">
        We use this information exclusively to provide the Project Aether unified storage service. The file content itself is encrypted client-side or split into erasure-coded shards before being uploaded to your linked providers. Aether's central servers only store the metadata needed to reassemble those files.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">3. Data Security</h2>
      <p className="mb-4">
        All API communication is secured via HTTPS. Your provider OAuth tokens are stored securely in our database and are only used on your behalf to process your direct upload/download requests.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">4. Contact Us</h2>
      <p className="mb-4">
        If you have any questions about this Privacy Policy, please contact the repository maintainer.
      </p>
    </div>
  )
}
