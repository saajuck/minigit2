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
          Le working tree contient des modifications non commitées. Checkout <code>{target}</code> quand même&nbsp;?
        </p>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className="danger" onClick={onConfirm}>
            Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
