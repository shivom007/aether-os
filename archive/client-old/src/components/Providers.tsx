import { useState, useEffect } from 'react';
import { ApiClient } from '../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Cloud, Link as LinkIcon, Unlink, Server, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Providers({ onLog }: { onLog: (msg: string) => void }) {
  const [providers, setProviders] = useState<any[]>([]);
  const [showAWSForm, setShowAWSForm] = useState(false);
  const [awsForm, setAwsForm] = useState({ accessKey: '', secretKey: '', region: '', bucket: '' });

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const p = await ApiClient.getProviders();
      setProviders(p);
    } catch (e: any) {
      onLog('Failed to load providers: ' + e.message);
    }
  };

  const handleLinkAWS = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApiClient.linkAWS(awsForm);
      onLog('AWS S3 linked successfully');
      setShowAWSForm(false);
      loadProviders();
    } catch (e: any) {
      onLog('Failed to link AWS: ' + e.message);
    }
  };

  const handleUnlink = async (id: number) => {
    try {
      await ApiClient.unlinkProvider(id);
      onLog('Provider unlinked successfully');
      loadProviders();
    } catch (e: any) {
      onLog('Failed to unlink provider: ' + e.message);
    }
  };

  const startOAuth = (provider: 'google' | 'dropbox') => {
    const token = localStorage.getItem('token');
    window.location.href = `http://localhost:8080/api/v1/providers/${provider}/auth?token=${token}`;
  };

  return (
    <Card className="border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl overflow-hidden mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="w-5 h-5 text-emerald-400" />
          Storage Providers
        </CardTitle>
        <CardDescription>
          Link your cloud accounts to distribute zero-knowledge shards. If no accounts are linked, local mock storage is used.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => startOAuth('google')} variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10">
            <LinkIcon className="w-4 h-4 mr-2" /> Link Google Drive
          </Button>
          <Button onClick={() => startOAuth('dropbox')} variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10">
            <LinkIcon className="w-4 h-4 mr-2" /> Link Dropbox
          </Button>
          <Button onClick={() => setShowAWSForm(!showAWSForm)} variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10">
            <Server className="w-4 h-4 mr-2" /> Link AWS S3
          </Button>
        </div>

        <AnimatePresence>
          {showAWSForm && (
            <motion.form 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleLinkAWS} 
              className="space-y-4 p-4 rounded-lg bg-white/5 border border-white/10 overflow-hidden"
            >
              <h3 className="text-sm font-medium">AWS S3 Credentials</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Access Key ID</Label>
                  <Input 
                    value={awsForm.accessKey} 
                    onChange={e => setAwsForm({...awsForm, accessKey: e.target.value})} 
                    className="bg-black/20 border-white/10"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secret Access Key</Label>
                  <Input 
                    type="password"
                    value={awsForm.secretKey} 
                    onChange={e => setAwsForm({...awsForm, secretKey: e.target.value})} 
                    className="bg-black/20 border-white/10"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Region</Label>
                  <Input 
                    placeholder="us-east-1"
                    value={awsForm.region} 
                    onChange={e => setAwsForm({...awsForm, region: e.target.value})} 
                    className="bg-black/20 border-white/10"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bucket Name</Label>
                  <Input 
                    value={awsForm.bucket} 
                    onChange={e => setAwsForm({...awsForm, bucket: e.target.value})} 
                    className="bg-black/20 border-white/10"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowAWSForm(false)}>Cancel</Button>
                <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600">Save Settings</Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Linked Accounts</h3>
          {providers.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground bg-white/5 p-4 rounded-lg border border-white/10">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">No providers linked. Using mock storage.</span>
            </div>
          ) : (
            <div className="grid gap-2">
              <AnimatePresence>
                {providers.map(p => (
                  <motion.div 
                    key={p.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/10"
                  >
                    <span className="font-medium flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-emerald-400" />
                      {p.provider}
                    </span>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleUnlink(p.id)}
                      className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20"
                    >
                      <Unlink className="w-4 h-4 mr-2" />
                      Unlink
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
