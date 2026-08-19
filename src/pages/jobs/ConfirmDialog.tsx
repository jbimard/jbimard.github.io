type ConfirmDialogProps = {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  destructive?: boolean
}

const ConfirmDialog = ({ title, message, confirmLabel, onConfirm, onCancel, destructive }: ConfirmDialogProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
    <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`rounded-md px-3 py-2 text-sm text-white ${
            destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-950 hover:bg-slate-800'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
)

export default ConfirmDialog
