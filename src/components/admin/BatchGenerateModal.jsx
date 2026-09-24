import Modal from '../ui/Modal.jsx'
import BatchGenerateForm from './BatchGenerateForm.jsx'

export default function BatchGenerateModal({ open, onClose }) {
  return (
    <Modal open={open} title="Gerar" onClose={onClose} animated>
      <BatchGenerateForm />
    </Modal>
  )
}
