import { LegalPage } from "@/app/_components/marketing-page"

export const metadata = {
  title: "Terms | Aether-OS",
  description: "Aether-OS service terms for encrypted cloud aggregation and connected provider use.",
}

export default function TermsOfService() {
  return (
    <LegalPage
      title="Terms of Service"
      subtitle="These terms describe the boundaries of using Aether as a private storage control layer across providers you connect."
      updated="June 1, 2026"
      sections={[
        {
          title: "Acceptance",
          body: (
            <p>
              By accessing or using Aether-OS, you agree to these terms. If you do not agree, you should not access the service or connect provider accounts.
            </p>
          ),
        },
        {
          title: "Service description",
          body: (
            <>
              <p>Aether-OS is a cloud storage control layer for encrypted volumes, provider connections, shard placement, upload processing, and recovery workflows.</p>
              <p>The service is designed to coordinate encrypted data across third-party storage providers that you authorize or configure.</p>
            </>
          ),
        },
        {
          title: "Your responsibilities",
          body: (
            <>
              <p>You are responsible for maintaining your account, password, volume passphrases, provider accounts, and provider credentials.</p>
              <p>You must comply with the terms and policies of any third-party provider you connect. Provider account limits, suspensions, outages, or deletions may affect data availability.</p>
              <p>You may not use Aether for illegal activity, abusive storage behavior, credential misuse, or attempts to compromise the service or connected providers.</p>
            </>
          ),
        },
        {
          title: "Data and recovery",
          body: (
            <>
              <p>Aether coordinates encrypted chunks and shards. Recovery depends on sufficient available shards and the user-controlled material required to decrypt files.</p>
              <p>If you lose the required passphrase or recovery material, Aether may be unable to restore plaintext file content.</p>
            </>
          ),
        },
        {
          title: "Availability and warranty",
          body: (
            <>
              <p>The service is provided on an "AS IS" and "AS AVAILABLE" basis. Storage providers, network conditions, worker queues, and account limits may affect service behavior.</p>
              <p>Aether disclaims warranties to the maximum extent permitted by law, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.</p>
            </>
          ),
        },
        {
          title: "Contact",
          body: (
            <p>
              Questions about these terms can be sent to{" "}
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
