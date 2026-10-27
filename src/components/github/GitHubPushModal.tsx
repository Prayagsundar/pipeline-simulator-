import React, { useState } from 'react';
import { X, GitBranch, Download, Check, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';

interface GitHubPushModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultUsername?: string;
}

export const GitHubPushModal: React.FC<GitHubPushModalProps> = ({
  isOpen,
  onClose,
  defaultUsername = 'Prayagsundar',
}) => {
  const [repoName, setRepoName] = useState(`${defaultUsername}/cpu-pipeline-simulator`);
  const [token, setToken] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handlePush = async () => {
    if (!token.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a GitHub Personal Access Token' });
      return;
    }

    setIsPushing(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/git/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoName, token }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || 'Push failed');
      }

      setStatusMessage({ type: 'success', text: data.message || 'Pushed successfully to GitHub!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to push to GitHub' });
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-slate-100 text-sm">Push to GitHub</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-lg flex items-start gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-200'
                  : 'bg-rose-950/60 border border-rose-800 text-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">{statusMessage.text}</div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                GitHub Repository
              </label>
              <input
                type="text"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="username/repository-name"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Make sure the repo is created at{' '}
                <a
                  href="https://github.com/new"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 underline inline-flex items-center gap-0.5"
                >
                  github.com/new <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                GitHub Personal Access Token (Classic with "repo" scope)
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Generate a token at{' '}
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 underline inline-flex items-center gap-0.5"
                >
                  github.com/settings/tokens <ExternalLink className="w-2.5 h-2.5" />
                </a>{' '}
                with <strong>repo</strong> permissions.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handlePush}
              disabled={isPushing}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold transition-colors"
            >
              {isPushing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Pushing to GitHub...</span>
                </>
              ) : (
                <>
                  <GitBranch className="w-4 h-4" />
                  <span>Push to GitHub Now</span>
                </>
              )}
            </button>
          </div>

          {/* Alternative: Download Archive */}
          <div className="pt-3 border-t border-slate-800 text-center">
            <div className="text-[11px] text-slate-400 mb-2">Or download the complete codebase archive:</div>
            <a
              href="/api/download-archive"
              download="cpu-pipeline-simulator.tar.gz"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors text-xs font-medium border border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Download cpu-pipeline-simulator.tar.gz</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
