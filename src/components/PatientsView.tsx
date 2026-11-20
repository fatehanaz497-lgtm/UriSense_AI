import { useState, type FormEvent } from 'react';
import { ArrowRight, Edit3, FlaskConical, Plus, Search, UserCheck, X } from 'lucide-react';
import type { PatientWithStats } from '../lib/api.ts';
import type { PatientRecord, UrinalysisTestRecord } from '../../shared/urinalysis.ts';
import { api } from '../lib/api.ts';
import { ParameterStatusText } from './StatusIndicator.tsx';

interface PatientsViewProps {
  patients: PatientWithStats[];
  tests: UrinalysisTestRecord[];
  onRefresh: () => Promise<void>;
  onSelectTest: (test: UrinalysisTestRecord) => void;
  onStartTestForPatient: (patientId: string) => void;
}

export function PatientsView({
  patients,
  tests,
  onRefresh,
  onSelectTest,
  onStartTestForPatient,
}: PatientsViewProps) {
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientWithStats | null>(patients[0] ?? null);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);

  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formAge, setFormAge] = useState('32');
  const [formGender, setFormGender] = useState<PatientRecord['gender']>('Female');
  const [formContact, setFormContact] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = patients.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
  });

  const activePatient =
    patients.find((p) => p.id === selectedPatient?.id) ?? filtered[0] ?? null;

  const activePatientTests = activePatient
    ? tests.filter((t) => t.patientId === activePatient.id)
    : [];

  function openAddModal() {
    setModalMode('add');
    setFormId('');
    setFormName('');
    setFormAge('30');
    setFormGender('Female');
    setFormContact('');
    setFormNotes('');
    setError(null);
  }

  function openEditModal(p: PatientWithStats) {
    setModalMode('edit');
    setFormId(p.id);
    setFormName(p.name);
    setFormAge(String(p.age));
    setFormGender(p.gender);
    setFormContact(p.contact);
    setFormNotes(p.notes || '');
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const ageNum = Number(formAge);
      if (modalMode === 'add') {
        const res = await api.createPatient({
          id: formId.trim() || undefined,
          name: formName,
          age: ageNum,
          gender: formGender,
          contact: formContact,
          notes: formNotes,
        });
        await onRefresh();
        setSelectedPatient({
          ...res.patient,
          testCount: 0,
          lastTestDate: null,
          lastTestStatus: null,
        });
      } else if (modalMode === 'edit') {
        await api.updatePatient(formId, {
          name: formName,
          age: ageNum,
          gender: formGender,
          contact: formContact,
          notes: formNotes,
        });
        await onRefresh();
      }
      setModalMode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save patient.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Search + Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient name or ID..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
          />
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#2685D8] hover:bg-[#164B78] text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add Patient</span>
        </button>
      </div>

      {/* Patient Directory + Profile Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Patient List Table */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#D6E4F0] shadow-[0_1px_3px_rgba(22,75,120,0.05)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#D6E4F0] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#164B78]">Registered Patients ({filtered.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FBFF] border-b border-[#D6E4F0] text-[11px] font-semibold text-[#64748B]">
                  <th className="py-2.5 px-4">Patient ID</th>
                  <th className="py-2.5 px-4">Name</th>
                  <th className="py-2.5 px-4">Age / Gender</th>
                  <th className="py-2.5 px-4">Tests</th>
                  <th className="py-2.5 px-4 text-right">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EEF6] text-xs">
                {filtered.map((p) => {
                  const isSelected = activePatient?.id === p.id;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedPatient(p)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#EAF5FF]/70' : 'hover:bg-[#F8FBFF]'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono tabular-nums font-medium text-[#164B78]">{p.id}</td>
                      <td className="py-3 px-4 font-semibold text-[#24364B]">{p.name}</td>
                      <td className="py-3 px-4 text-[#64748B] font-mono tabular-nums">
                        {p.age} · {p.gender}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-[#24364B]">{p.testCount}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(p);
                          }}
                          className="p-1.5 rounded-md text-[#2685D8] hover:bg-[#EAF5FF] cursor-pointer"
                          aria-label={`Edit ${p.name}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-[#64748B]">
                      No patients matched your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Patient Profile */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#D6E4F0] shadow-[0_1px_3px_rgba(22,75,120,0.05)] p-5">
          {activePatient ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3 border-b border-[#E5EEF6] pb-4">
                <div>
                  <div className="text-xs font-mono text-[#2685D8] font-semibold">{activePatient.id}</div>
                  <h3 className="text-lg font-bold text-[#164B78] mt-0.5">{activePatient.name}</h3>
                  <div className="text-xs text-[#64748B] mt-1">
                    {activePatient.age} years · {activePatient.gender} · Registered{' '}
                    {new Date(activePatient.registrationDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openEditModal(activePatient)}
                  className="px-3 py-1.5 bg-[#EAF5FF] hover:bg-[#DCEEFF] text-[#164B78] text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Edit Info
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[#64748B]">Contact: </span>
                  <span className="text-[#24364B] font-medium">{activePatient.contact || 'Not provided'}</span>
                </div>
                {activePatient.notes && (
                  <div>
                    <span className="text-[#64748B]">Clinical Notes: </span>
                    <span className="text-[#24364B]">{activePatient.notes}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onStartTestForPatient(activePatient.id)}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-[#2685D8] hover:bg-[#164B78] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <FlaskConical className="w-4 h-4" aria-hidden="true" />
                <span>Start New Test for {activePatient.name}</span>
              </button>

              <div>
                <h4 className="text-xs font-semibold text-[#164B78] mb-2.5">
                  Previous Urinalysis Reports ({activePatientTests.length})
                </h4>
                {activePatientTests.length === 0 ? (
                  <p className="text-xs text-[#64748B] bg-[#F8FBFF] border border-[#E5EEF6] rounded-lg p-3.5">
                    No urinalysis records for this patient yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {activePatientTests.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onSelectTest(t)}
                        className="w-full text-left p-3 rounded-lg border border-[#D6E4F0] hover:bg-[#F8FBFF] transition-colors flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div>
                          <div className="text-xs font-mono font-semibold text-[#164B78]">{t.id}</div>
                          <div className="text-[11px] text-[#64748B] mt-0.5 font-mono tabular-nums">
                            {new Date(t.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            · {t.mode === 'demo' ? 'Demo' : 'Real IoT'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <ParameterStatusText status={t.overallStatus} />
                          <ArrowRight className="w-3.5 h-3.5 text-[#2685D8]" aria-hidden="true" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <UserCheck className="w-8 h-8 text-[#64B5F6] mx-auto mb-2" aria-hidden="true" />
              <p className="text-xs text-[#64748B]">Select a patient to view profile and test records.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 bg-[#164B78]/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#D6E4F0] shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#164B78]">
                {modalMode === 'add' ? 'Add New Patient' : 'Edit Patient Information'}
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-1 text-[#64748B] hover:text-[#164B78] cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-3 p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {modalMode === 'add' && (
                <div>
                  <label className="block text-xs font-medium text-[#24364B] mb-1">
                    Patient ID (Optional — auto-generated if blank)
                  </label>
                  <input
                    type="text"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    placeholder="PATIENT-005"
                    className="w-full px-3 py-2 text-sm font-mono border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#24364B] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#24364B] mb-1">Age</label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={130}
                    value={formAge}
                    onChange={(e) => setFormAge(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#24364B] mb-1">Gender</label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as PatientRecord['gender'])}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#24364B] mb-1">Contact Email or Phone</label>
                <input
                  type="text"
                  value={formContact}
                  onChange={(e) => setFormContact(e.target.value)}
                  placeholder="patient@example.com"
                  className="w-full px-3 py-2 text-sm border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#24364B] mb-1">Clinical Notes</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#24364B] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#2685D8] hover:bg-[#164B78] text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
