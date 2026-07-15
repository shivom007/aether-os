import { LegalPage } from "@/app/_components/marketing-page"

export const metadata = {
  title: "Privacy | Aether-OS",
  description: "How Aether-OS handles account, provider, metadata, and encrypted file information.",
}

export default function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="Aether is designed to coordinate encrypted storage while minimizing what the service needs to know about your files."
      updated="June 1, 2026"
      sections={[
        {
          title: "Information we collect",
          body: (
            <>
              <p>We collect the account information needed to authenticate you, such as email address and password credentials.</p>
              <p>When you connect storage providers, Aether stores the provider metadata and encrypted credentials needed to perform the actions you request.</p>
              <p>We also store operational metadata such as file names, sizes, volume records, shard placement, provider status, worker state, and reconstruction data.</p>
            </>
          ),
        },
        {
          title: "File content and encryption",
          body: (
            <>
              <p>File content is intended to be encrypted client-side before storage operations place data with linked providers.</p>
              <p>The backend coordinates encrypted chunks, erasure-coded shards, and metadata needed for upload, download, and recovery workflows.</p>
              <p>Aether cannot recover a lost passphrase or decrypt user-held encrypted data without the required user-controlled material.</p>
            </>
          ),
        },
        {
          title: "How information is used",
          body: (
            <>
              <p>We use account and operational data to provide authentication, provider connections, volume browsing, upload processing, shard placement, recovery, observability, and support.</p>
              <p>Provider credentials are used only to perform storage actions on your behalf, such as uploading, reading, deleting, or checking health for provider-hosted shard objects.</p>
            </>
          ),
        },
        {
          title: "Security practices",
          body: (
            <>
              <p>Backend deployments require explicit authentication and provider encryption secrets. Provider credentials are protected at rest using a dedicated encryption key.</p>
              <p>All production communication should be served over HTTPS. Operational access should be limited to people and systems that need it to keep the service running.</p>
            </>
          ),
        },
        {
          title: "Contact",
          body: (
            <p>
              Questions about privacy or data handling can be sent to{" "}
              <a href="mailto:hello@aether-os.dev" className="text-emerald-300 hover:text-emerald-200">
                hello@aether-os.dev
              </a>
              .
            </p>
          ),
        },
      ]}
    />
  )
}
