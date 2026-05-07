'use client';

import type {
  AllMaintenanceTasksQuery,
  ExpenseDashboardQuery,
  GetRiderProfileQuery,
  MyMotorcyclesQuery,
  SavedTripsQuery,
} from '@motovault/graphql';
import {
  AllMaintenanceTasksDocument,
  CompleteMaintenanceTaskDocument,
  ExpenseDashboardDocument,
  GetRiderProfileDocument,
  LogExpenseDocument,
  MaintenancePriority,
  MaintenanceTaskStatus,
  MeDocument,
  MyMotorcyclesDocument,
  SavedTripsDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Bike,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  Crown,
  Fuel,
  Gauge,
  Lock,
  MapPin,
  Plus,
  Route,
  Settings,
  Shield,
  Wrench,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useProStatus } from '@/hooks/use-pro-status';
import { trackEvent, WebEvent } from '@/lib/analytics';
import { gqlFetcher } from '@/lib/graphql-client';
import './garage.css';

// ─── Type aliases ───
type Motorcycle = MyMotorcyclesQuery['myMotorcycles'][number];
type Task = AllMaintenanceTasksQuery['allMaintenanceTasks'][number];
type TripEdge = SavedTripsQuery['savedTrips']['edges'][number];
type RideStats = GetRiderProfileQuery['getRiderProfile']['rideStats'];

// ─── Constants ───
const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] as const;

const EXPENSE_CATEGORIES = [
  'fuel',
  'maintenance',
  'parts',
  'gear',
  'tires',
  'insurance',
  'registration',
  'tolls',
  'parking',
  'modifications',
  'training',
] as const;

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  fuel: <Fuel className="h-3.5 w-3.5" />,
  insurance: <Shield className="h-3.5 w-3.5" />,
  parts: <Settings className="h-3.5 w-3.5" />,
  maintenance: <Wrench className="h-3.5 w-3.5" />,
  gear: <Bike className="h-3.5 w-3.5" />,
  tires: <Gauge className="h-3.5 w-3.5" />,
  registration: <Calendar className="h-3.5 w-3.5" />,
  tolls: <Route className="h-3.5 w-3.5" />,
  parking: <MapPin className="h-3.5 w-3.5" />,
  modifications: <Settings className="h-3.5 w-3.5" />,
  training: <AlertTriangle className="h-3.5 w-3.5" />,
};

const DIFFICULTY_GRADIENTS: Record<string, string> = {
  expert:
    'linear-gradient(135deg, oklch(0.28 0.04 240) 0%, oklch(0.16 0.03 230) 50%, oklch(0.1 0.02 220) 100%)',
  advanced:
    'linear-gradient(180deg, oklch(0.4 0.13 50) 0%, oklch(0.28 0.1 40) 50%, oklch(0.15 0.04 30) 100%)',
  intermediate: 'linear-gradient(135deg, oklch(0.25 0.06 160) 0%, oklch(0.15 0.04 150) 100%)',
  beginner: 'linear-gradient(135deg, oklch(0.25 0.05 200) 0%, oklch(0.15 0.03 190) 100%)',
};

// ─── Helpers ───
function _formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyShort(amount: number): string {
  if (amount >= 10000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ═══════════════════════════════════════════════
// ProGate Component
// ═══════════════════════════════════════════════
function ProGate({
  feature,
  description,
  isPro,
  children,
}: {
  feature: string;
  description: string;
  isPro: boolean;
  children: React.ReactNode;
}) {
  if (isPro) return <>{children}</>;

  return (
    <div style={{ position: 'relative', borderRadius: '20px', overflow: 'hidden' }}>
      <div style={{ filter: 'blur(8px) saturate(0.55)', opacity: 0.4, pointerEvents: 'none' }}>
        {children}
      </div>
      <div className="lock-overlay">
        <div className="lock-card">
          <div className="lock-icon">
            <Crown className="h-6 w-6" />
          </div>
          <h4 className="lock-title">
            Unlock <span className="serif">{feature}</span>
          </h4>
          <p className="lock-desc">{description}</p>
          <a className="lock-cta" href="/pro/checkout?redirect=/garage">
            Upgrade to Pro <ArrowRight className="h-3.5 w-3.5" />
          </a>
          <div className="lock-price">From $5.99/mo &middot; 7-day free trial</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Log Expense Modal
// ═══════════════════════════════════════════════
function LogExpenseModal({ bikes, onClose }: { bikes: Motorcycle[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [motorcycleId, setMotorcycleId] = useState(
    bikes.find((b) => b.isPrimary)?.id ?? bikes[0]?.id ?? '',
  );
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('fuel');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      gqlFetcher(LogExpenseDocument, {
        input: {
          motorcycleId,
          amount: Number.parseFloat(amount),
          category,
          date,
          description: description || undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garage', 'expenses'] });
      onClose();
    },
  });

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Log expense">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <h3 className="modal-title" style={{ margin: 0 }}>
            Log expense
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="mv-btn ghost"
            style={{ padding: '6px' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="modal-field">
          <label htmlFor="exp-bike" className="modal-label">
            Motorcycle
          </label>
          <select
            id="exp-bike"
            className="modal-select"
            value={motorcycleId}
            onChange={(e) => setMotorcycleId(e.target.value)}
          >
            {bikes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nickname ?? `${b.year} ${b.make} ${b.model}`}
              </option>
            ))}
          </select>
        </div>

        <div className="modal-field">
          <label htmlFor="exp-amount" className="modal-label">
            Amount ($)
          </label>
          <input
            id="exp-amount"
            type="number"
            className="modal-input"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0"
            step="0.01"
          />
        </div>

        <div className="modal-field">
          <label htmlFor="exp-cat" className="modal-label">
            Category
          </label>
          <select
            id="exp-cat"
            className="modal-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="modal-field">
          <label htmlFor="exp-date" className="modal-label">
            Date
          </label>
          <input
            id="exp-date"
            type="date"
            className="modal-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="modal-field">
          <label htmlFor="exp-desc" className="modal-label">
            Description (optional)
          </label>
          <input
            id="exp-desc"
            type="text"
            className="modal-input"
            placeholder="Shell V-Power, Ducati service..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {mutation.isError && (
          <p style={{ color: 'var(--mv-danger)', fontSize: '13px', marginBottom: '14px' }}>
            Failed to log expense. Please try again.
          </p>
        )}

        <div className="modal-actions">
          <button type="button" className="mv-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="mv-btn primary"
            disabled={!amount || !motorcycleId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving...' : 'Log Expense'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Main Garage Page
// ═══════════════════════════════════════════════
export default function GaragePage() {
  const { isPro } = useProStatus();
  const queryClient = useQueryClient();
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);

  useEffect(() => {
    trackEvent(WebEvent.GARAGE_VIEWED);
  }, []);

  // ─── Data fetching ───
  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => gqlFetcher(MeDocument),
  });

  const {
    data: bikesData,
    isLoading: bikesLoading,
    isError: bikesError,
    refetch: refetchBikes,
  } = useQuery({
    queryKey: ['garage', 'motorcycles'],
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });

  const bikes = bikesData?.myMotorcycles ?? [];
  const primaryBike = bikes.find((b) => b.isPrimary) ?? bikes[0];
  const user = meData?.me;

  const { data: expenseData } = useQuery({
    queryKey: ['garage', 'expenses', primaryBike?.id],
    queryFn: () => gqlFetcher(ExpenseDashboardDocument, { motorcycleId: primaryBike?.id ?? '' }),
    enabled: !!primaryBike,
  });

  const { data: maintenanceData } = useQuery({
    queryKey: ['garage', 'maintenance'],
    queryFn: () => gqlFetcher(AllMaintenanceTasksDocument),
  });

  const { data: tripsData } = useQuery({
    queryKey: ['garage', 'trips'],
    queryFn: () => gqlFetcher(SavedTripsDocument, { first: 10 }),
  });

  const { data: profileData } = useQuery({
    queryKey: ['garage', 'profile', user?.publicUsername],
    queryFn: () => gqlFetcher(GetRiderProfileDocument, { username: user?.publicUsername ?? '' }),
    enabled: !!user?.publicUsername,
  });

  // ─── Mutations ───
  const completeTaskMutation = useMutation({
    mutationFn: (id: string) =>
      gqlFetcher(CompleteMaintenanceTaskDocument, { id, createNextOccurrence: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garage', 'maintenance'] });
    },
  });

  // ─── Derived data ───
  const rideStats: RideStats | undefined = profileData?.getRiderProfile?.rideStats;
  const tasks = maintenanceData?.allMaintenanceTasks ?? [];
  const trips = tripsData?.savedTrips?.edges ?? [];
  const dashboard = expenseData?.expenseDashboard;

  const pendingTasks = tasks.filter((t) => t.status === MaintenanceTaskStatus.Pending);
  const overdueTasks = pendingTasks.filter((t) => t.dueDate && daysUntil(t.dueDate) < 0);
  const upcomingTasks = pendingTasks.filter(
    (t) => t.dueDate && daysUntil(t.dueDate) >= 0 && daysUntil(t.dueDate) <= 30,
  );
  const scheduledTasks = pendingTasks.filter((t) => !t.dueDate || daysUntil(t.dueDate) > 30);

  // ─── Loading ───
  if (bikesLoading) {
    return (
      <div className="garage-page">
        <div className="garage-inner">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '128px 0',
            }}
          >
            <div
              className="h-8 w-8 animate-spin rounded-full border-2"
              style={{ borderColor: 'var(--mv-line)', borderTopColor: 'var(--mv-warm-400)' }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ─── Error ───
  if (bikesError) {
    return (
      <div className="garage-page">
        <div className="garage-inner" style={{ textAlign: 'center', padding: '128px 0' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'oklch(0.7 0.21 25 / 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Settings className="h-8 w-8" style={{ color: 'var(--mv-danger)' }} />
          </div>
          <p style={{ fontSize: '18px', color: 'var(--mv-ink-2)' }}>Failed to load garage</p>
          <button
            type="button"
            className="mv-btn primary"
            style={{ marginTop: '16px' }}
            onClick={() => refetchBikes()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ─── Empty ───
  if (bikes.length === 0) {
    return (
      <div className="garage-page">
        <div className="garage-inner" style={{ textAlign: 'center', padding: '128px 0' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'oklch(0.84 0.15 68 / 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Bike className="h-8 w-8" style={{ color: 'var(--mv-warm-400)' }} />
          </div>
          <h2
            style={{ fontSize: '22px', fontWeight: 500, color: 'var(--mv-ink)', margin: '0 0 8px' }}
          >
            No bikes yet
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--mv-ink-3)',
              maxWidth: '360px',
              margin: '0 auto',
            }}
          >
            Add your first motorcycle in the MotoVault mobile app to see it here.
          </p>

          {/* Still show saved trips if any */}
          {trips.length > 0 && <SavedTripsSection trips={trips} />}
        </div>
      </div>
    );
  }

  const displayNameText = user?.displayName ?? user?.fullName ?? 'Rider';

  return (
    <div className="garage-page">
      <div className="garage-inner">
        {/* ─── Page Header ─── */}
        <header className="garage-header">
          <div>
            <h1 className="garage-title">
              My <span className="serif">garage</span>
            </h1>
            <div className="garage-meta">
              <span>
                {bikes.length} bike{bikes.length !== 1 ? 's' : ''} in garage
              </span>
            </div>
          </div>
          <div className="garage-greet">
            Welcome back,
            <br />
            <strong>{displayNameText}.</strong>
            {overdueTasks.length > 0 &&
              ` ${overdueTasks.length} task${overdueTasks.length !== 1 ? 's' : ''} overdue.`}
          </div>
        </header>

        {/* ─── Section A: Quick Stats ─── */}
        <QuickStats
          bikeCount={bikes.length}
          ytdSpend={dashboard?.currentYearTotal ?? 0}
          pendingTaskCount={pendingTasks.length}
          overdueCount={overdueTasks.length}
          totalRides={rideStats?.totalRides ?? 0}
          totalDistance={rideStats?.totalDistance ?? 0}
          isPro={isPro}
        />

        {/* ─── Section B: Motorcycles ─── */}
        <div className="sect-header" style={{ marginTop: '0' }}>
          <div className="sect-header-left">
            <h3>Motorcycles</h3>
            <span className="sect-header-meta">
              {bikes.length} in garage {!isPro && bikes.length > 1 ? `\u00B7 1 visible` : ''}
            </span>
          </div>
        </div>

        <div className="bikes-grid">
          {bikes.map((bike, index) => {
            const isLocked = !isPro && index > 0;
            return (
              <BikeCard
                key={bike.id}
                bike={bike}
                isLocked={isLocked}
                onLogExpense={() => setExpenseModalOpen(true)}
              />
            );
          })}
        </div>

        {/* ─── Section C: Expense Dashboard ─── */}
        <div className="sect-header">
          <div className="sect-header-left">
            <h3>
              Expense <span className="serif">dashboard</span>
            </h3>
            <span className="sect-header-meta">YTD &middot; {new Date().getFullYear()}</span>
          </div>
          <div className="sect-header-actions">
            <button type="button" className="mv-btn warm" onClick={() => setExpenseModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Log expense
            </button>
          </div>
        </div>

        <ProGate
          feature="expense tracking"
          description="Track every dollar spent on your bikes with detailed breakdowns and monthly trends — fuel, parts, service, the lot."
          isPro={isPro}
        >
          <ExpenseDashboardPanel dashboard={dashboard} />
        </ProGate>

        {/* ─── Section D: Maintenance ─── */}
        <div className="sect-header" id="maintenance">
          <div className="sect-header-left">
            <h3>Maintenance</h3>
            <span className="sect-header-meta">
              {pendingTasks.length} task{pendingTasks.length !== 1 ? 's' : ''}
              {overdueTasks.length > 0 ? ` \u00B7 ${overdueTasks.length} overdue` : ''}
            </span>
          </div>
        </div>

        <ProGate
          feature="maintenance tracking"
          description="Never miss an oil change, chain adjustment, or tire swap. Mileage- and time-based reminders for every bike you own."
          isPro={isPro}
        >
          <MaintenanceSection
            overdue={overdueTasks}
            upcoming={upcomingTasks}
            scheduled={scheduledTasks}
            bikes={bikes}
            onComplete={(id) => completeTaskMutation.mutate(id)}
            isCompleting={completeTaskMutation.isPending}
          />
        </ProGate>

        {/* ─── Section E: Saved Trips ─── */}
        <SavedTripsSection trips={trips} />

        {/* ─── Expense Modal ─── */}
        {expenseModalOpen && (
          <LogExpenseModal bikes={bikes} onClose={() => setExpenseModalOpen(false)} />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Quick Stats Bar
// ═══════════════════════════════════════════════
function QuickStats({
  bikeCount,
  ytdSpend,
  pendingTaskCount,
  overdueCount,
  totalRides,
  totalDistance,
  isPro,
}: {
  bikeCount: number;
  ytdSpend: number;
  pendingTaskCount: number;
  overdueCount: number;
  totalRides: number;
  totalDistance: number;
  isPro: boolean;
}) {
  return (
    <div className="stats-bar">
      <div className="stat-card">
        <div className="stat-top">
          <div className="stat-icon">
            <Bike className="h-4 w-4" />
          </div>
          <div className="stat-trend flat">
            {bikeCount} / {isPro ? 'unlimited' : '1 free'}
          </div>
        </div>
        <div className="stat-num ink">{bikeCount}</div>
        <div className="stat-lbl">Bikes</div>
      </div>

      <div className="stat-card">
        <div className="stat-top">
          <div className="stat-icon">
            <CircleDollarSign className="h-4 w-4" />
          </div>
          <div className="stat-trend">YTD</div>
        </div>
        <div className="stat-num">{formatCurrencyShort(ytdSpend)}</div>
        <div className="stat-lbl">YTD Spend</div>
      </div>

      <div className="stat-card">
        <div className="stat-top">
          <div className="stat-icon">
            <Wrench className="h-4 w-4" />
          </div>
          {overdueCount > 0 ? (
            <div className="stat-trend warn">{overdueCount} overdue</div>
          ) : (
            <div className="stat-trend">All clear</div>
          )}
        </div>
        <div className="stat-num ink">{pendingTaskCount}</div>
        <div className="stat-lbl">Upcoming Tasks</div>
      </div>

      <div className="stat-card">
        <div className="stat-top">
          <div className="stat-icon">
            <Route className="h-4 w-4" />
          </div>
          <div className="stat-trend">
            {totalDistance > 0
              ? `${(totalDistance / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })} km`
              : ''}
          </div>
        </div>
        <div className="stat-num ink">{totalRides}</div>
        <div className="stat-lbl">Total Rides</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Bike Card
// ═══════════════════════════════════════════════
function BikeCard({
  bike,
  isLocked,
  onLogExpense,
}: {
  bike: Motorcycle;
  isLocked: boolean;
  onLogExpense: () => void;
}) {
  const ownedSince = bike.purchaseDate
    ? new Date(bike.purchaseDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    : null;

  return (
    <article className={`bike-card${isLocked ? ' locked' : ''}`}>
      <div className="bike-photo">
        {bike.primaryPhotoUrl ? (
          <Image
            src={bike.primaryPhotoUrl}
            alt={bike.nickname || `${bike.year} ${bike.make} ${bike.model}`}
            fill
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className="bike-photo-empty">
            <Bike className="h-12 w-12" />
          </div>
        )}
        {bike.isPrimary && (
          <span className="bike-tag primary">
            <span className="dot" />
            Primary
          </span>
        )}
      </div>
      <div className="bike-body">
        <div>
          <h4 className="bike-name">
            {bike.nickname ? (
              <>
                {bike.nickname.split(' ').slice(0, -1).join(' ')}{' '}
                <span className="serif">{bike.nickname.split(' ').pop()}</span>
              </>
            ) : (
              `${bike.year} ${bike.make} ${bike.model}`
            )}
          </h4>
          {bike.nickname && (
            <p className="bike-sub">
              {bike.year} {bike.make} {bike.model}
            </p>
          )}
        </div>

        <div className="bike-stats-grid">
          <div className="bike-cell">
            <div className="bike-cell-num">
              {bike.currentMileage != null ? bike.currentMileage.toLocaleString() : '--'}
              <span className="unit">{bike.mileageUnit ?? 'km'}</span>
            </div>
            <div className="bike-cell-lbl">Mileage</div>
          </div>
          <div className="bike-cell">
            <div className="bike-cell-num">{ownedSince ?? '--'}</div>
            <div className="bike-cell-lbl">Owned since</div>
          </div>
          <div className="bike-cell">
            <div className="bike-cell-num">
              {bike.engineCc ?? '--'}
              {bike.engineCc && <span className="unit">cc</span>}
            </div>
            <div className="bike-cell-lbl">Displacement</div>
          </div>
        </div>

        <div className="bike-actions">
          <button type="button" className="mv-btn primary" onClick={onLogExpense}>
            <CircleDollarSign className="h-3.5 w-3.5" />
            Log expense
          </button>
          <a href="#maintenance" className="mv-btn">
            <Wrench className="h-3.5 w-3.5" />
            View maintenance
          </a>
        </div>
      </div>

      {isLocked && (
        <div className="bike-lock-overlay">
          <div className="bike-lock-card">
            <div className="bike-lock-icon">
              <Lock className="h-5 w-5" />
            </div>
            <h5 className="bike-lock-title">
              Multi-bike garage is{' '}
              <span className="serif" style={{ color: 'var(--mv-warm-300)' }}>
                Pro
              </span>
            </h5>
            <p className="bike-lock-desc">
              Free riders get one bike. Upgrade to manage every bike with separate histories.
            </p>
            <a className="bike-lock-cta" href="/pro/checkout?redirect=/garage">
              <Crown className="h-3.5 w-3.5" />
              Upgrade to Pro
            </a>
          </div>
        </div>
      )}
    </article>
  );
}

// ═══════════════════════════════════════════════
// Expense Dashboard Panel
// ═══════════════════════════════════════════════
function ExpenseDashboardPanel({
  dashboard,
}: {
  dashboard: ExpenseDashboardQuery['expenseDashboard'] | undefined;
}) {
  const currentMonth = new Date().getMonth(); // 0-indexed

  if (!dashboard) {
    return (
      <div className="exp-grid" style={{ minHeight: '200px' }}>
        <div
          className="exp-left"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <p style={{ color: 'var(--mv-ink-3)', fontSize: '14px' }}>
            No expense data yet. Log your first expense to see insights.
          </p>
        </div>
        <div className="exp-right" />
      </div>
    );
  }

  const { currentYearTotal, monthlyBuckets, categoryTotals } = dashboard;

  // Build 12-month array
  const monthlyTotals = Array.from({ length: 12 }, (_, i) => {
    const bucket = monthlyBuckets.find((b) => b.month === i + 1);
    return bucket?.total ?? 0;
  });

  const peakMonth = monthlyTotals.reduce((max, val, i) => (val > monthlyTotals[max] ? i : max), 0);
  const peakValue = monthlyTotals[peakMonth];

  // Top categories sorted by total
  const sortedCats = [...categoryTotals].sort((a, b) => b.total - a.total);

  // Recent expenses from category data - we don't have individual expenses in the dashboard
  // so we just show the category breakdown

  return (
    <div className="exp-grid">
      <div className="exp-left">
        <div className="exp-eyebrow">Year to date</div>
        <h4 className="exp-total">
          <span className="currency">$</span>
          {currentYearTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </h4>
        <p className="exp-total-meta">
          {dashboard.previousYearTotal > 0 ? (
            <>
              {currentYearTotal > dashboard.previousYearTotal ? 'Up' : 'Down'}{' '}
              <strong>
                {Math.abs(
                  Math.round(
                    ((currentYearTotal - dashboard.previousYearTotal) /
                      dashboard.previousYearTotal) *
                      100,
                  ),
                )}
                %
              </strong>{' '}
              vs last year.{' '}
            </>
          ) : null}
          <strong>{dashboard.expenseCount}</strong> expense{dashboard.expenseCount !== 1 ? 's' : ''}{' '}
          logged this year.
        </p>

        <div className="exp-bars-section">
          <div className="exp-bars-header">
            <span>Monthly</span>
            {peakValue > 0 && (
              <span>
                Peak &middot; ${peakValue.toLocaleString()} ({MONTH_LABELS[peakMonth]})
              </span>
            )}
          </div>
          <div className="exp-bars-grid">
            {monthlyTotals.map((total, i) => {
              const height = peakValue > 0 ? Math.max(6, (total / peakValue) * 100) : 6;
              const isFuture = i > currentMonth;
              const isCurrent = i === currentMonth;
              return (
                <div
                  key={MONTH_LABELS[i]}
                  className={`exp-bar${isFuture ? ' muted' : ''}${isCurrent ? ' current' : ''}`}
                  style={{ height: `${isFuture ? 8 : height}%` }}
                />
              );
            })}
          </div>
          <div className="exp-bars-axis">
            {MONTH_LABELS.map((label, i) => (
              <span key={label + String(i)} className={i === currentMonth ? 'current' : ''}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="exp-right">
        <div className="cats-header">
          <h4>By category</h4>
          <span className="total">
            ${currentYearTotal.toLocaleString()} &middot; {sortedCats.length} cat
            {sortedCats.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div>
          {sortedCats.map((cat) => {
            const pct = currentYearTotal > 0 ? Math.round((cat.total / currentYearTotal) * 100) : 0;
            return (
              <div key={cat.category} className="cat-row">
                <div className="cat-icon">
                  {CATEGORY_ICONS[cat.category] ?? <CircleDollarSign className="h-3.5 w-3.5" />}
                </div>
                <div className="cat-mid">
                  <div className="cat-name">
                    {cat.category.charAt(0).toUpperCase() + cat.category.slice(1)}
                    <span className="cat-pct">{pct}%</span>
                  </div>
                  <div className="cat-bar">
                    <span className="cat-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="cat-amt">${cat.total.toLocaleString()}</div>
              </div>
            );
          })}
        </div>

        {sortedCats.length === 0 && (
          <p style={{ color: 'var(--mv-ink-3)', fontSize: '13px', marginTop: '20px' }}>
            No expenses logged yet this year. Tap &ldquo;Log expense&rdquo; to get started.
          </p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Maintenance Section
// ═══════════════════════════════════════════════
function MaintenanceSection({
  overdue,
  upcoming,
  scheduled,
  bikes,
  onComplete,
  isCompleting,
}: {
  overdue: Task[];
  upcoming: Task[];
  scheduled: Task[];
  bikes: Motorcycle[];
  onComplete: (id: string) => void;
  isCompleting: boolean;
}) {
  const getBikeName = (motorcycleId: string) => {
    const bike = bikes.find((b) => b.id === motorcycleId);
    if (!bike) return '';
    return bike.nickname ?? `${bike.make} ${bike.model}`;
  };

  if (overdue.length === 0 && upcoming.length === 0 && scheduled.length === 0) {
    return (
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          border: '1px solid var(--mv-line)',
          borderRadius: '14px',
          background: 'oklch(0.1 0.008 55 / 0.5)',
        }}
      >
        <CheckCircle2
          className="h-8 w-8"
          style={{ color: 'var(--mv-success)', margin: '0 auto 12px' }}
        />
        <p style={{ color: 'var(--mv-ink-2)', fontSize: '15px', fontWeight: 500 }}>All caught up</p>
        <p style={{ color: 'var(--mv-ink-3)', fontSize: '13px', marginTop: '4px' }}>
          No pending maintenance tasks. Add tasks in the mobile app.
        </p>
      </div>
    );
  }

  return (
    <div>
      {overdue.length > 0 && (
        <TaskGroup
          label="Overdue"
          variant="overdue"
          tasks={overdue}
          getBikeName={getBikeName}
          onComplete={onComplete}
          isCompleting={isCompleting}
        />
      )}
      {upcoming.length > 0 && (
        <TaskGroup
          label="Upcoming"
          variant="upcoming"
          tasks={upcoming}
          getBikeName={getBikeName}
          onComplete={onComplete}
          isCompleting={isCompleting}
        />
      )}
      {scheduled.length > 0 && (
        <TaskGroup
          label="Scheduled"
          variant="scheduled"
          tasks={scheduled}
          getBikeName={getBikeName}
          onComplete={onComplete}
          isCompleting={isCompleting}
        />
      )}
    </div>
  );
}

function TaskGroup({
  label,
  variant,
  tasks,
  getBikeName,
  onComplete,
  isCompleting,
}: {
  label: string;
  variant: 'overdue' | 'upcoming' | 'scheduled';
  tasks: Task[];
  getBikeName: (id: string) => string;
  onComplete: (id: string) => void;
  isCompleting: boolean;
}) {
  const priorityLabel = (p: MaintenancePriority) => {
    if (p === MaintenancePriority.Critical) return 'critical';
    if (p === MaintenancePriority.High) return 'high';
    return 'normal';
  };

  return (
    <div className={`maint-group ${variant}`} style={{ marginBottom: '24px' }}>
      <div className="maint-group-header">
        <span className="pip" />
        <span className="group-label">{label}</span>
        <span className="count">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="task-list">
        {tasks.map((task) => {
          const days = task.dueDate ? daysUntil(task.dueDate) : null;
          const bikeName = getBikeName(task.motorcycleId);
          return (
            <div key={task.id} className={`task-item ${variant}`}>
              <div className="task-bar" />
              <div className="task-mid">
                <div className="task-title-row">
                  <h5 className="task-title">{task.title}</h5>
                  <span className={`task-priority ${priorityLabel(task.priority)}`}>
                    {task.priority === MaintenancePriority.Critical
                      ? 'Critical'
                      : task.priority === MaintenancePriority.High
                        ? 'High'
                        : 'Normal'}
                  </span>
                </div>
                <div className="task-meta">
                  {bikeName && <span>{bikeName}</span>}
                  {task.targetMileage && (
                    <>
                      <span className="dot" />
                      <span>Target {task.targetMileage.toLocaleString()} km</span>
                    </>
                  )}
                </div>
              </div>
              {task.dueDate && (
                <div className="task-due">
                  <small>{days != null && days < 0 ? 'Was due' : 'Due'}</small>
                  <strong>
                    {formatShortDate(task.dueDate)}
                    {days != null && days < 0
                      ? ` \u00B7 ${Math.abs(days)}d late`
                      : days != null
                        ? ` \u00B7 ${days}d`
                        : ''}
                  </strong>
                </div>
              )}
              <button
                type="button"
                className={`mv-btn${variant === 'overdue' ? ' primary' : ''}`}
                onClick={() => onComplete(task.id)}
                disabled={isCompleting}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark done
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Saved Trips Section
// ═══════════════════════════════════════════════
function SavedTripsSection({ trips }: { trips: TripEdge[] }) {
  return (
    <>
      <div className="sect-header">
        <div className="sect-header-left">
          <h3>
            Saved <span className="serif">trips</span>
          </h3>
          <span className="sect-header-meta">{trips.length} saved</span>
        </div>
        <div className="sect-header-actions">
          <Link href="/explore" className="mv-btn ghost">
            Browse explore &rarr;
          </Link>
        </div>
      </div>

      {trips.length === 0 ? (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            border: '1px solid var(--mv-line)',
            borderRadius: '14px',
            background: 'oklch(0.1 0.008 55 / 0.5)',
          }}
        >
          <Route className="h-8 w-8" style={{ color: 'var(--mv-ink-3)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--mv-ink-2)', fontSize: '15px', fontWeight: 500 }}>
            No saved trips yet
          </p>
          <p style={{ color: 'var(--mv-ink-3)', fontSize: '13px', marginTop: '4px' }}>
            <Link
              href="/explore"
              style={{
                color: 'var(--mv-warm-400)',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
            >
              Explore routes
            </Link>{' '}
            and save your favourites here.
          </p>
        </div>
      ) : (
        <div className="trips-grid">
          {trips.map(({ node: trip }) => {
            const href =
              trip.countryCode && trip.regionCode && trip.slug
                ? `/trips/${trip.countryCode.toLowerCase()}/${trip.regionCode.toLowerCase()}/${trip.slug}`
                : `/trips/${trip.id}`;
            const distanceKm = trip.distanceM ? Math.round(trip.distanceM / 1000) : null;
            const flag = countryFlag(trip.countryCode);
            const diffClass = trip.difficulty?.toLowerCase() ?? 'intermediate';
            const gradient = DIFFICULTY_GRADIENTS[diffClass] ?? DIFFICULTY_GRADIENTS.intermediate;

            return (
              <Link key={trip.id} href={href} className="trip-card">
                <div className="trip-bg" style={{ background: gradient }}>
                  <div className="trip-bg-grid" />
                </div>
                <div className="trip-top">
                  <span className="trip-flag">
                    {flag} {trip.countryCode?.toUpperCase()}{' '}
                    {trip.city
                      ? `\u00B7 ${trip.city}`
                      : trip.regionCode
                        ? `\u00B7 ${trip.regionCode.toUpperCase()}`
                        : ''}
                  </span>
                </div>
                <div className="trip-body">
                  <h4 className="trip-title">{trip.title}</h4>
                  <div className="trip-stats">
                    {distanceKm && <span>{distanceKm.toLocaleString()} km</span>}
                    {trip.dayCount && (
                      <>
                        <span className="dot" />
                        <span>
                          {trip.dayCount} day{trip.dayCount !== 1 ? 's' : ''}
                        </span>
                      </>
                    )}
                    {trip.difficulty && (
                      <>
                        <span className="dot" />
                        <span className={`trip-difficulty ${diffClass}`}>
                          <span className="pip" />
                          {trip.difficulty}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
