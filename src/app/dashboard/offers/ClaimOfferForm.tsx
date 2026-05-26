interface ClaimOfferFormProps {
  claimerEmail: string;
  setClaimerEmail: (email: string) => void;
  isSubmitting: boolean;
  handleClaimSubmit: (e: React.FormEvent) => void;
  setClaimingId: (id: string | null) => void;
}

export function ClaimOfferForm({
  claimerEmail,
  setClaimerEmail,
  isSubmitting,
  handleClaimSubmit,
  setClaimingId,
}: ClaimOfferFormProps) {
  return (
    <div className="mb-6 p-4 bg-white dark:bg-zinc-900 border border-accent/20 rounded-lg animate-in fade-in slide-in-from-top-2 relative z-20">
      <h4 className="text-sm font-semibold mb-2">Request this offer</h4>
      <p className="text-[10px] text-muted-foreground mb-3">Leave your email address and the offerer will contact you.</p>
      <form onSubmit={handleClaimSubmit} className="space-y-3">
        <input
          type="email"
          placeholder="Your Email"
          className="w-full text-xs p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
          value={claimerEmail}
          onChange={(e) => setClaimerEmail(e.target.value)}
          required
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-accent text-white text-xs py-2 rounded font-medium disabled:opacity-50"
          >
            {isSubmitting ? 'Sending...' : 'Send Interest'}
          </button>
          <button
            type="button"
            onClick={() => setClaimingId(null)}
            className="px-3 text-xs border rounded hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
