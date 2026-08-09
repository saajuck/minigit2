interface Props {
  target: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmCheckoutDialog({ target, onConfirm, onCancel }: Props) {
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">Confirm checkout</div>
        <div className="dialog-body">
          The working tree has uncommitted changes. Checking out <code>{target}</code> may fail or discard local
          changes.
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Check out anyway
          </button>
        </div>
      </div>
    </div>
  );
}
