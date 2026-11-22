'use client';

import { useState } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  Pin,
  Pencil,
  Trash2,
  Calendar,
  Quote,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sun,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import {
  useAffirmations,
  useTodayAffirmation,
  useCreateAffirmation,
  useUpdateAffirmation,
  useDeleteAffirmation,
  usePinAffirmationToday,
} from '@/features/affirmations/hooks';
import type { DailyAffirmationDto } from '@/lib/api/schemas';

const CATEGORIES = [
  'Mindfulness',
  'Gratitude',
  'Healing & Recovery',
  'Self-Care',
  'Resilience',
  'Mental Clarity',
  'General',
];

const CATEGORY_FILTER_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  ...CATEGORIES.map((cat) => ({ value: cat, label: cat })),
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active Only' },
  { value: 'inactive', label: 'Inactive Only' },
];

const PAGE_SIZE = 15;

export default function DailyAffirmationsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAffirmation, setEditingAffirmation] = useState<DailyAffirmationDto | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states
  const [formText, setFormText] = useState('');
  const [formCategory, setFormCategory] = useState('Mindfulness');
  const [formAuthor, setFormAuthor] = useState('Bloom Health');
  const [formDate, setFormDate] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const { data: todayData, isLoading: isTodayLoading, refetch: refetchToday } = useTodayAffirmation();
  const isActiveParam = statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined;

  const {
    data: affirmationsData,
    isLoading: isListLoading,
    error: listError,
  } = useAffirmations({
    page,
    pageSize: PAGE_SIZE,
    category: category !== 'all' ? category : undefined,
    isActive: isActiveParam,
    search: search.trim() || undefined,
  });

  // Mutations
  const createMutation = useCreateAffirmation();
  const updateMutation = useUpdateAffirmation();
  const deleteMutation = useDeleteAffirmation();
  const pinMutation = usePinAffirmationToday();

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormText('');
    setFormCategory('Mindfulness');
    setFormAuthor('Bloom Health');
    setFormDate('');
    setFormIsActive(true);
    setFormError(null);
    setIsCreateOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: DailyAffirmationDto) => {
    setEditingAffirmation(item);
    setFormText(item.text);
    setFormCategory(item.category || 'Mindfulness');
    setFormAuthor(item.author || 'Bloom Health');
    setFormDate(item.scheduled_date ? item.scheduled_date.slice(0, 10) : '');
    setFormIsActive(item.is_active);
    setFormError(null);
  };

  // Submit Create or Edit
  const handleSave = async () => {
    if (!formText.trim()) {
      setFormError('Please enter an affirmation message.');
      return;
    }

    try {
      if (editingAffirmation) {
        await updateMutation.mutateAsync({
          id: editingAffirmation.id,
          payload: {
            text: formText.trim(),
            category: formCategory,
            author: formAuthor.trim() || null,
            scheduled_date: formDate ? formDate : null,
            is_active: formIsActive,
          },
        });
        setEditingAffirmation(null);
      } else {
        await createMutation.mutateAsync({
          text: formText.trim(),
          category: formCategory,
          author: formAuthor.trim() || 'Bloom Health',
          scheduled_date: formDate ? formDate : null,
          is_active: formIsActive,
        });
        setIsCreateOpen(false);
      }
      refetchToday();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save affirmation.');
    }
  };

  // Pin to Today
  const handlePinToday = async (id: string) => {
    try {
      await pinMutation.mutateAsync(id);
      refetchToday();
    } catch (err: unknown) {
      console.error('Failed to pin affirmation:', err);
    }
  };

  // Confirm Delete
  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      setDeletingId(null);
      refetchToday();
    } catch (err: unknown) {
      console.error('Failed to delete affirmation:', err);
    }
  };

  // Category Badge Styler
  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'mindfulness':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'gratitude':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'healing & recovery':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'self-care':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'resilience':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'mental clarity':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Columns definition
  const columns: DataTableColumn<DailyAffirmationDto>[] = [
    {
      key: 'text',
      header: 'Affirmation',
      cell: (item) => (
        <div className="flex items-start gap-2.5 max-w-md py-1">
          <Quote className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-slate-900 line-clamp-2 leading-relaxed">
              &ldquo;{item.text}&rdquo;
            </p>
            {item.author && (
              <p className="text-xs text-slate-500 mt-0.5">&mdash; {item.author}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Theme / Category',
      hideBelow: 'md',
      cell: (item) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getCategoryColor(
            item.category
          )}`}
        >
          {item.category}
        </span>
      ),
    },
    {
      key: 'schedule',
      header: 'Schedule',
      hideBelow: 'md',
      cell: (item) => (
        <div className="flex items-center gap-1.5 text-xs">
          {item.scheduled_date ? (
            <span className="inline-flex items-center gap-1 font-medium text-slate-800 bg-slate-100 px-2 py-1 rounded-md">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              {item.scheduled_date.slice(0, 10)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-500 italic">
              <RefreshCw className="h-3 w-3 text-slate-400" />
              Daily Pool
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      hideBelow: 'sm',
      cell: (item) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            item.is_active
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {item.is_active ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              Active
            </>
          ) : (
            <>
              <XCircle className="h-3 w-3" />
              Inactive
            </>
          )}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (item) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            title="Pin as Today's Affirmation"
            onClick={() => handlePinToday(item.id)}
            disabled={pinMutation.isPending}
            className="text-slate-600 hover:text-primary p-1.5 h-auto"
          >
            <Pin className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            title="Edit Affirmation"
            onClick={() => handleOpenEdit(item)}
            className="text-slate-600 hover:text-slate-900 p-1.5 h-auto"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            title="Delete Affirmation"
            onClick={() => setDeletingId(item.id)}
            className="text-slate-600 hover:text-red-600 p-1.5 h-auto"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const totalPages = affirmationsData ? Math.ceil(affirmationsData.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Content', href: '/affirmations' },
          { label: 'Daily Affirmations' },
        ]}
        title="Daily Affirmations"
        description="Curate inspiring daily affirmations for patients. Pin messages to calendar dates or let them rotate deterministically from the active pool."
        actions={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4" />
            New Affirmation
          </Button>
        }
      />

      {/* Today's Active Spotlight Card */}
      <Card className="border-primary/20 bg-linear-to-br from-primary/5 via-white to-amber-50/30 shadow-xs">
        <div className="p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <Sun className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Live Today&apos;s Affirmation
                  </h3>
                  {todayData?.scheduled_date ? (
                    <Badge variant="success">Date Pinned</Badge>
                  ) : (
                    <Badge variant="info">Daily Pool Rotation</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Visible right now to all patient mobile app users
                </p>
              </div>
            </div>

            {todayData && (
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getCategoryColor(
                    todayData.category
                  )}`}
                >
                  {todayData.category}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEdit(todayData)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>
            )}
          </div>

          <div className="pt-4">
            {isTodayLoading ? (
              <div className="animate-pulse flex space-x-4 py-2">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                </div>
              </div>
            ) : todayData ? (
              <div className="space-y-1.5">
                <p className="text-base md:text-lg font-medium text-slate-800 italic leading-relaxed">
                  &ldquo;{todayData.text}&rdquo;
                </p>
                <p className="text-xs text-slate-500 font-medium">
                  &mdash; {todayData.author || 'Bloom Health'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No affirmations available.</p>
            )}
          </div>
        </div>
      </Card>

      {/* Affirmations Data Table with Toolbar */}
      <DataTable<DailyAffirmationDto>
        columns={columns}
        rows={affirmationsData?.items ?? []}
        getRowKey={(row) => row.id}
        total={affirmationsData?.total ?? 0}
        totalPages={totalPages}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        loading={isListLoading}
        error={listError ? { message: listError.message } : null}
        emptyTitle="No affirmations found"
        emptyDescription="Click 'New Affirmation' to create one."
        toolbar={
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="w-full md:flex-1">
              <Input
                label="Search"
                hideLabel
                placeholder="Search by affirmation text or author..."
                leadingIcon={<Search className="h-4 w-4" />}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-full md:w-56">
              <Select
                label="Category"
                hideLabel
                options={CATEGORY_FILTER_OPTIONS}
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-full md:w-44">
              <Select
                label="Status"
                hideLabel
                options={STATUS_FILTER_OPTIONS}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        }
      />

      {/* Create / Edit Modal */}
      <Modal
        open={isCreateOpen || editingAffirmation !== null}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingAffirmation(null);
        }}
        title={editingAffirmation ? 'Edit Affirmation' : 'Create New Affirmation'}
        description="This affirmation will be displayed in the patient mobile app home screen."
        size="md"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false);
                setEditingAffirmation(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingAffirmation ? 'Save Changes' : 'Publish Affirmation'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {formError && <Alert variant="danger" title={formError} />}

          <div>
            <Textarea
              label="Affirmation Message"
              required
              rows={4}
              placeholder="e.g. Today, I choose peace and nourish my body with love and patience."
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              hint={`${formText.length}/500 characters`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Select
                label="Theme / Category"
                required
                options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Author / Attribution"
                placeholder="e.g. Bloom Health"
                value={formAuthor}
                onChange={(e) => setFormAuthor(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <Input
                label="Schedule for Specific Date (Optional)"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                hint="Leave blank to add to regular daily pool rotation"
              />
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                />
                Active (Eligible for delivery)
              </label>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        title="Delete Affirmation"
        description="Are you sure you want to delete this affirmation? Patients will no longer see this message."
        size="sm"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          This operation cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
