/**
 * storage-adapters public entrypoint (consolidated scaffold).
 */

export type ProviderId = 'google_drive' | 'onedrive' | 'dropbox' | 'mega';

export interface ProviderRegistryEntry {
  id: ProviderId;
  displayName: string;
  enabled: boolean;
}

export const providerRegistry: ProviderRegistryEntry[] = [
  { id: 'google_drive', displayName: 'Google Drive', enabled: true },
  { id: 'onedrive', displayName: 'OneDrive', enabled: false },
  { id: 'dropbox', displayName: 'Dropbox', enabled: false },
  { id: 'mega', displayName: 'MEGA', enabled: false }
];
