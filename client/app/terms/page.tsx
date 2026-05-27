export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto p-8 prose prose-invert prose-blue">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>
      
      <h2 className="text-2xl font-semibold mt-8 mb-4">1. Acceptance of Terms</h2>
      <p className="mb-4">
        By accessing or using Project Aether, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, then you may not access the service.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">2. Description of Service</h2>
      <p className="mb-4">
        Project Aether is a unified cloud storage dashboard that allows users to connect their own third-party storage providers (like Google Drive, Dropbox, and AWS S3) to pool storage capacity using erasure coding.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">3. User Responsibilities</h2>
      <p className="mb-4">
        You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account. You also agree not to use the service for any illegal or unauthorized purpose.
      </p>
      <p className="mb-4">
        You must comply with the Terms of Service of any third-party storage provider you link to Project Aether. Aether is not responsible for any bans or data loss incurred on those third-party platforms.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">4. "As Is" Warranty</h2>
      <p className="mb-4">
        The service is provided on an "AS IS" and "AS AVAILABLE" basis. Aether makes no warranties, expressed or implied, and hereby disclaims all warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property.
      </p>
    </div>
  )
}
