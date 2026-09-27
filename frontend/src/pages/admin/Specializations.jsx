import { useState, useEffect, useCallback } from 'react'
import Layout from '../../components/layout/Layout'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Loading from '../../components/ui/Loading'
import EmptyState from '../../components/ui/EmptyState'
import Badge from '../../components/ui/Badge'
import { StatusBadge } from '../../components/ui/Badge'
import { adminApi } from '../../api'
import { useToast } from '../../components/ui/Toast'

function SpecRow({ spec, onEdit, onToggle }) {
  return (
    <tr>
      <td style={{ fontWeight: 600 }}>{spec.name}</td>
      <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', maxWidth: 260 }}>{spec.description || '—'}</td>
      <td>
        <span className={`badge ${spec.is_active ? 'badge-active' : 'badge-disabled'}`}>
          {spec.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
        {new Date(spec.created_at).toLocaleDateString('en-GB')}
      </td>
      <td>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <Button size="sm" variant="ghost" onClick={() => onEdit(spec)}>✏️ Edit</Button>
          <Button size="sm" variant={spec.is_active ? 'danger' : 'success'} onClick={() => onToggle(spec)}>
            {spec.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </td>
    </tr>
  )
}

function RequestRow({ req, onApprove, onReject }) {
  return (
    <tr>
      <td style={{ fontWeight: 600 }}>{req.doctor_name}</td>
      <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>{req.doctor_email}</td>
      <td style={{ color: 'var(--text-secondary)' }}>{req.current_specialization_name || <em style={{ color: 'var(--text-muted)' }}>None</em>}</td>
      <td style={{ fontWeight: 600, color: 'var(--color-teal-600)' }}>{req.requested_specialization_name}</td>
      <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', maxWidth: 180 }}>{req.reason || '—'}</td>
      <td>
        <span className={`badge badge-${req.status === 'PENDING' ? 'pending' : req.status === 'APPROVED' ? 'approved' : 'rejected'}`}>
          {req.status}
        </span>
      </td>
      <td>
        {req.status === 'PENDING' && (
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            <Button size="sm" variant="success" onClick={() => onApprove(req)}>✓ Approve</Button>
            <Button size="sm" variant="danger" onClick={() => onReject(req)}>✗ Reject</Button>
          </div>
        )}
      </td>
    </tr>
  )
}

export default function Specializations() {
  const toast = useToast()

  // Specializations state
  const [specs, setSpecs] = useState([])
  const [specsLoading, setSpecsLoading] = useState(true)

  // Change requests state
  const [requests, setRequests] = useState([])
  const [reqsLoading, setReqsLoading] = useState(true)
  const [reqFilter, setReqFilter] = useState('')

  // Modal state
  const [editModal, setEditModal] = useState(null) // null | { spec } | { new: true }
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [editLoading, setEditLoading] = useState(false)

  const [reviewModal, setReviewModal] = useState(null) // { req, action: 'approve'|'reject' }
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)

  const loadSpecs = useCallback(async () => {
    setSpecsLoading(true)
    try {
      const data = await adminApi.getSpecializations()
      setSpecs(data)
    } catch {
      toast.error('Error', 'Failed to load specializations')
    } finally {
      setSpecsLoading(false)
    }
  }, [])

  const loadRequests = useCallback(async () => {
    setReqsLoading(true)
    try {
      const data = await adminApi.getSpecializationRequests(reqFilter || undefined)
      setRequests(data)
    } catch {
      toast.error('Error', 'Failed to load requests')
    } finally {
      setReqsLoading(false)
    }
  }, [reqFilter])

  useEffect(() => { loadSpecs() }, [loadSpecs])
  useEffect(() => { loadRequests() }, [loadRequests])

  // Specialization CRUD
  const openNew = () => {
    setEditForm({ name: '', description: '' })
    setEditModal({ new: true })
  }
  const openEdit = (spec) => {
    setEditForm({ name: spec.name, description: spec.description || '', is_active: spec.is_active })
    setEditModal({ spec })
  }
  const closeEdit = () => setEditModal(null)

  const saveSpec = async () => {
    setEditLoading(true)
    try {
      if (editModal?.new) {
        await adminApi.createSpecialization({ name: editForm.name, description: editForm.description || null })
        toast.success('Created', `Specialization "${editForm.name}" added`)
      } else {
        await adminApi.updateSpecialization(editModal.spec.id, {
          name: editForm.name,
          description: editForm.description || null,
        })
        toast.success('Updated', `Specialization updated`)
      }
      closeEdit()
      loadSpecs()
    } catch (err) {
      toast.error('Error', err.message)
    } finally {
      setEditLoading(false)
    }
  }

  const toggleActive = async (spec) => {
    try {
      await adminApi.updateSpecialization(spec.id, { is_active: !spec.is_active })
      toast.success('Updated', `Specialization ${spec.is_active ? 'deactivated' : 'activated'}`)
      loadSpecs()
    } catch (err) {
      toast.error('Error', err.message)
    }
  }

  // Change request review
  const openReview = (req, action) => {
    setReviewModal({ req, action })
    setReviewNotes('')
  }
  const closeReview = () => setReviewModal(null)

  const submitReview = async () => {
    setReviewLoading(true)
    try {
      if (reviewModal.action === 'approve') {
        await adminApi.approveSpecRequest(reviewModal.req.id, reviewNotes || null)
        toast.success('Approved', 'Specialization change approved')
      } else {
        await adminApi.rejectSpecRequest(reviewModal.req.id, reviewNotes || null)
        toast.success('Rejected', 'Specialization change rejected')
      }
      closeReview()
      loadRequests()
    } catch (err) {
      toast.error('Error', err.message)
    } finally {
      setReviewLoading(false)
    }
  }

  const pendingCount = requests.filter(r => r.status === 'PENDING').length

  return (
    <Layout title="Specializations">
      <div className="page-header">
        <h2 className="page-header__title">Specialization Management</h2>
        <p className="page-header__subtitle">Manage medical specializations and doctor change requests</p>
      </div>

      {/* ── Specializations List ── */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 className="section-title" style={{ margin: 0 }}>
            Specializations
            <span style={{ marginLeft: '0.5rem', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 400 }}>
              ({specs.length} total)
            </span>
          </h3>
          <Button id="add-spec-btn" variant="primary" size="sm" onClick={openNew}>+ Add Specialization</Button>
        </div>

        {specsLoading ? <Loading /> : specs.length === 0 ? (
          <EmptyState icon="🩺" title="No specializations yet" message="Add the first specialization to get started" />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {specs.map(spec => (
                  <SpecRow key={spec.id} spec={spec} onEdit={openEdit} onToggle={toggleActive} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Specialization Change Requests ── */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 className="section-title" style={{ margin: 0 }}>
            Doctor Specialization Requests
            {pendingCount > 0 && (
              <span className="badge badge-pending" style={{ marginLeft: '0.5rem' }}>{pendingCount} pending</span>
            )}
          </h3>
          <select
            id="req-status-filter"
            className="form-select"
            style={{ maxWidth: 160 }}
            value={reqFilter}
            onChange={e => setReqFilter(e.target.value)}
          >
            <option value="">All Requests</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        {reqsLoading ? <Loading /> : requests.length === 0 ? (
          <EmptyState icon="📋" title="No requests found" message="Doctor specialization change requests will appear here" />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Email</th>
                  <th>Current</th>
                  <th>Requested</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <RequestRow
                    key={req.id}
                    req={req}
                    onApprove={r => openReview(r, 'approve')}
                    onReject={r => openReview(r, 'reject')}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add/Edit Specialization Modal */}
      <Modal
        open={!!editModal}
        onClose={closeEdit}
        title={editModal?.new ? 'Add Specialization' : 'Edit Specialization'}
      >
        {editModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Input
              id="spec-name"
              label="Name"
              placeholder="e.g. Cardiology"
              value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
            />
            <div className="form-group">
              <label className="form-label" htmlFor="spec-desc">Description (optional)</label>
              <textarea
                id="spec-desc"
                className="form-input"
                style={{ minHeight: 80, resize: 'vertical' }}
                placeholder="Brief description of this specialization"
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={closeEdit}>Cancel</Button>
              <Button
                id="save-spec-btn"
                variant="primary"
                loading={editLoading}
                onClick={saveSpec}
                disabled={!editForm.name.trim()}
              >
                {editModal?.new ? 'Create' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Review Change Request Modal */}
      <Modal
        open={!!reviewModal}
        onClose={closeReview}
        title={reviewModal?.action === 'approve' ? '✓ Approve Specialization Change' : '✗ Reject Specialization Change'}
      >
        {reviewModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card-flat" style={{ background: 'var(--bg-surface-alt)' }}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                <strong>{reviewModal.req.doctor_name}</strong> is requesting to change from{' '}
                <strong>{reviewModal.req.current_specialization_name || 'None'}</strong> to{' '}
                <strong>{reviewModal.req.requested_specialization_name}</strong>
              </div>
              {reviewModal.req.reason && (
                <div style={{ marginTop: '0.5rem', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Reason: {reviewModal.req.reason}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="review-notes">Review Notes (optional)</label>
              <textarea
                id="review-notes"
                className="form-input"
                style={{ minHeight: 80, resize: 'vertical' }}
                placeholder="Add notes for the doctor…"
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={closeReview}>Cancel</Button>
              <Button
                id={`confirm-spec-${reviewModal.action}-btn`}
                variant={reviewModal.action === 'approve' ? 'success' : 'danger'}
                loading={reviewLoading}
                onClick={submitReview}
              >
                {reviewModal.action === 'approve' ? '✓ Approve' : '✗ Reject'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
