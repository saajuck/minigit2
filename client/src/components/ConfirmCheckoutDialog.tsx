interface Props {
  target: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmCheckoutDialog({ target, onConfirm, onCancel }: Props) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p>
          The working tree has uncommitted changes. Checkout <code>{target}</code> anyway?
        </p>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="danger" onClick={onConfirm}>
            Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
