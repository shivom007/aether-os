import { useState, useRef, useEffect } from 'react';
import { CryptoManager } from './lib/crypto';
import { ErasureCoder } from './lib/rs';
import { ApiClient } from './lib/api';
import Providers from './components/Providers';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Shield, HardDrive, Lock, FileKey2, Trash2, DownloadCloud, UploadCloud, Terminal, Server } from 'lucide-react';
import './index.css';

function App() {
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<{msg: string, type: string}[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  
  const cryptoManager = useRef<CryptoManager | null>(null);

  useEffect(() => {
    cryptoManager.current = new CryptoManager();
  }, []);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [...prev, { msg, type }]);
  };

  const fetchFiles = async () => {
    try {
      const data = await ApiClient.listFiles();
      setUploadedFiles(data.files || []);
    } catch (err) {
      console.error('Failed to fetch files', err);
    }
  };

  const handleAuth = async () => {
    if (!username || !password) {
      addLog('Please provide a username and password', 'error');
      return;
    }
    
    setIsProcessing(true);
    setLogs([]);
    addLog('Deriving Zero-Knowledge keys (PBKDF2)...');
    
    try {
      const startTime = performance.now();
      await cryptoManager.current!.deriveKey(password, username);
      const authHashArray = cryptoManager.current!.getAuthHash();
      const authHash = Array.from(authHashArray!).map(b => b.toString(16).padStart(2, '0')).join('');
      addLog(`Keys derived in ${Math.round(performance.now() - startTime)}ms.`, 'success');

      addLog('Authenticating with Go Backend...');
      try {
        await ApiClient.register(username, authHash);
      } catch (e) {}
      await ApiClient.login(username, authHash);
      setIsAuthenticated(true);
      addLog('Successfully authenticated!', 'success');
      await fetchFiles();
      
    } catch (err: any) {
      addLog(`Authentication failed: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const processFile = async () => {
    if (!file) {
      addLog('Please select a file', 'error');
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    addLog(`Starting processing for: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    try {
      addLog('Registering file in Virtual FS...');
      const fileMetaRes = await ApiClient.registerFile(file.name, file.size, file.type || 'application/octet-stream');
      const fileVersionId = fileMetaRes.versionId;
      if (!fileVersionId) throw new Error("Backend did not return a version ID");

      addLog('Reading file into memory...');
      const arrayBuffer = await file.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);

      addLog('Splitting into shards using Reed-Solomon RS(10, 4)...');
      const rsStart = performance.now();
      const coder = new ErasureCoder(10, 4);
      const shards = coder.encode(fileData);
      addLog(`Created 14 shards (10 data, 4 parity) in ${Math.round(performance.now() - rsStart)}ms.`, 'success');

      addLog('Allocating shards to Cloud Providers via API...');
      const allocation = await ApiClient.allocateShards(fileVersionId, 0, fileData.length);
      const shardAllocations = allocation.allocations;

      addLog('Encrypting 14 shards with AES-256-GCM (Web Worker) & Uploading...');
      const encStart = performance.now();
      
      for (let i = 0; i < shards.length; i++) {
        const { encrypted, iv } = await cryptoManager.current!.encryptChunk(shards[i]);
        const finalBlob = new Blob([iv.buffer, encrypted.buffer], { type: 'application/octet-stream' });
        const shardData = shardAllocations[i];
        addLog(`Encrypted Shard ${i+1}/14. Uploading to ${shardData.provider}...`);
        await ApiClient.uploadShard(shardData.shardId, finalBlob);
      }
      
      addLog(`All shards encrypted and uploaded in ${Math.round(performance.now() - encStart)}ms.`, 'success');
      addLog('Pipeline complete! Files safely stored across providers.', 'success');
      setFile(null);
      await fetchFiles();
      
    } catch (err: any) {
      addLog(`Pipeline failed: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteFile = async (fileId: number, fileName: string) => {
    if (!confirm(`Are you sure you want to permanently delete ${fileName} and all its encrypted shards?`)) return;
    
    setIsProcessing(true);
    setLogs([]);
    addLog(`Initiating deletion protocol for: ${fileName}...`);
    
    try {
      addLog('Instructing cloud providers to wipe physical shards securely...');
      await ApiClient.deleteFile(fileId);
      addLog('Metadata and Shards successfully erased.', 'success');
      await fetchFiles();
    } catch (err: any) {
      addLog(`Deletion failed: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadFile = async (fileId: number, fileName: string, fileMimeType: string) => {
    setIsProcessing(true);
    setLogs([]);
    addLog(`Preparing to download: ${fileName}`);

    try {
      addLog('Fetching File Shard Maps from Virtual FS...');
      const fileDetails = await ApiClient.getFileDetails(fileId);
      
      const fileVersions = fileDetails.versions || [];
      if (fileVersions.length === 0) throw new Error("File is corrupted or was uploaded before versions were implemented. Please delete and re-upload.");
      
      const chunks = fileVersions[0].chunks || [];
      if (chunks.length === 0) throw new Error("No chunks found for file version");

      const shardsData = chunks[0].shards || [];
      if (shardsData.length === 0) throw new Error("No shards found for chunk");

      addLog(`Found ${shardsData.length} Shards. Downloading concurrently from Providers...`);
      const dlStart = performance.now();

      const downloadedShards: (Uint8Array | null)[] = new Array(14).fill(null);
      
      await Promise.all(shardsData.map(async (shardMeta: any) => {
        try {
          const encryptedBuf = await ApiClient.downloadShard(shardMeta.id);
          const decryptedBuf = await cryptoManager.current!.decryptChunk(new Uint8Array(encryptedBuf));
          downloadedShards[shardMeta.shardIndex] = decryptedBuf;
          addLog(`✓ Shard ${shardMeta.shardIndex} Decrypted (${encryptedBuf.byteLength} bytes)`);
        } catch (e: any) {
          addLog(`✗ Shard ${shardMeta.shardIndex} Failed: ${e.message || e.toString()}`, 'error');
        }
      }));

      addLog(`Shards retrieved in ${Math.round(performance.now() - dlStart)}ms.`, 'success');

      addLog('Reconstructing original file using Reed-Solomon RS(10, 4)...');
      const rsStart = performance.now();
      const coder = new ErasureCoder(10, 4);
      const reconstructedData = coder.reconstruct(downloadedShards, fileDetails.size);
      addLog(`File reconstructed in ${Math.round(performance.now() - rsStart)}ms.`, 'success');

      addLog('Triggering browser download...');
      const blob = new Blob([reconstructedData.buffer], { type: fileMimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      addLog('Download complete!', 'success');

    } catch (err: any) {
      addLog(`Download failed: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl space-y-8"
      >
        <div className="text-center">
          <motion.div 
            className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4"
            whileHover={{ scale: 1.1, rotate: 180 }}
            transition={{ duration: 0.5 }}
          >
            <Shield className="h-8 w-8 text-primary" />
          </motion.div>
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
            Project Aether
          </h1>
          <p className="mt-4 text-xl text-muted-foreground">
            Zero-Knowledge Distributed Virtual Filesystem
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!isAuthenticated ? (
            <motion.div
              key="auth"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-primary" />
                    Authentication
                  </CardTitle>
                  <CardDescription>
                    Enter your credentials. Your password never leaves your device and is only used to derive encryption keys.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input 
                      id="username"
                      placeholder="johndoe" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isProcessing}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Master Password</Label>
                    <Input 
                      id="password"
                      type="password"
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isProcessing}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg shadow-indigo-500/25"
                    onClick={handleAuth}
                    disabled={isProcessing || !username || !password}
                  >
                    {isProcessing ? 'Deriving Keys...' : 'Login / Register'}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Shield className="w-5 h-5" />
                <span className="font-medium">Authenticated as {username}</span>
              </div>

              <Providers onLog={addLog} />

              <Card className="border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-primary" />
                    Virtual Drive
                  </CardTitle>
                  <CardDescription>
                    Upload and manage your securely sharded files.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  <div className="flex items-end gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="file-upload">Select File to Encrypt & Split</Label>
                      <Input 
                        id="file-upload" 
                        type="file" 
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        disabled={isProcessing}
                        className="bg-black/20 border-white/10 file:text-primary file:bg-primary/10 file:rounded-md file:px-4 file:py-1 cursor-pointer"
                      />
                    </div>
                    <Button 
                      onClick={processFile} 
                      disabled={isProcessing || !file}
                      className="bg-indigo-500 hover:bg-indigo-600"
                    >
                      <UploadCloud className="w-4 h-4 mr-2" />
                      Upload
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Your Files</h3>
                    {uploadedFiles.length === 0 ? (
                      <div className="text-center py-12 bg-white/5 rounded-lg border border-white/10 border-dashed">
                        <FileKey2 className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                        <p className="text-muted-foreground">Your virtual drive is empty.</p>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        <AnimatePresence>
                          {uploadedFiles.map((f, i) => (
                            <motion.div 
                              key={f.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              transition={{ delay: i * 0.05 }}
                              className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:border-primary/50 transition-colors group"
                            >
                              <div className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                                  <Lock className="w-5 h-5" />
                                </div>
                                <div>
                                  <div className="font-semibold">{f.name}</div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {(f.size / 1024 / 1024).toFixed(2)} MB • {f.mimeType}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="secondary" 
                                  size="sm"
                                  onClick={() => downloadFile(f.id, f.name, f.mimeType)}
                                  disabled={isProcessing}
                                  className="bg-white/10 hover:bg-white/20"
                                >
                                  <DownloadCloud className="w-4 h-4 mr-2" />
                                  Download
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  onClick={() => deleteFile(f.id, f.name)}
                                  disabled={isProcessing}
                                  className="bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 border border-red-500/20"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>

                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Action Log */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border border-white/10 bg-black/60 backdrop-blur-md overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
            <Terminal className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-mono text-muted-foreground tracking-wider uppercase">System Logs</span>
          </div>
          <div className="p-4 h-[200px] overflow-y-auto font-mono text-sm space-y-1">
            {logs.length === 0 ? (
              <span className="text-muted-foreground">Ready. Awaiting commands...</span>
            ) : (
              logs.map((log, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i} 
                  className={`flex items-start gap-2 border-b border-white/5 pb-1 ${
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-emerald-400' :
                    'text-slate-300'
                  }`}
                >
                  <span className="opacity-50 text-xs mt-0.5">[{new Date().toLocaleTimeString()}]</span>
                  <span>{log.msg}</span>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default App;
