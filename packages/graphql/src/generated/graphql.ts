/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type AddDocumentCategoryInput = {
  name: string;
};

export type AddExpensePhotoInput = {
  bucket?: string | null | undefined;
  expenseId: string;
  fileSizeBytes?: number | null | undefined;
  storagePath: string;
};

export type AddNotePhotoInput = {
  fileSizeBytes?: number | null | undefined;
  noteId: string;
  storagePath: string;
};

export type AddTaskPhotoInput = {
  bucket?: string | null | undefined;
  fileSizeBytes?: number | null | undefined;
  storagePath: string;
  taskId: string;
};

/** Affiliate partner for product recommendations */
export enum AffiliatePartner {
  Amazon = 'amazon',
  Revzilla = 'revzilla',
  RockyMountain = 'rocky_mountain'
}

export type ApproveMaintenanceDraftInput = {
  id: string | number;
  kind: string;
};

export enum ArticleCategory {
  Brakes = 'brakes',
  Drivetrain = 'drivetrain',
  Electrical = 'electrical',
  Engine = 'engine',
  Fuel = 'fuel',
  General = 'general',
  Suspension = 'suspension',
  Tires = 'tires'
}

export enum ArticleDifficulty {
  Advanced = 'advanced',
  Beginner = 'beginner',
  Intermediate = 'intermediate'
}

export type AskTripAssistantInput = {
  history?: Array<TripAssistantHistoryMessage> | null | undefined;
  question: string;
  tripId: string | number;
};

/** Role of a message in the trip assistant conversation. */
export enum AssistantMessageRole {
  Assistant = 'assistant',
  User = 'user'
}

/** Outcome of creating a Stripe billing portal session for a web subscriber. */
export enum BillingPortalStatus {
  NotConfigured = 'not_configured',
  NotFound = 'not_found',
  Ok = 'ok',
  Unavailable = 'unavailable'
}

export type BlogTranslationInput = {
  bodyRaw: string;
  excerpt?: string | null | undefined;
  faq?: Record<string, unknown> | null | undefined;
  locale: string;
  readingTime?: string | null | undefined;
  seoDescription?: string | null | undefined;
  seoTitle?: string | null | undefined;
  title: string;
};

export type CompleteMaintenanceTaskInput = {
  completedMileage?: number | null | undefined;
  cost?: number | null | undefined;
  currency?: string | null | undefined;
  laborCost?: number | null | undefined;
  partsCost?: number | null | undefined;
};

export type CompleteOnboardingInput = {
  /** OEM schedule IDs the user accepted in the maintenance swipe screen */
  acceptedOemScheduleIds?: Array<string> | null | undefined;
  annualRepairSpend?: string | null | undefined;
  bikeMake?: string | null | undefined;
  bikeMileage?: number | null | undefined;
  bikeMileageUnit?: string | null | undefined;
  bikeModel?: string | null | undefined;
  bikeNickname?: string | null | undefined;
  bikePhotoUrl?: string | null | undefined;
  bikeType?: string | null | undefined;
  bikeYear?: number | null | undefined;
  currency?: string | null | undefined;
  /** UUID for client-server event deduplication with Meta CAPI */
  eventId?: string | null | undefined;
  experienceLevel: string;
  /** Meta click ID from deep link for CAPI attribution */
  fbclid?: string | null | undefined;
  /** Sent only when the contact opt-in line was ticked; saved with the account email */
  feedbackContactOptIn?: FeedbackContactOptInInput | null | undefined;
  lastServiceDate?: string | null | undefined;
  learningFormats: Array<string>;
  maintenanceReminders?: boolean | null | undefined;
  maintenanceStyle?: string | null | undefined;
  recallAlerts?: boolean | null | undefined;
  reminderChannel?: string | null | undefined;
  ridingFrequency?: string | null | undefined;
  ridingGoals: Array<string>;
  seasonalTips?: boolean | null | undefined;
  weeklySummary?: boolean | null | undefined;
};

export type CreateBlogCategoryInput = {
  name: string;
  parentId?: string | number | null | undefined;
};

export type CreateBlogKeywordInput = {
  name: string;
};

export type CreateBlogPostInput = {
  author?: string | null | undefined;
  categoryIds?: Array<string | number> | null | undefined;
  coverAlt?: string | null | undefined;
  coverImage?: string | null | undefined;
  isSafetyCritical?: boolean | null | undefined;
  keywordIds?: Array<string | number> | null | undefined;
  scheduledFor?: string | null | undefined;
  slug: string;
  specData?: boolean | null | undefined;
  status?: string | null | undefined;
  translations: Array<BlogTranslationInput>;
  type: string;
  typeData: Record<string, unknown>;
};

export type CreateCommentInput = {
  groupRideId?: string | number | null | undefined;
  parentCommentId?: string | number | null | undefined;
  rideId?: string | number | null | undefined;
  routeId?: string | number | null | undefined;
  text: string;
  tripId?: string | number | null | undefined;
};

export type CreateDiagnosticInput = {
  dataSharingOptedIn?: boolean;
  motorcycleId?: string | null | undefined;
  wizardAnswers?: Record<string, unknown> | null | undefined;
};

export type CreateDocumentInput = {
  categoryId: string;
  documentId: string;
  expiryDate?: string | null | undefined;
  files: Array<DocumentFileInput>;
  motorcycleId: string;
  note?: string | null | undefined;
  title: string;
};

export type CreateFlagInput = {
  articleId: string;
  comment: string;
  sectionReference?: string | null | undefined;
};

export type CreateGroupRideInput = {
  dateTime: string;
  description: string;
  difficulty: string;
  maxRiders: number;
  meetingPointLat: number;
  meetingPointLng: number;
  meetingPointName?: string | null | undefined;
  routeDescription?: string | null | undefined;
  routeId?: string | null | undefined;
  title: string;
};

export type CreateMaintenanceTaskInput = {
  completedAt?: string | null | undefined;
  completedMileage?: number | null | undefined;
  cost?: number | null | undefined;
  currency?: string | null | undefined;
  description?: string | null | undefined;
  dueDate?: string | null | undefined;
  intervalDays?: number | null | undefined;
  intervalKm?: number | null | undefined;
  isRecurring?: boolean | null | undefined;
  laborCost?: number | null | undefined;
  motorcycleId: string;
  notes?: string | null | undefined;
  partsCost?: number | null | undefined;
  partsNeeded?: Array<string> | null | undefined;
  priority?: MaintenancePriority | null | undefined;
  remind1d?: boolean | null | undefined;
  remind7d?: boolean | null | undefined;
  remind30d?: boolean | null | undefined;
  status?: MaintenanceTaskStatus | null | undefined;
  targetMileage?: number | null | undefined;
  title: string;
};

export type CreateMotorcycleInput = {
  make: string;
  model: string;
  nickname?: string | null | undefined;
  variant?: string | null | undefined;
  year: number;
};

export type CreateNoteInput = {
  alsoCreateTask?: boolean | null | undefined;
  motorcycleId: string;
  odometer?: number | null | undefined;
  text: string;
};

export type CreateServiceReminderInput = {
  intervalDays?: number | null | undefined;
  intervalKm?: number | null | undefined;
  motorcycleId: string;
  serviceType: MaintenanceServiceType;
};

export type CreateShareLinkInput = {
  expiresInDays?: number | null | undefined;
  motorcycleId: string;
};

export type CreateTripInput = {
  description: string;
  difficulty: string;
  endDate: string;
  maxRiders: number;
  startDate: string;
  title: string;
};

export type CreateTripReviewInput = {
  bikeId?: string | number | null | undefined;
  conditionTags?: Array<string> | null | undefined;
  rating: number;
  text?: string | null | undefined;
  tripId: string | number;
};

export type CreateTripSuggestionInput = {
  dayIndex?: number | null | undefined;
  kind?: TripSuggestionKind;
  lat?: number | null | undefined;
  lng?: number | null | undefined;
  name: string;
  notes?: string | null | undefined;
  periodOfDay?: PeriodOfDay | null | undefined;
  tripId: string | number;
};

export type CreateTripWithWaypointsInput = {
  dayCount?: number | null | undefined;
  description: string;
  difficulty: string;
  endDate?: string | null | undefined;
  isShowcase?: boolean | null | undefined;
  maxRiders: number;
  startDate?: string | null | undefined;
  title: string;
  visibility?: string | null | undefined;
  waypoints: Array<InlineWaypointInput>;
};

export type CreateWaypointInput = {
  dayIndex?: number;
  lat: number;
  lng: number;
  name: string;
  notes?: string | null | undefined;
  periodOfDay?: PeriodOfDay | null | undefined;
  sortOrder: number;
  tripId: string | number;
  type: string;
};

export enum DiagnosticSeverity {
  Critical = 'critical',
  High = 'high',
  Low = 'low',
  Medium = 'medium'
}

export type DocumentFileInput = {
  fileSizeBytes: number;
  mimeType: string;
  storagePath: string;
};

export type EndRideInput = {
  autoPausedDurationS?: number;
  avgSpeedMps?: number | null | undefined;
  distanceM?: number;
  elevationGain?: number | null | undefined;
  elevationLoss?: number | null | undefined;
  endSource?: string | null | undefined;
  endedAt: string;
  gpsQuality?: number | null | undefined;
  maxLeanAngle?: number | null | undefined;
  maxSpeedMps?: number | null | undefined;
  odometerAtEnd?: number | null | undefined;
  passenger?: boolean | null | undefined;
  pausedDurationS?: number;
  purpose?: string | null | undefined;
  rideId: string;
  routePolyline?: string | null | undefined;
};

export type FeedbackContactOptInInput = {
  /** App locale the opt-in line was shown in */
  locale: string;
  /** FEEDBACK_CONTACT_WORDING_VERSION shown with the opt-in line */
  wordingVersion: number;
};

export enum FlagStatus {
  Dismissed = 'dismissed',
  Pending = 'pending',
  Resolved = 'resolved',
  Reviewed = 'reviewed'
}

export type FollowRiderInput = {
  targetUserId: string;
};

export type GenerateArticleInput = {
  category?: ArticleCategory | null | undefined;
  difficulty?: ArticleDifficulty | null | undefined;
  topic: string;
};

export type GenerateInsightsInput = {
  bikeMake?: string | null | undefined;
  bikeModel?: string | null | undefined;
  bikeType?: string | null | undefined;
  bikeYear?: number | null | undefined;
  currentMileage?: number | null | undefined;
  experienceLevel: string;
  maintenanceStyle?: string | null | undefined;
  ridingFrequency?: string | null | undefined;
};

export type GenerateReportInput = {
  bikeId: string;
};

/** Status of AI content generation (e.g. ride summaries) */
export enum GenerationStatus {
  Completed = 'completed',
  Failed = 'failed',
  Pending = 'pending'
}

/** Status of a bike health report generation */
export enum HealthReportStatus {
  Completed = 'completed',
  Failed = 'failed',
  Pending = 'pending'
}

export type InlineWaypointInput = {
  dayIndex?: number;
  lat: number;
  lng: number;
  name: string;
  notes?: string | null | undefined;
  periodOfDay?: PeriodOfDay | null | undefined;
  sortOrder: number;
  type: string;
};

export enum InsightType {
  Community = 'community',
  Learning = 'learning',
  Maintenance = 'maintenance'
}

export type JoinTripInput = {
  bikeId?: string | number | null | undefined;
  status?: string | null | undefined;
  tripId: string | number;
};

export type ListBlogPostsInput = {
  after?: string | null | undefined;
  first?: number | null | undefined;
  status?: string | null | undefined;
  type?: string | null | undefined;
};

export type LogExpenseInput = {
  amount: number;
  category: string;
  currency?: string | null | undefined;
  date: string;
  description?: string | null | undefined;
  itemName?: string | null | undefined;
  motorcycleId: string;
};

export type LogOdometerReadingInput = {
  motorcycleId: string;
  recordedAt?: string | null | undefined;
  value: number;
};

export enum MaintenancePriority {
  Critical = 'critical',
  High = 'high',
  Low = 'low',
  Medium = 'medium'
}

export enum MaintenanceServiceType {
  AirFilter = 'air_filter',
  Battery = 'battery',
  Belt = 'belt',
  BrakeFluid = 'brake_fluid',
  BrakePads = 'brake_pads',
  Chain = 'chain',
  Coolant = 'coolant',
  FinalDrive = 'final_drive',
  ForkOil = 'fork_oil',
  GeneralService = 'general_service',
  OilChange = 'oil_change',
  OilFilter = 'oil_filter',
  Other = 'other',
  SparkPlug = 'spark_plug',
  Tire = 'tire',
  TransmissionOil = 'transmission_oil',
  ValveClearance = 'valve_clearance'
}

export enum MaintenanceTaskSource {
  Imported = 'imported',
  Oem = 'oem',
  ReceiptScan = 'receipt_scan',
  User = 'user'
}

export enum MaintenanceTaskStatus {
  Completed = 'completed',
  InProgress = 'in_progress',
  Pending = 'pending',
  Skipped = 'skipped'
}

export type ManualBikeInfoInput = {
  make?: string | null | undefined;
  model?: string | null | undefined;
  type: MotorcycleType;
  year?: number | null | undefined;
};

/** Type/category of motorcycle */
export enum MotorcycleType {
  Cruiser = 'cruiser',
  DirtBike = 'dirt_bike',
  DualSport = 'dual_sport',
  Other = 'other',
  Scooter = 'scooter',
  Sportbike = 'sportbike',
  Standard = 'standard',
  Touring = 'touring'
}

/** Role of a trip participant. */
export enum ParticipantRole {
  CoPlanner = 'co_planner',
  Organizer = 'organizer',
  Rider = 'rider'
}

/** Period of the day assigned to a waypoint or ride segment. */
export enum PeriodOfDay {
  Afternoon = 'afternoon',
  Evening = 'evening',
  Morning = 'morning'
}

export type RegisterPushTokenInput = {
  /** The device platform: 'ios' or 'android'. */
  platform: string;
  /** The Expo push token for this device. */
  token: string;
};

export type ReorderWaypointsInput = {
  tripId: string | number;
  waypointIds: Array<string | number>;
};

export type RespondToTripSuggestionInput = {
  decision: TripSuggestionDecision;
  note?: string | null | undefined;
  suggestionId: string | number;
};

export type RidePauseInput = {
  rideId: string;
};

/** Current status of a ride */
export enum RideStatus {
  Completed = 'completed',
  Paused = 'paused',
  Recording = 'recording'
}

/** A group state. Precedence: NOT_ENOUGH (under five qualifying rides), COMPUTING (a ride has no stats yet), MISSING_INPUT, LOCKED (not Pro), READY. */
export enum RiderInsightsStatus {
  Computing = 'COMPUTING',
  Locked = 'LOCKED',
  MissingInput = 'MISSING_INPUT',
  NotEnough = 'NOT_ENOUGH',
  Ready = 'READY'
}

export type SaveReceiptScanInput = {
  amount?: number | null | undefined;
  applyOdometer?: boolean | null | undefined;
  category?: string | null | undefined;
  currency?: string | null | undefined;
  date?: string | null | undefined;
  itemName?: string | null | undefined;
  laborCost?: number | null | undefined;
  lineItems?: Array<SaveReceiptScanLineItemInput> | null | undefined;
  motorcycleId: string;
  odometerUnit?: string | null | undefined;
  odometerValue?: number | null | undefined;
  partsCost?: number | null | undefined;
  taxAmount?: number | null | undefined;
  taxRate?: number | null | undefined;
  type: string;
  vendor?: string | null | undefined;
};

export type SaveReceiptScanLineItemInput = {
  label: string;
  lineTotal?: number | null | undefined;
  partRef?: string | null | undefined;
  quantity?: number | null | undefined;
  serviceType?: string | null | undefined;
  unitPrice?: number | null | undefined;
};

export type ScheduleBlogPostInput = {
  id: string | number;
  scheduledFor: string;
};

export type SearchArticlesInput = {
  after?: string | null | undefined;
  category?: ArticleCategory | null | undefined;
  difficulty?: ArticleDifficulty | null | undefined;
  first?: number | null | undefined;
  query?: string | null | undefined;
};

export type SendFeedbackInput = {
  appVersion: string;
  /** Client-generated UUID per draft; reuse it on retry so the message is saved once */
  clientId: string | number;
  /** Email to reach the rider at; omit or null to use the account email */
  contactEmail?: string | null | undefined;
  /** The developer may contact me about my feedback */
  contactOptIn: boolean;
  /** FEEDBACK_CONTACT_WORDING_VERSION shown with the opt-in */
  contactWordingVersion: number;
  /** App locale the form was shown in */
  locale: string;
  /** 1-4000 characters after trimming */
  message: string;
  /** ios | android */
  platform: string;
  /** love | wish | broken */
  quickPick?: string | null | undefined;
  /** expo-updates update id, when running an update */
  updateId?: string | null | undefined;
};

export type SetParticipantRoleInput = {
  role: ParticipantRole;
  tripId: string | number;
  userId: string | number;
};

export type ShareRideAsTripInput = {
  name?: string | null | undefined;
  rideId: string | number;
  surfaceType?: string | null | undefined;
};

export type StartRideInput = {
  motorcycleId?: string | null | undefined;
  rideId: string;
  startedAt: string;
  timeZone?: string | null | undefined;
};

export type SubmitDiagnosticInput = {
  additionalNotes?: string | null | undefined;
  dataSharingOptedIn?: boolean;
  freeTextDescription?: string | null | undefined;
  includeBikeHistory?: boolean | null | undefined;
  includeMaintenanceHistory?: boolean;
  manualBikeInfo?: ManualBikeInfoInput | null | undefined;
  motorcycleId?: string | null | undefined;
  photoBase64?: string | null | undefined;
  urgency?: Urgency | null | undefined;
  wizardAnswers?: Record<string, unknown> | null | undefined;
};

export type TrackClickInput = {
  diagnosisType?: string | null | undefined;
  partner: AffiliatePartner;
  productUrl: string;
};

export type TripAssistantHistoryMessage = {
  content: string;
  role: AssistantMessageRole;
};

/** Decision applied to a pending trip suggestion. */
export enum TripSuggestionDecision {
  Accepted = 'accepted',
  Rejected = 'rejected',
  Withdrawn = 'withdrawn'
}

/** Kind of a trip suggestion (waypoint or note). */
export enum TripSuggestionKind {
  Note = 'note',
  Waypoint = 'waypoint'
}

/** Lifecycle of a trip suggestion. */
export enum TripSuggestionStatus {
  Accepted = 'accepted',
  Pending = 'pending',
  Rejected = 'rejected',
  Withdrawn = 'withdrawn'
}

export type TripTemplateFilterInput = {
  country?: string | null | undefined;
  dayCountMax?: number | null | undefined;
  dayCountMin?: number | null | undefined;
  difficulty?: string | null | undefined;
  region?: string | null | undefined;
  searchText?: string | null | undefined;
  surfaceType?: string | null | undefined;
};

export type UnfollowRiderInput = {
  targetUserId: string;
};

export type UnregisterPushTokenInput = {
  /** The Expo push token to remove from the signed-in account. */
  token: string;
};

export type UpdateBlogPostInput = {
  author?: string | null | undefined;
  categoryIds?: Array<string | number> | null | undefined;
  coverAlt?: string | null | undefined;
  coverImage?: string | null | undefined;
  id: string | number;
  isSafetyCritical?: boolean | null | undefined;
  keywordIds?: Array<string | number> | null | undefined;
  specData?: boolean | null | undefined;
  translations?: Array<BlogTranslationInput> | null | undefined;
  typeData?: Record<string, unknown> | null | undefined;
};

export type UpdateDocumentCategoryInput = {
  isHidden?: boolean | null | undefined;
  name?: string | null | undefined;
};

export type UpdateDocumentInput = {
  categoryId?: string | null | undefined;
  expiryDate?: string | null | undefined;
  isPinned?: boolean | null | undefined;
  note?: string | null | undefined;
  title?: string | null | undefined;
};

export type UpdateMaintenanceTaskInput = {
  description?: string | null | undefined;
  dueDate?: string | null | undefined;
  notes?: string | null | undefined;
  partsNeeded?: Array<string> | null | undefined;
  priority?: MaintenancePriority | null | undefined;
  remind1d?: boolean | null | undefined;
  remind7d?: boolean | null | undefined;
  remind30d?: boolean | null | undefined;
  targetMileage?: number | null | undefined;
  title?: string | null | undefined;
};

export type UpdateMotorcycleInput = {
  currentMileage?: number | null | undefined;
  isPrimary?: boolean | null | undefined;
  make?: string | null | undefined;
  mileageUnit?: string | null | undefined;
  model?: string | null | undefined;
  nickname?: string | null | undefined;
  primaryPhotoUrl?: string | null | undefined;
  purchaseDate?: string | null | undefined;
  purchasePrice?: number | null | undefined;
  variant?: string | null | undefined;
  vin?: string | null | undefined;
  year?: number | null | undefined;
};

export type UpdateNoteInput = {
  odometer?: number | null | undefined;
  text?: string | null | undefined;
};

export type UpdateParticipantStatusInput = {
  status: string;
  tripId: string | number;
};

export type UpdateProfileInput = {
  bio?: string | null | undefined;
  city?: string | null | undefined;
  displayName?: string | null | undefined;
  isPublic?: boolean | null | undefined;
  publicUsername?: string | null | undefined;
};

export type UpdateRideInput = {
  isPublic?: boolean | null | undefined;
  mileageApplied?: boolean | null | undefined;
  name?: string | null | undefined;
  odometerAtEnd?: number | null | undefined;
  passenger?: boolean | null | undefined;
  purpose?: string | null | undefined;
  rideId: string;
};

export type UpdateTripInput = {
  description?: string | null | undefined;
  difficulty?: string | null | undefined;
  endDate?: string | null | undefined;
  maxRiders?: number | null | undefined;
  startDate?: string | null | undefined;
  title?: string | null | undefined;
  tripId: string | number;
  visibility?: string | null | undefined;
  waypoints?: Array<InlineWaypointInput> | null | undefined;
};

export type UpdateUserInput = {
  currency?: string | null | undefined;
  fullName?: string | null | undefined;
  measurementSystem?: string | null | undefined;
  preferences?: Record<string, unknown> | null | undefined;
};

export type UpdateWaypointInput = {
  dayIndex?: number | null | undefined;
  lat?: number | null | undefined;
  lng?: number | null | undefined;
  name?: string | null | undefined;
  notes?: string | null | undefined;
  periodOfDay?: PeriodOfDay | null | undefined;
  sortOrder?: number | null | undefined;
  type?: string | null | undefined;
  waypointId: string | number;
};

export type UploadWaypointsInput = {
  rideId: string;
  waypoints: Array<WaypointInput>;
};

/** User-reported urgency level for diagnostic requests */
export enum Urgency {
  Preventive = 'preventive',
  Soon = 'soon',
  Stranded = 'stranded'
}

export enum UserRole {
  Admin = 'admin',
  User = 'user'
}

export type WaypointInput = {
  accuracy?: number | null | undefined;
  altitude?: number | null | undefined;
  heading?: number | null | undefined;
  latitude: number;
  longitude: number;
  recordedAt: string;
  speedMps?: number | null | undefined;
};

export type WeatherForecastInput = {
  lat: number;
  lon: number;
};

export type AcknowledgeRecallMutationVariables = Exact<{
  motorcycleId: string | number;
  campaignNumber: string;
}>;


export type AcknowledgeRecallMutation = { acknowledgeRecall: { count: number, acknowledgedCount: number, checkedAt: string, vinUsed: string | null, recalls: Array<{ campaignNumber: string, reportDate: string, component: string, summary: string, consequence: string, remedy: string, acknowledged: boolean, acknowledgedAt: string | null }> } };

export type AddDocumentCategoryMutationVariables = Exact<{
  input: AddDocumentCategoryInput;
}>;


export type AddDocumentCategoryMutation = { addDocumentCategory: { id: string, name: string, kind: string, isHidden: boolean, promptsExpiry: boolean, createdAt: string, updatedAt: string } };

export type AddExpensePhotoMutationVariables = Exact<{
  input: AddExpensePhotoInput;
}>;


export type AddExpensePhotoMutation = { addExpensePhoto: { id: string, expenseId: string, storagePath: string, publicUrl: string, fileSizeBytes: number | null, mimeType: string, createdAt: string } };

export type AddNotePhotoMutationVariables = Exact<{
  input: AddNotePhotoInput;
}>;


export type AddNotePhotoMutation = { addNotePhoto: { id: string, noteId: string, storagePath: string, publicUrl: string, fileSizeBytes: number | null, mimeType: string, createdAt: string } };

export type AddTaskPhotoMutationVariables = Exact<{
  input: AddTaskPhotoInput;
}>;


export type AddTaskPhotoMutation = { addTaskPhoto: { id: string, taskId: string, storagePath: string, publicUrl: string, fileSizeBytes: number | null, mimeType: string, createdAt: string } };

export type AddWaypointMutationVariables = Exact<{
  input: CreateWaypointInput;
}>;


export type AddWaypointMutation = { addWaypoint: { id: string, tripId: string, sortOrder: number, dayIndex: number, periodOfDay: PeriodOfDay | null, type: string, name: string, notes: string | null, lat: number, lng: number, createdAt: string } };

export type AskTripAssistantMutationVariables = Exact<{
  input: AskTripAssistantInput;
}>;


export type AskTripAssistantMutation = { askTripAssistant: { message: string } };

export type CancelGroupRideMutationVariables = Exact<{
  groupRideId: string | number;
}>;


export type CancelGroupRideMutation = { cancelGroupRide: boolean };

export type CancelReceiptScanMutationVariables = Exact<{
  scanId: string;
}>;


export type CancelReceiptScanMutation = { cancelReceiptScan:
    | { __typename: 'CancelReceiptScanSuccess', scanId: string, status: string }
    | { __typename: 'ReceiptScanError', code: string, reason: string }
   };

export type CloneTripMutationVariables = Exact<{
  tripId: string | number;
}>;


export type CloneTripMutation = { cloneTrip: string };

export type CompleteMaintenanceTaskMutationVariables = Exact<{
  id: string;
  input?: CompleteMaintenanceTaskInput | null | undefined;
  createNextOccurrence?: boolean | null | undefined;
}>;


export type CompleteMaintenanceTaskMutation = { completeMaintenanceTask: { completed: { id: string, status: MaintenanceTaskStatus, completedAt: string | null, completedMileage: number | null, cost: number | null, partsCost: number | null, laborCost: number | null, currency: string | null }, nextOccurrence: { id: string, title: string, description: string | null, dueDate: string | null, targetMileage: number | null, priority: MaintenancePriority, status: MaintenanceTaskStatus, isRecurring: boolean, intervalKm: number | null, intervalDays: number | null, source: MaintenanceTaskSource, motorcycleId: string, createdAt: string } | null } };

export type CompleteOnboardingMutationVariables = Exact<{
  input: CompleteOnboardingInput;
}>;


export type CompleteOnboardingMutation = { completeOnboarding: { id: string, preferences: Record<string, unknown> | null, currency: string, createdAt: string, updatedAt: string } };

export type CreateCommentMutationVariables = Exact<{
  input: CreateCommentInput;
}>;


export type CreateCommentMutation = { createComment: { id: string, text: string, createdAt: string, flaggedCount: number, parentCommentId: string | null, author: { id: string, displayName: string, publicUsername: string | null, avatarUrl: string | null } } };

export type CreateDiagnosticMutationVariables = Exact<{
  input: CreateDiagnosticInput;
}>;


export type CreateDiagnosticMutation = { createDiagnostic: { id: string, userId: string, motorcycleId: string | null, severity: DiagnosticSeverity | null, confidence: number | null, relatedArticleId: string | null, status: string, dataSharingOptedIn: boolean, createdAt: string } };

export type CreateDocumentMutationVariables = Exact<{
  input: CreateDocumentInput;
}>;


export type CreateDocumentMutation = { createDocument: { id: string, motorcycleId: string, categoryId: string, title: string, expiryDate: string | null, note: string | null, isPinned: boolean, createdAt: string, updatedAt: string, files: Array<{ id: string, documentId: string, mimeType: string, fileSizeBytes: number | null, createdAt: string }> } };

export type CreateFlagMutationVariables = Exact<{
  input: CreateFlagInput;
}>;


export type CreateFlagMutation = { createFlag: { id: string, articleId: string, userId: string, sectionReference: string | null, comment: string, status: FlagStatus, createdAt: string } };

export type CreateGroupRideMutationVariables = Exact<{
  input: CreateGroupRideInput;
}>;


export type CreateGroupRideMutation = { createGroupRide: { id: string, title: string } };

export type CreateMaintenanceTaskMutationVariables = Exact<{
  input: CreateMaintenanceTaskInput;
}>;


export type CreateMaintenanceTaskMutation = { createMaintenanceTask: { id: string, title: string, priority: MaintenancePriority, status: MaintenanceTaskStatus, dueDate: string | null, targetMileage: number | null, isRecurring: boolean, intervalKm: number | null, intervalDays: number | null, remind30d: boolean, remind7d: boolean, remind1d: boolean, createdAt: string } };

export type CreateMotorcycleMutationVariables = Exact<{
  input: CreateMotorcycleInput;
}>;


export type CreateMotorcycleMutation = { createMotorcycle: { id: string, make: string, model: string, year: number, nickname: string | null, variant: string | null, isPrimary: boolean, createdAt: string } };

export type CreateNoteMutationVariables = Exact<{
  input: CreateNoteInput;
}>;


export type CreateNoteMutation = { createNote: { id: string, motorcycleId: string, text: string, odometer: number | null, createdAt: string, updatedAt: string, linkedTaskId: string | null, linkedTaskTitle: string | null, linkedExpenseId: string | null, linkedExpenseAmount: number | null, linkedExpenseCurrency: string | null, photos: Array<{ id: string, storagePath: string, publicUrl: string }> } };

export type CreateServiceReminderMutationVariables = Exact<{
  input: CreateServiceReminderInput;
}>;


export type CreateServiceReminderMutation = { createServiceReminder: { id: string, title: string, dueDate: string | null, isRecurring: boolean } };

export type CreateShareLinkMutationVariables = Exact<{
  input: CreateShareLinkInput;
}>;


export type CreateShareLinkMutation = { createShareLink: { id: string, token: string | null, motorcycleId: string, expiresAt: string, createdAt: string, url: string | null } };

export type CreateTaskFromNoteMutationVariables = Exact<{
  noteId: string;
}>;


export type CreateTaskFromNoteMutation = { createTaskFromNote: { id: string, motorcycleId: string, text: string, odometer: number | null, createdAt: string, updatedAt: string, linkedTaskId: string | null, linkedTaskTitle: string | null, linkedExpenseId: string | null, linkedExpenseAmount: number | null, linkedExpenseCurrency: string | null, photos: Array<{ id: string, storagePath: string, publicUrl: string }> } };

export type CreateTripReviewMutationVariables = Exact<{
  input: CreateTripReviewInput;
}>;


export type CreateTripReviewMutation = { createTripReview: { id: string, rating: number, text: string | null, conditionTags: Array<string> | null, createdAt: string, tripId: string, userId: string | null, bikeId: string | null } };

export type CreateTripSuggestionMutationVariables = Exact<{
  input: CreateTripSuggestionInput;
}>;


export type CreateTripSuggestionMutation = { createTripSuggestion: { id: string, tripId: string, status: TripSuggestionStatus, name: string, notes: string | null, lat: number | null, lng: number | null, dayIndex: number | null, periodOfDay: PeriodOfDay | null, createdAt: string, author: { id: string, displayName: string, avatarUrl: string | null } } };

export type CreateTripWithWaypointsMutationVariables = Exact<{
  input: CreateTripWithWaypointsInput;
}>;


export type CreateTripWithWaypointsMutation = { createTripWithWaypoints: { id: string, title: string, description: string, startDate: string, endDate: string, datesPending: boolean | null, difficulty: string, maxRiders: number, status: string, visibility: string, createdAt: string, organiser: { id: string, displayName: string }, waypoints: Array<{ id: string, tripId: string, sortOrder: number, dayIndex: number, periodOfDay: PeriodOfDay | null, type: string, name: string, notes: string | null, lat: number, lng: number }> | null } };

export type CreateTripMutationVariables = Exact<{
  input: CreateTripInput;
}>;


export type CreateTripMutation = { createTrip: { id: string, title: string, description: string, startDate: string, endDate: string, difficulty: string, maxRiders: number, status: string, createdAt: string, organiser: { id: string, displayName: string } } };

export type DeleteAccountMutationVariables = Exact<{ [key: string]: never; }>;


export type DeleteAccountMutation = { deleteAccount: boolean };

export type DeleteCommentMutationVariables = Exact<{
  commentId: string | number;
}>;


export type DeleteCommentMutation = { deleteComment: boolean };

export type DeleteDocumentCategoryMutationVariables = Exact<{
  id: string;
}>;


export type DeleteDocumentCategoryMutation = { deleteDocumentCategory: boolean };

export type DeleteDocumentMutationVariables = Exact<{
  id: string;
}>;


export type DeleteDocumentMutation = { deleteDocument: boolean };

export type DeleteExpensePhotoMutationVariables = Exact<{
  photoId: string;
}>;


export type DeleteExpensePhotoMutation = { deleteExpensePhoto: boolean };

export type DeleteExpenseMutationVariables = Exact<{
  id: string;
}>;


export type DeleteExpenseMutation = { deleteExpense: boolean };

export type DeleteMaintenanceTaskMutationVariables = Exact<{
  id: string;
}>;


export type DeleteMaintenanceTaskMutation = { deleteMaintenanceTask: boolean };

export type DeleteMotorcycleMutationVariables = Exact<{
  id: string;
}>;


export type DeleteMotorcycleMutation = { deleteMotorcycle: boolean };

export type DeleteNotePhotoMutationVariables = Exact<{
  photoId: string;
}>;


export type DeleteNotePhotoMutation = { deleteNotePhoto: boolean };

export type DeleteNoteMutationVariables = Exact<{
  id: string;
}>;


export type DeleteNoteMutation = { deleteNote: boolean };

export type DeleteRideMutationVariables = Exact<{
  id: string;
}>;


export type DeleteRideMutation = { deleteRide: boolean };

export type DeleteTaskPhotoMutationVariables = Exact<{
  photoId: string | number;
}>;


export type DeleteTaskPhotoMutation = { deleteTaskPhoto: boolean };

export type DeleteTripReviewMutationVariables = Exact<{
  reviewId: string | number;
}>;


export type DeleteTripReviewMutation = { deleteTripReview: boolean };

export type DeleteTripMutationVariables = Exact<{
  tripId: string | number;
}>;


export type DeleteTripMutation = { deleteTrip: boolean };

export type EndRideMutationVariables = Exact<{
  input: EndRideInput;
}>;


export type EndRideMutation = { endRide: { ride: { id: string, status: RideStatus, endedAt: string | null, distanceM: number | null, maxSpeedMps: number | null, avgSpeedMps: number | null, elevationGain: number | null, elevationLoss: number | null, pausedDurationS: number, autoPausedDurationS: number, gpsQuality: number | null, routePolyline: string | null, mileageApplied: boolean, endSource: string | null }, triggeredMaintenanceTasks: Array<{ id: string, title: string, priority: string }> } };

export type ExportTripGpxMutationVariables = Exact<{
  slug: string;
  country: string;
  region: string;
}>;


export type ExportTripGpxMutation = { exportTripGPX:
    | { code: string, reason: string, quotaRemaining: number | null, upgradeUrl: string | null }
    | { fileUrl: string, fileName: string, message: string }
   };

export type FlagCommentMutationVariables = Exact<{
  commentId: string | number;
}>;


export type FlagCommentMutation = { flagComment: boolean };

export type FollowRiderMutationVariables = Exact<{
  input: FollowRiderInput;
}>;


export type FollowRiderMutation = { followRider: { followerId: string, followingId: string, createdAt: string } };

export type GenerateArticleMutationVariables = Exact<{
  input: GenerateArticleInput;
}>;


export type GenerateArticleMutation = { generateArticle: { id: string, slug: string, title: string, difficulty: ArticleDifficulty, category: ArticleCategory, contentJson: Record<string, unknown> | null, readTime: number | null, generatedAt: string } };

export type GenerateBikeHealthReportMutationVariables = Exact<{
  input: GenerateReportInput;
}>;


export type GenerateBikeHealthReportMutation = { generateBikeHealthReport: { id: string, userId: string, motorcycleId: string | null, status: HealthReportStatus, pdfUrl: string | null, iapTransactionId: string | null, createdAt: string, completedAt: string | null } };

export type GenerateOnboardingInsightsMutationVariables = Exact<{
  input: GenerateInsightsInput;
}>;


export type GenerateOnboardingInsightsMutation = { generateOnboardingInsights: Array<{ icon: string, title: string, body: string, type: InsightType }> };

export type ImportOemScheduleMutationVariables = Exact<{
  motorcycleId: string;
}>;


export type ImportOemScheduleMutation = { importOemSchedule: number };

export type InviteToTripMutationVariables = Exact<{
  tripId: string | number;
  invitedUserId: string | number;
}>;


export type InviteToTripMutation = { inviteToTrip: boolean };

export type JoinGroupRideMutationVariables = Exact<{
  groupRideId: string | number;
}>;


export type JoinGroupRideMutation = { joinGroupRide: boolean };

export type JoinPremiumWaitlistMutationVariables = Exact<{
  feature: string;
}>;


export type JoinPremiumWaitlistMutation = { joinPremiumWaitlist: boolean };

export type JoinTripMutationVariables = Exact<{
  input: JoinTripInput;
}>;


export type JoinTripMutation = { joinTrip: boolean };

export type LeaveGroupRideMutationVariables = Exact<{
  groupRideId: string | number;
}>;


export type LeaveGroupRideMutation = { leaveGroupRide: boolean };

export type LeaveTripMutationVariables = Exact<{
  tripId: string | number;
}>;


export type LeaveTripMutation = { leaveTrip: boolean };

export type LogExpenseMutationVariables = Exact<{
  input: LogExpenseInput;
}>;


export type LogExpenseMutation = { logExpense: { id: string, amount: number, category: string, currency: string, description: string | null, itemName: string | null, date: string, createdAt: string } };

export type LogOdometerReadingMutationVariables = Exact<{
  input: LogOdometerReadingInput;
}>;


export type LogOdometerReadingMutation = { logOdometerReading: { id: string, currentMileage: number | null, distanceUnit: string, mileageUpdatedAt: string | null, odometerSyncSource: string | null, odometerLastRideId: string | null } };

export type MarkArticleReadMutationVariables = Exact<{
  articleId: string;
}>;


export type MarkArticleReadMutation = { markArticleRead: { id: string, userId: string, articleId: string, articleRead: boolean, quizCompleted: boolean, quizBestScore: number | null, firstReadAt: string | null, lastReadAt: string | null } };

export type PauseRideMutationVariables = Exact<{
  input: RidePauseInput;
}>;


export type PauseRideMutation = { pauseRide: boolean };

export type PublishAsTemplateMutationVariables = Exact<{
  tripId: string | number;
}>;


export type PublishAsTemplateMutation = { publishAsTemplate: { id: string, slug: string | null, isTemplate: boolean, publishedAt: string | null, status: string } };

export type PublishTripMutationVariables = Exact<{
  tripId: string | number;
}>;


export type PublishTripMutation = { publishTrip: { id: string, status: string } };

export type RegenerateRideSummaryMutationVariables = Exact<{
  rideId: string;
}>;


export type RegenerateRideSummaryMutation = { regenerateRideSummary: { id: string, rideId: string, summaryText: string, generationStatus: GenerationStatus, locale: string, createdAt: string, updatedAt: string } };

export type RegisterPushTokenMutationVariables = Exact<{
  input: RegisterPushTokenInput;
}>;


export type RegisterPushTokenMutation = { registerPushToken: { success: boolean } };

export type RemoveWaypointMutationVariables = Exact<{
  waypointId: string | number;
}>;


export type RemoveWaypointMutation = { removeWaypoint: boolean };

export type ReorderWaypointsMutationVariables = Exact<{
  input: ReorderWaypointsInput;
}>;


export type ReorderWaypointsMutation = { reorderWaypoints: boolean };

export type RequestDataExportMutationVariables = Exact<{ [key: string]: never; }>;


export type RequestDataExportMutation = { requestDataExport: { id: string, status: string, requestedAt: string } };

export type RespondToTripInviteMutationVariables = Exact<{
  inviteId: string | number;
  accept: boolean;
}>;


export type RespondToTripInviteMutation = { respondToTripInvite: boolean };

export type RespondToTripSuggestionMutationVariables = Exact<{
  input: RespondToTripSuggestionInput;
}>;


export type RespondToTripSuggestionMutation = { respondToTripSuggestion: { id: string, status: TripSuggestionStatus, decidedBy: string | null, decidedAt: string | null, decidedNote: string | null, waypointId: string | null } };

export type ResumeRideMutationVariables = Exact<{
  input: RidePauseInput;
}>;


export type ResumeRideMutation = { resumeRide: boolean };

export type RevokeShareLinkMutationVariables = Exact<{
  linkId: string | number;
}>;


export type RevokeShareLinkMutation = { revokeShareLink: boolean };

export type RotateTripShareTokenMutationVariables = Exact<{
  tripId: string | number;
}>;


export type RotateTripShareTokenMutation = { rotateTripShareToken: string };

export type SaveReceiptScanMutationVariables = Exact<{
  scanId: string;
  input: SaveReceiptScanInput;
}>;


export type SaveReceiptScanMutation = { saveReceiptScan:
    | { __typename: 'ReceiptScanError', code: string, reason: string }
    | { __typename: 'SaveReceiptScanSuccess', scanId: string, refs: { recordType: string, expenseId: string | null, taskId: string | null, photoId: string | null, odometer: { motorcycleId: string, previous: number | null, applied: number } | null } }
   };

export type SaveTripMutationVariables = Exact<{
  tripId: string | number;
}>;


export type SaveTripMutation = { saveTrip: boolean };

export type ScanReceiptMutationVariables = Exact<{
  scanId: string;
  isOnboarding?: boolean | null | undefined;
}>;


export type ScanReceiptMutation = { scanReceipt:
    | { __typename: 'ReceiptScanError', code: string, reason: string }
    | { __typename: 'ReceiptScanSuccess', scanId: string, result: { type: string, amount: number | null, currency: string | null, date: string | null, vendor: string | null, itemName: string | null, category: string | null, partsCost: number | null, laborCost: number | null, taxAmount: number | null, taxRate: number | null, odometerValue: number | null, odometerUnit: string | null, fuelLitres: number | null, partsNeeded: Array<string>, legibilityNote: string | null, needsCheck: Array<string>, lineItems: Array<{ label: string, serviceType: string | null, partRef: string | null, quantity: number | null, unitPrice: number | null, lineTotal: number | null }>, fieldConfidence: { amount: number, currency: number, date: number, vendor: number, category: number, odometer: number } } }
   };

export type SendFeedbackMutationVariables = Exact<{
  input: SendFeedbackInput;
}>;


export type SendFeedbackMutation = { sendFeedback: boolean };

export type SetTripParticipantRoleMutationVariables = Exact<{
  input: SetParticipantRoleInput;
}>;


export type SetTripParticipantRoleMutation = { setTripParticipantRole: boolean };

export type ShareRideAsTripMutationVariables = Exact<{
  input: ShareRideAsTripInput;
}>;


export type ShareRideAsTripMutation = { shareRideAsTrip: { id: string, title: string, distanceM: number | null } };

export type ShareRideMutationVariables = Exact<{
  rideId: string;
  sharedWithUserId: string;
}>;


export type ShareRideMutation = { shareRide: boolean };

export type StartRideMutationVariables = Exact<{
  input: StartRideInput;
}>;


export type StartRideMutation = { startRide: { id: string, status: RideStatus, startedAt: string, motorcycleId: string | null } };

export type SubmitDiagnosticMutationVariables = Exact<{
  input: SubmitDiagnosticInput;
}>;


export type SubmitDiagnosticMutation = { submitDiagnostic: { id: string, userId: string, motorcycleId: string | null, severity: DiagnosticSeverity | null, confidence: number | null, relatedArticleId: string | null, resultJson: Record<string, unknown> | null, description: string | null, photoUrl: string | null, status: string, createdAt: string } };

export type TrackAffiliateClickMutationVariables = Exact<{
  input: TrackClickInput;
}>;


export type TrackAffiliateClickMutation = { trackAffiliateClick: { partner: AffiliatePartner, affiliateUrl: string, productUrl: string, tracked: boolean } };

export type UnacknowledgeRecallMutationVariables = Exact<{
  motorcycleId: string | number;
  campaignNumber: string;
}>;


export type UnacknowledgeRecallMutation = { unacknowledgeRecall: { count: number, acknowledgedCount: number, checkedAt: string, vinUsed: string | null, recalls: Array<{ campaignNumber: string, reportDate: string, component: string, summary: string, consequence: string, remedy: string, acknowledged: boolean, acknowledgedAt: string | null }> } };

export type UndoReceiptScanSaveMutationVariables = Exact<{
  scanId: string;
}>;


export type UndoReceiptScanSaveMutation = { undoReceiptScanSave:
    | { __typename: 'ReceiptScanError', code: string, reason: string }
    | { __typename: 'UndoReceiptScanSuccess', scanId: string, status: string }
   };

export type UnfollowRiderMutationVariables = Exact<{
  input: UnfollowRiderInput;
}>;


export type UnfollowRiderMutation = { unfollowRider: boolean };

export type UnpublishTemplateMutationVariables = Exact<{
  tripId: string | number;
}>;


export type UnpublishTemplateMutation = { unpublishTemplate: boolean };

export type UnregisterPushTokenMutationVariables = Exact<{
  input: UnregisterPushTokenInput;
}>;


export type UnregisterPushTokenMutation = { unregisterPushToken: { success: boolean } };

export type UnsaveTripMutationVariables = Exact<{
  tripId: string | number;
}>;


export type UnsaveTripMutation = { unsaveTrip: boolean };

export type UnshareRideMutationVariables = Exact<{
  rideId: string;
  sharedWithUserId: string;
}>;


export type UnshareRideMutation = { unshareRide: boolean };

export type UpdateDocumentCategoryMutationVariables = Exact<{
  id: string;
  input: UpdateDocumentCategoryInput;
}>;


export type UpdateDocumentCategoryMutation = { updateDocumentCategory: { id: string, name: string, kind: string, isHidden: boolean, promptsExpiry: boolean, updatedAt: string } };

export type UpdateDocumentMutationVariables = Exact<{
  id: string;
  input: UpdateDocumentInput;
}>;


export type UpdateDocumentMutation = { updateDocument: { id: string, motorcycleId: string, categoryId: string, title: string, expiryDate: string | null, note: string | null, isPinned: boolean, updatedAt: string } };

export type UpdateMaintenanceTaskMutationVariables = Exact<{
  id: string;
  input: UpdateMaintenanceTaskInput;
}>;


export type UpdateMaintenanceTaskMutation = { updateMaintenanceTask: { id: string, title: string, description: string | null, priority: MaintenancePriority, status: MaintenanceTaskStatus, dueDate: string | null, targetMileage: number | null, notes: string | null, isRecurring: boolean, intervalKm: number | null, intervalDays: number | null, remind30d: boolean, remind7d: boolean, remind1d: boolean, updatedAt: string } };

export type UpdateMotorcycleMutationVariables = Exact<{
  id: string;
  input: UpdateMotorcycleInput;
}>;


export type UpdateMotorcycleMutation = { updateMotorcycle: { id: string, make: string, model: string, year: number, nickname: string | null, variant: string | null, isPrimary: boolean, primaryPhotoUrl: string | null, currentMileage: number | null, mileageUnit: string | null, distanceUnit: string, mileageUpdatedAt: string | null, purchasePrice: number | null, purchaseDate: string | null, vin: string | null, recallCount: number | null, recallLastCheckedAt: string | null } };

export type UpdateMyProfileMutationVariables = Exact<{
  input: UpdateProfileInput;
}>;


export type UpdateMyProfileMutation = { updateMyProfile: { id: string, fullName: string | null, publicUsername: string | null, displayName: string | null, bio: string | null, city: string | null, isPublic: boolean | null, followerCount: number | null, followingCount: number | null } };

export type UpdateNoteMutationVariables = Exact<{
  id: string;
  input: UpdateNoteInput;
}>;


export type UpdateNoteMutation = { updateNote: { id: string, motorcycleId: string, text: string, odometer: number | null, createdAt: string, updatedAt: string, linkedTaskId: string | null, linkedTaskTitle: string | null, linkedExpenseId: string | null, linkedExpenseAmount: number | null, linkedExpenseCurrency: string | null, photos: Array<{ id: string, storagePath: string, publicUrl: string }> } };

export type UpdateParticipantStatusMutationVariables = Exact<{
  input: UpdateParticipantStatusInput;
}>;


export type UpdateParticipantStatusMutation = { updateParticipantStatus: boolean };

export type UpdateRideVisibilityMutationVariables = Exact<{
  rideId: string;
  visibility: string;
}>;


export type UpdateRideVisibilityMutation = { updateRideVisibility: { id: string, visibility: string, isPublic: boolean } };

export type UpdateRideMutationVariables = Exact<{
  input: UpdateRideInput;
}>;


export type UpdateRideMutation = { updateRide: { id: string, name: string | null, mileageApplied: boolean, isPublic: boolean, purpose: string | null, passenger: boolean | null } };

export type UpdateTripMutationVariables = Exact<{
  input: UpdateTripInput;
}>;


export type UpdateTripMutation = { updateTrip: { id: string, title: string, description: string, startDate: string, endDate: string, difficulty: string, maxRiders: number, status: string, visibility: string, waypoints: Array<{ id: string, tripId: string, sortOrder: number, dayIndex: number, periodOfDay: PeriodOfDay | null, type: string, name: string, notes: string | null, lat: number, lng: number }> | null } };

export type UpdateUserMutationVariables = Exact<{
  input: UpdateUserInput;
}>;


export type UpdateUserMutation = { updateUser: { id: string, fullName: string | null, preferences: Record<string, unknown> | null, measurementSystem: string | null, currency: string } };

export type UpdateWaypointMutationVariables = Exact<{
  input: UpdateWaypointInput;
}>;


export type UpdateWaypointMutation = { updateWaypoint: { id: string, sortOrder: number, dayIndex: number, periodOfDay: PeriodOfDay | null, type: string, name: string, notes: string | null, lat: number, lng: number } };

export type UploadWaypointsMutationVariables = Exact<{
  input: UploadWaypointsInput;
}>;


export type UploadWaypointsMutation = { uploadWaypoints: number };

export type AllMaintenanceTasksQueryVariables = Exact<{ [key: string]: never; }>;


export type AllMaintenanceTasksQuery = { allMaintenanceTasks: Array<{ id: string, motorcycleId: string, title: string, dueDate: string | null, targetMileage: number | null, priority: MaintenancePriority, status: MaintenanceTaskStatus, completedAt: string | null, remind30d: boolean, remind7d: boolean, remind1d: boolean }> };

export type ArticleBySlugFullQueryVariables = Exact<{
  slug: string;
}>;


export type ArticleBySlugFullQuery = { articleBySlugFull: { id: string, slug: string, title: string, difficulty: ArticleDifficulty, category: ArticleCategory, viewCount: number, isSafetyCritical: boolean, contentJson: Record<string, unknown> | null, readTime: number | null, generatedAt: string, updatedAt: string } | null };

export type DiagnosticByIdQueryVariables = Exact<{
  id: string;
}>;


export type DiagnosticByIdQuery = { diagnosticById: { id: string, userId: string, motorcycleId: string | null, severity: DiagnosticSeverity | null, confidence: number | null, relatedArticleId: string | null, resultJson: Record<string, unknown> | null, description: string | null, photoUrl: string | null, status: string, dataSharingOptedIn: boolean, createdAt: string } | null };

export type DiagnosticQuotaQueryVariables = Exact<{ [key: string]: never; }>;


export type DiagnosticQuotaQuery = { diagnosticQuota: { used: number, limit: number, resetDate: string } };

export type DiscoverRiderTripsQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type DiscoverRiderTripsQuery = { discoverRiderTrips: { edges: Array<{ cursor: string, node: { id: string, title: string, description: string, startDate: string, endDate: string, difficulty: string, maxRiders: number, participantCount: number, status: string, visibility: string, coverImageUrl: string | null, createdAt: string, organiser: { id: string, displayName: string, publicUsername: string | null, avatarUrl: string | null }, waypoints: Array<{ id: string, sortOrder: number, dayIndex: number, lat: number, lng: number }> | null } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type DocumentCategoriesQueryVariables = Exact<{
  includeHidden?: boolean | null | undefined;
}>;


export type DocumentCategoriesQuery = { documentCategories: Array<{ id: string, name: string, kind: string, isHidden: boolean, promptsExpiry: boolean, createdAt: string, updatedAt: string }> };

export type GetDocumentSignedUrlQueryVariables = Exact<{
  fileId: string;
  download?: boolean | null | undefined;
}>;


export type GetDocumentSignedUrlQuery = { getDocumentSignedUrl: string };

export type DocumentsByMotorcycleQueryVariables = Exact<{
  motorcycleId: string;
}>;


export type DocumentsByMotorcycleQuery = { documents: Array<{ id: string, motorcycleId: string, categoryId: string, title: string, expiryDate: string | null, note: string | null, isPinned: boolean, createdAt: string, updatedAt: string, files: Array<{ id: string, documentId: string, mimeType: string, fileSizeBytes: number | null, createdAt: string }> }> };

export type ExpenseDashboardQueryVariables = Exact<{
  motorcycleId: string;
}>;


export type ExpenseDashboardQuery = { expenseDashboard: { currency: string | null, currentYearTotal: number, previousYearTotal: number, allTimeTotal: number, expenseCount: number, monthlyBuckets: Array<{ month: number, year: number, total: number, categories: Array<{ category: string, total: number }> }>, categoryTotals: Array<{ category: string, total: number }>, currencies: Array<{ currency: string, currentYearTotal: number, previousYearTotal: number, allTimeTotal: number, expenseCount: number, monthlyBuckets: Array<{ month: number, year: number, total: number, categories: Array<{ category: string, total: number }> }>, categoryTotals: Array<{ category: string, total: number }> }> } };

export type ExpensePhotosQueryVariables = Exact<{
  expenseId: string;
}>;


export type ExpensePhotosQuery = { expensePhotos: Array<{ id: string, expenseId: string, storagePath: string, publicUrl: string, fileSizeBytes: number | null, mimeType: string, createdAt: string }> };

export type ExpensesByMotorcycleQueryVariables = Exact<{
  motorcycleId: string;
  year: number;
}>;


export type ExpensesByMotorcycleQuery = { expenses: { ytdTotal: number, currencyTotals: Array<{ currency: string, total: number, count: number }>, categories: Array<{ category: string, total: number, currencyTotals: Array<{ currency: string, total: number, count: number }>, expenses: Array<{ id: string, amount: number, category: string, currency: string, description: string | null, itemName: string | null, maintenanceTaskId: string | null, date: string, createdAt: string }> }> } };

export type ExpiringDocumentsQueryVariables = Exact<{
  withinDays?: number | null | undefined;
}>;


export type ExpiringDocumentsQuery = { expiringDocuments: Array<{ id: string, motorcycleId: string, categoryId: string, title: string, expiryDate: string | null, isPinned: boolean }> };

export type GetArticleBySlugQueryVariables = Exact<{
  slug: string;
}>;


export type GetArticleBySlugQuery = { articleBySlug: { id: string, slug: string, title: string, difficulty: ArticleDifficulty, category: ArticleCategory, viewCount: number, isSafetyCritical: boolean, generatedAt: string, updatedAt: string } | null };

export type GetCommentsQueryVariables = Exact<{
  rideId?: string | number | null | undefined;
  routeId?: string | number | null | undefined;
  groupRideId?: string | number | null | undefined;
  tripId?: string | number | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type GetCommentsQuery = { getComments: { hasNextPage: boolean, endCursor: string | null, totalCount: number, comments: Array<{ id: string, text: string, createdAt: string, flaggedCount: number, parentCommentId: string | null, author: { id: string, displayName: string, publicUsername: string | null, avatarUrl: string | null }, replies: Array<{ id: string, text: string, createdAt: string, flaggedCount: number, parentCommentId: string | null, author: { id: string, displayName: string, publicUsername: string | null, avatarUrl: string | null } }> | null }> } };

export type GetFollowersQueryVariables = Exact<{
  userId: string;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type GetFollowersQuery = { getFollowers: { totalCount: number, edges: Array<{ cursor: string, node: { followerId: string, followingId: string, createdAt: string, displayName: string | null, publicUsername: string | null, avatarUrl: string | null } }>, pageInfo: { hasNextPage: boolean, hasPreviousPage: boolean, startCursor: string | null, endCursor: string | null } } };

export type GetFollowingQueryVariables = Exact<{
  userId: string;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type GetFollowingQuery = { getFollowing: { totalCount: number, edges: Array<{ cursor: string, node: { followerId: string, followingId: string, createdAt: string, displayName: string | null, publicUsername: string | null, avatarUrl: string | null } }>, pageInfo: { hasNextPage: boolean, hasPreviousPage: boolean, startCursor: string | null, endCursor: string | null } } };

export type GetGroupRidesQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type GetGroupRidesQuery = { getGroupRides: { edges: Array<{ cursor: string, node: { id: string, title: string, description: string, dateTime: string, meetingPointLat: number, meetingPointLng: number, meetingPointName: string | null, routeId: string | null, difficulty: string, maxRiders: number, participantCount: number, status: string, createdAt: string, organiser: { id: string, displayName: string, publicUsername: string | null, avatarUrl: string | null } } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type GetOnboardingRevealQueryVariables = Exact<{
  make: string;
  year: number;
  model?: string | null | undefined;
}>;


export type GetOnboardingRevealQuery = { onboardingReveal: { year: number, make: string, model: string | null, recallCount: number, recallsChecked: boolean, oemTaskCount: number, projectedYearlyCostEur: number | null, riderCount: number, recalls: Array<{ component: string, summary: string }>, insights: { status: string, knownIssues: Array<{ title: string, detail: string }> } } };

export type GetPublicRideQueryVariables = Exact<{
  id: string;
}>;


export type GetPublicRideQuery = { getPublicRide: { id: string, userId: string, status: RideStatus, name: string | null, startedAt: string, endedAt: string | null, distanceM: number | null, maxSpeedMps: number | null, avgSpeedMps: number | null, elevationGain: number | null, elevationLoss: number | null, pausedDurationS: number, autoPausedDurationS: number, durationS: number | null, motorcycleId: string | null, routePolyline: string | null, routeThumbnailUri: string | null, gpsQuality: number | null, mileageApplied: boolean, isPublic: boolean, createdAt: string } };

export type GetRideSummaryStatsQueryVariables = Exact<{
  id: string;
}>;


export type GetRideSummaryStatsQuery = { ride: { id: string, newRoadsM: number | null, stats: { climbM: number | null } | null } };

export type GetRideWaypointsQueryVariables = Exact<{
  rideId: string;
  maxPoints?: number | null | undefined;
}>;


export type GetRideWaypointsQuery = { rideWaypoints: Array<{ recordedAt: string, latitude: number, longitude: number, altitude: number | null, speedMps: number | null }> };

export type GetRideQueryVariables = Exact<{
  id: string;
}>;


export type GetRideQuery = { ride: { id: string, status: RideStatus, name: string | null, startedAt: string, endedAt: string | null, distanceM: number | null, maxSpeedMps: number | null, avgSpeedMps: number | null, maxLeanAngle: number | null, elevationGain: number | null, elevationLoss: number | null, pausedDurationS: number, autoPausedDurationS: number, durationS: number | null, motorcycleId: string | null, routePolyline: string | null, routeThumbnailUri: string | null, gpsQuality: number | null, mileageApplied: boolean, isPublic: boolean, createdAt: string } };

export type GetRiderInsightsHeadlineQueryVariables = Exact<{
  timeZone?: string | null | undefined;
}>;


export type GetRiderInsightsHeadlineQuery = { riderInsights: { season: { from: string, to: string }, totals: { rides: number, distanceM: number, countries: number }, coverage: { rides: number, qualifyingRides: number }, latestRide: { rideId: string, localDate: string, distanceM: number, newCountries: Array<string> } | null, countries: Array<{ isoA2: string, name: string | null }> } };

export type GetRiderInsightsQueryVariables = Exact<{
  from?: string | null | undefined;
  to?: string | null | undefined;
  timeZone?: string | null | undefined;
  refreshEntitlement?: boolean | null | undefined;
}>;


export type GetRiderInsightsQuery = { riderInsights: { isPro: boolean, season: { from: string, to: string }, totals: { rides: number, distanceM: number, countries: number }, coverage: { rides: number, qualifyingRides: number, pendingRides: number, pendingRecentRides: number, ridesWithBike: number, qualifying: { withStats: number, withRoute: number, withWaypoints: number, withBands: number, withLean: number, withMovingTime: number } }, latestRide: { rideId: string, localDate: string, distanceM: number, newCountries: Array<string> } | null, longestRide: { rideId: string, name: string | null, localDate: string, distanceM: number, movingTimeS: number | null, durationS: number, startPlace: string | null, endPlace: string | null } | null, ribbon: Array<{ weekStart: string, rides: number, distanceM: number }>, regions: Array<{ key: string, isoA2: string, name: string | null, rides: number, distanceM: number, bounds: Array<number> | null, routes: Array<string> }>, countries: Array<{ isoA2: string, name: string | null, firstDate: string, firstRideId: string, rides: number, distanceM: number }>, bikes: { status: RiderInsightsStatus, items: Array<{ motorcycleId: string | null, name: string | null, rides: number, distanceM: number, movingTimeS: number }> | null }, territory: { status: RiderInsightsStatus, headline: number | null, detail: { exploredCells: number, exploredKm2: number, routedM: number, newRoadM: number, newRoadShare: number | null, furthest: { rideId: string, name: string | null, localDate: string, distanceM: number, lat: number, lng: number } | null } | null }, roadCharacter: { status: RiderInsightsStatus, headline: number | null, teaser: { bandShares: { straight: number, sweeping: number, twisty: number, tight: number } } | null, detail: { routedKm: number, bendsCount: number, bendsPer10km: number | null, ridesWithBands: number, ridesWithLean: number, bandKm: { straight: number, sweeping: number, twisty: number, tight: number }, twistiest: Array<{ rideId: string, name: string | null, localDate: string, distanceM: number, bendsPer10km: number | null }>, straightest: Array<{ rideId: string, name: string | null, localDate: string, distanceM: number, bendsPer10km: number | null }>, lean: { corners: number, under20: number, from20to30: number, from30to40: number, from40: number } | null } | null }, rhythm: { status: RiderInsightsStatus, headline: number | null, teaser: { grid: Array<Array<number>> } | null, detail: { grid: Array<Array<number>>, rides: number, weekendRides: number, weekendShare: number | null, medianDistanceM: number | null, medianMovingTimeS: number | null, ridesWithMovingTime: number } | null }, bestRides: { status: RiderInsightsStatus, headline: number | null, teaser: { count: number } | null, detail: { count: number, byDistance: Array<{ rideId: string, name: string | null, localDate: string, distanceM: number, climbM: number | null, bendsPer10km: number | null, movingTimeS: number | null }>, byClimb: Array<{ rideId: string, name: string | null, localDate: string, distanceM: number, climbM: number | null, bendsPer10km: number | null, movingTimeS: number | null }>, byBends: Array<{ rideId: string, name: string | null, localDate: string, distanceM: number, climbM: number | null, bendsPer10km: number | null, movingTimeS: number | null }> } | null }, costPerKm: { status: RiderInsightsStatus, items: Array<{ currency: string, spend: number, expenseCount: number, distanceM: number, distanceSource: string, costPerKm: number | null }> | null } } };

export type RiderInsightsBestRideFieldsFragment = { rideId: string, name: string | null, localDate: string, distanceM: number, climbM: number | null, bendsPer10km: number | null, movingTimeS: number | null };

export type GetRiderProfileQueryVariables = Exact<{
  username: string;
}>;


export type GetRiderProfileQuery = { getRiderProfile: { id: string, publicUsername: string, displayName: string | null, bio: string | null, city: string | null, avatarUrl: string | null, followerCount: number, followingCount: number, isFollowing: boolean | null, bikes: Array<{ make: string, model: string, year: number, nickname: string | null }>, rideStats: { totalRides: number, totalDistance: number, joinDate: string | null } } };

export type GetTripsQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type GetTripsQuery = { getTrips: { edges: Array<{ cursor: string, node: { id: string, title: string, description: string, startDate: string, endDate: string, difficulty: string, maxRiders: number, participantCount: number, status: string, visibility: string, coverImageUrl: string | null, createdAt: string, organiser: { id: string, displayName: string, publicUsername: string | null, avatarUrl: string | null }, waypoints: Array<{ id: string, sortOrder: number, dayIndex: number, lat: number, lng: number }> | null } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type GetWeatherForecastQueryVariables = Exact<{
  input: WeatherForecastInput;
}>;


export type GetWeatherForecastQuery = { weatherForecast: { days: Array<{ date: string, tempMax: number, tempMin: number, precipProbability: number | null, weatherCode: number }> } };

export type GroupRideDetailQueryVariables = Exact<{
  groupRideId: string | number;
}>;


export type GroupRideDetailQuery = { groupRideDetail: { id: string, title: string, description: string, dateTime: string, meetingPointLat: number, meetingPointLng: number, meetingPointName: string | null, routeId: string | null, routeDescription: string | null, difficulty: string, maxRiders: number, participantCount: number, status: string, createdAt: string, organiser: { id: string, displayName: string, publicUsername: string | null, avatarUrl: string | null }, participants: Array<{ id: string, displayName: string, publicUsername: string | null, avatarUrl: string | null, joinedAt: string }> | null } };

export type IsTripSavedQueryVariables = Exact<{
  tripId: string | number;
}>;


export type IsTripSavedQuery = { isTripSaved: boolean };

export type ListPopularArticlesQueryVariables = Exact<{
  first?: number | null | undefined;
}>;


export type ListPopularArticlesQuery = { popularArticles: Array<{ id: string, slug: string, title: string, difficulty: ArticleDifficulty, category: ArticleCategory, viewCount: number, isSafetyCritical: boolean, generatedAt: string, readTime: number | null, keywords: Array<string> | null }> };

export type MaintenanceTaskHistoryQueryVariables = Exact<{
  motorcycleId: string;
  limit?: number | null | undefined;
}>;


export type MaintenanceTaskHistoryQuery = { maintenanceTaskHistory: Array<{ id: string, userId: string, motorcycleId: string, title: string, description: string | null, dueDate: string | null, targetMileage: number | null, priority: MaintenancePriority, status: MaintenanceTaskStatus, notes: string | null, partsNeeded: Array<string> | null, completedAt: string | null, completedMileage: number | null, cost: number | null, partsCost: number | null, laborCost: number | null, totalAmount: number | null, taxAmount: number | null, taxRate: number | null, currency: string | null, source: MaintenanceTaskSource, oemScheduleId: string | null, intervalKm: number | null, intervalDays: number | null, isRecurring: boolean, createdAt: string, updatedAt: string, lineItems: Array<{ id: string, serviceType: MaintenanceServiceType, label: string, lineTotal: number | null }> }> };

export type MaintenanceTasksByMotorcycleQueryVariables = Exact<{
  motorcycleId: string;
}>;


export type MaintenanceTasksByMotorcycleQuery = { maintenanceTasks: Array<{ id: string, userId: string, motorcycleId: string, title: string, description: string | null, dueDate: string | null, targetMileage: number | null, priority: MaintenancePriority, status: MaintenanceTaskStatus, notes: string | null, partsNeeded: Array<string> | null, completedAt: string | null, completedMileage: number | null, cost: number | null, partsCost: number | null, laborCost: number | null, totalAmount: number | null, taxAmount: number | null, taxRate: number | null, currency: string | null, source: MaintenanceTaskSource, isRecurring: boolean, intervalKm: number | null, intervalDays: number | null, remind30d: boolean, remind7d: boolean, remind1d: boolean, createdAt: string, updatedAt: string, photos: Array<{ id: string, storagePath: string, publicUrl: string }>, lineItems: Array<{ id: string, serviceType: MaintenanceServiceType, label: string, lineTotal: number | null }> }> };

export type MakeStatsQueryVariables = Exact<{ [key: string]: never; }>;


export type MakeStatsQuery = { makeStats: Array<{ make: string, riders: number, models: number, totalBikes: number, rank: number }> };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { me: { id: string, email: string, fullName: string | null, role: UserRole, preferences: Record<string, unknown> | null, measurementSystem: string | null, currency: string, publicUsername: string | null, displayName: string | null, bio: string | null, city: string | null, isPublic: boolean | null, followerCount: number | null, followingCount: number | null, avatarUrl: string | null, createdAt: string, updatedAt: string } };

export type MotorcycleMakesQueryVariables = Exact<{ [key: string]: never; }>;


export type MotorcycleMakesQuery = { motorcycleMakes: Array<{ makeId: number, makeName: string, isPopular: boolean }> };

export type MotorcycleModelsQueryVariables = Exact<{
  makeId: number;
  year: number;
}>;


export type MotorcycleModelsQuery = { motorcycleModels: Array<{ modelId: number, modelName: string }> };

export type MotorcycleRecallsQueryVariables = Exact<{
  motorcycleId: string;
}>;


export type MotorcycleRecallsQuery = { motorcycleRecalls: { count: number, acknowledgedCount: number, checkedAt: string, vinUsed: string | null, recalls: Array<{ campaignNumber: string, reportDate: string, component: string, summary: string, consequence: string, remedy: string, acknowledged: boolean, acknowledgedAt: string | null }> } };

export type MyDiagnosticsQueryVariables = Exact<{ [key: string]: never; }>;


export type MyDiagnosticsQuery = { myDiagnostics: Array<{ id: string, userId: string, motorcycleId: string | null, severity: DiagnosticSeverity | null, confidence: number | null, relatedArticleId: string | null, status: string, dataSharingOptedIn: boolean, createdAt: string }> };

export type GetMyHealthReportsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMyHealthReportsQuery = { getMyHealthReports: Array<{ id: string, userId: string, motorcycleId: string | null, status: HealthReportStatus, pdfUrl: string | null, iapTransactionId: string | null, createdAt: string, completedAt: string | null }> };

export type MyMotorcyclesQueryVariables = Exact<{ [key: string]: never; }>;


export type MyMotorcyclesQuery = { myMotorcycles: Array<{ id: string, userId: string, make: string, model: string, year: number, nickname: string | null, variant: string | null, isPrimary: boolean, primaryPhotoUrl: string | null, currentMileage: number | null, mileageUnit: string | null, distanceUnit: string, mileageUpdatedAt: string | null, purchasePrice: number | null, purchaseDate: string | null, type: MotorcycleType | null, engineCc: number | null, vin: string | null, recallCount: number | null, recallLastCheckedAt: string | null, odometerSyncSource: string | null, odometerLastRideId: string | null, createdAt: string }> };

export type MyProgressQueryVariables = Exact<{ [key: string]: never; }>;


export type MyProgressQuery = { myProgress: Array<{ id: string, userId: string, articleId: string, articleRead: boolean, quizCompleted: boolean, quizBestScore: number | null, firstReadAt: string | null, lastReadAt: string | null }> };

export type MyRidesForHeatmapQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type MyRidesForHeatmapQuery = { myRides: { totalCount: number, edges: Array<{ cursor: string, node: { id: string, name: string | null, startedAt: string, distanceM: number | null, region: string | null, routePolyline: string | null } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type MyRidesQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: string | null | undefined;
  motorcycleId?: string | null | undefined;
}>;


export type MyRidesQuery = { myRides: { totalCount: number, edges: Array<{ cursor: string, node: { id: string, status: RideStatus, name: string | null, startedAt: string, endedAt: string | null, distanceM: number | null, maxSpeedMps: number | null, avgSpeedMps: number | null, elevationGain: number | null, pausedDurationS: number, autoPausedDurationS: number, durationS: number | null, motorcycleId: string | null, routePolyline: string | null, routeThumbnailUri: string | null, gpsQuality: number | null } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type MyShareLinksQueryVariables = Exact<{
  motorcycleId: string | number;
}>;


export type MyShareLinksQuery = { myShareLinks: Array<{ id: string, motorcycleId: string, expiresAt: string, createdAt: string }> };

export type MyTripsQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type MyTripsQuery = { myTrips: { edges: Array<{ cursor: string, node: { id: string, title: string, description: string, startDate: string, endDate: string, difficulty: string, maxRiders: number, participantCount: number, status: string, visibility: string, coverImageUrl: string | null, createdAt: string, waypoints: Array<{ id: string }> | null, organiser: { id: string, displayName: string, publicUsername: string | null, avatarUrl: string | null } } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type NotesByMotorcycleQueryVariables = Exact<{
  motorcycleId: string;
}>;


export type NotesByMotorcycleQuery = { notes: Array<{ id: string, motorcycleId: string, text: string, odometer: number | null, createdAt: string, updatedAt: string, linkedTaskId: string | null, linkedTaskTitle: string | null, linkedExpenseId: string | null, linkedExpenseAmount: number | null, linkedExpenseCurrency: string | null, photos: Array<{ id: string, storagePath: string, publicUrl: string }> }> };

export type OdometerReadingsQueryVariables = Exact<{
  motorcycleId: string;
  limit?: number | null | undefined;
}>;


export type OdometerReadingsQuery = { odometerReadings: Array<{ id: string, value: number, recordedAt: string, source: string, rideId: string | null }> };

export type OemSchedulesPreviewQueryVariables = Exact<{
  make: string;
  model?: string | null | undefined;
  year?: number | null | undefined;
  variant?: string | null | undefined;
}>;


export type OemSchedulesPreviewQuery = { oemSchedulesPreview: Array<{ id: string, taskName: string, description: string | null, intervalKm: number | null, intervalDays: number | null, priority: MaintenancePriority, sortOrder: number }> };

export type PendingRideDistanceQueryVariables = Exact<{
  motorcycleId: string;
}>;


export type PendingRideDistanceQuery = { pendingRideDistance: { rideCount: number, distance: number } };

export type ReceiptScanQuotaQueryVariables = Exact<{ [key: string]: never; }>;


export type ReceiptScanQuotaQuery = { receiptScanQuota: { used: number, limit: number, resetDate: string } };

export type RideMilestoneStatsQueryVariables = Exact<{
  excludeRideId?: string | null | undefined;
}>;


export type RideMilestoneStatsQuery = { rideMilestoneStats: { qualifyingRideCount: number, longestQualifyingDistanceM: number } };

export type RideOverviewQueryVariables = Exact<{ [key: string]: never; }>;


export type RideOverviewQuery = { rideOverview: { lastRide: { id: string, distanceM: number, durationS: number, maxSpeedMps: number | null, date: string, motorcycleName: string | null, summaryTitle: string | null } | null, last7Days: { rideCount: number, distanceM: number, durationS: number }, last30Days: { rideCount: number, distanceM: number, durationS: number }, thisWeek: { rideCount: number, distanceM: number, durationS: number }, thisMonth: { rideCount: number, distanceM: number, durationS: number }, dailyDistances: Array<{ date: string, distanceM: number }>, personalRecords: Array<{ recordType: string, value: number, unit: string, achievedAt: string, previousValue: number | null, rideId: string | null }> } };

export type SavedTripsQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type SavedTripsQuery = { savedTrips: { edges: Array<{ cursor: string, node: { id: string, slug: string | null, title: string, description: string, difficulty: string, dayCount: number | null, startLat: number | null, startLng: number | null, countryCode: string | null, regionCode: string | null, city: string | null, distanceM: number | null, elevationGainM: number | null, surfaceType: string | null, isFeatured: boolean, isMotovaultPick: boolean, viewCount: number, cloneCount: number, averageRating: number | null, reviewCount: number, publishedAt: string | null, isTemplate: boolean, isSaved: boolean | null, organiser: { id: string, displayName: string, publicUsername: string | null, avatarUrl: string | null } } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type SearchArticlesQueryVariables = Exact<{
  input: SearchArticlesInput;
}>;


export type SearchArticlesQuery = { searchArticles: { totalCount: number, edges: Array<{ cursor: string, node: { id: string, slug: string, title: string, difficulty: ArticleDifficulty, category: ArticleCategory, viewCount: number, isSafetyCritical: boolean, generatedAt: string, updatedAt: string, keywords: Array<string> | null } }>, pageInfo: { hasNextPage: boolean, hasPreviousPage: boolean, startCursor: string | null, endCursor: string | null } } };

export type SearchTypeaheadQueryVariables = Exact<{
  q?: string | null | undefined;
  limit?: number | null | undefined;
}>;


export type SearchTypeaheadQuery = { searchTypeahead: { routes: Array<{ id: string, name: string, slug: string, countryCode: string, regionCode: string | null }>, places: Array<{ id: number, name: string, kind: string, countryCode: string, regionCode: string | null, population: number }> } };

export type SpendingSummaryQueryVariables = Exact<{
  motorcycleId: string;
}>;


export type SpendingSummaryQuery = { spendingSummary: { thisYear: number, allTime: number, thisYearByCurrency: Array<{ currency: string, total: number, count: number }>, allTimeByCurrency: Array<{ currency: string, total: number, count: number }> } };

export type TemplateTripIdForRouteQueryVariables = Exact<{
  routeId: string | number;
}>;


export type TemplateTripIdForRouteQuery = { templateTripIdForRoute: string | null };

export type TripByShareTokenQueryVariables = Exact<{
  shareToken: string;
}>;


export type TripByShareTokenQuery = { tripByShareToken: { id: string, title: string, description: string | null, status: string, difficulty: string, startDate: string, endDate: string, maxRiders: number, participantCount: number, coverImageUrl: string | null, waypoints: Array<{ id: string, sortOrder: number, dayIndex: number | null, periodOfDay: PeriodOfDay | null, type: string, name: string, notes: string | null, lat: number, lng: number }>, participants: Array<{ anonId: string, role: string, status: string, displayName: string, avatarUrl: string | null }> } | null };

export type TripBySlugQueryVariables = Exact<{
  country: string;
  region: string;
  slug: string;
}>;


export type TripBySlugQuery = { tripBySlug: { id: string, slug: string | null, title: string, description: string, difficulty: string, dayCount: number | null, startDate: string, endDate: string, maxRiders: number, participantCount: number, status: string, visibility: string, coverImageUrl: string | null, isTemplate: boolean, polyline: string | null, startLat: number | null, startLng: number | null, countryCode: string | null, regionCode: string | null, city: string | null, distanceM: number | null, elevationGainM: number | null, estimatedDurationMinutes: number | null, surfaceType: string | null, curvatureIndex: number | null, isFeatured: boolean, isMotovaultPick: boolean, viewCount: number, cloneCount: number, averageRating: number | null, reviewCount: number, publishedAt: string | null, isFlagged: boolean, clonedFromTripId: string | null, forkedFromTripId: string | null, createdAt: string, organiser: { id: string, displayName: string, publicUsername: string | null, avatarUrl: string | null }, waypoints: Array<{ id: string, tripId: string, sortOrder: number, dayIndex: number, periodOfDay: PeriodOfDay | null, type: string, name: string, notes: string | null, lat: number, lng: number, createdAt: string }> | null } | null };

export type TripDetailQueryVariables = Exact<{
  tripId: string | number;
}>;


export type TripDetailQuery = { tripDetail: { id: string, title: string, description: string, startDate: string, endDate: string, datesPending: boolean | null, difficulty: string, maxRiders: number, participantCount: number, status: string, visibility: string, coverImageUrl: string | null, createdAt: string, isTemplate: boolean, slug: string | null, polyline: string | null, startLat: number | null, startLng: number | null, countryCode: string | null, regionCode: string | null, city: string | null, distanceM: number | null, elevationGainM: number | null, estimatedDurationMinutes: number | null, surfaceType: string | null, curvatureIndex: number | null, dayCount: number | null, isFeatured: boolean, isMotovaultPick: boolean, viewCount: number, cloneCount: number, averageRating: number | null, reviewCount: number, publishedAt: string | null, isFlagged: boolean, isSaved: boolean | null, clonedFromTripId: string | null, forkedFromTripId: string | null, organiser: { id: string, displayName: string, publicUsername: string | null, avatarUrl: string | null }, waypoints: Array<{ id: string, tripId: string, sortOrder: number, dayIndex: number, periodOfDay: PeriodOfDay | null, type: string, name: string, notes: string | null, lat: number, lng: number, createdAt: string }> | null, participants: Array<{ id: string, displayName: string, publicUsername: string | null, avatarUrl: string | null, role: string, status: string, bikeId: string | null, joinedAt: string }> | null } };

export type TripInvitesQueryVariables = Exact<{
  tripId: string | number;
}>;


export type TripInvitesQuery = { tripInvites: Array<{ id: string, invitedUserId: string, invitedAt: string, acceptedAt: string | null, declinedAt: string | null }> };

export type TripReviewsQueryVariables = Exact<{
  tripId: string | number;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type TripReviewsQuery = { tripReviews: Array<{ id: string, rating: number, text: string | null, conditionTags: Array<string> | null, createdAt: string, tripId: string, userId: string | null, bikeId: string | null, author: { id: string, displayName: string, publicUsername: string | null, avatarUrl: string | null } | null, bike: { make: string, model: string, year: number, type: string | null } | null }> };

export type TripSuggestionsQueryVariables = Exact<{
  tripId: string | number;
}>;


export type TripSuggestionsQuery = { tripSuggestions: Array<{ id: string, tripId: string, kind: TripSuggestionKind, name: string, notes: string | null, lat: number | null, lng: number | null, dayIndex: number | null, periodOfDay: PeriodOfDay | null, status: TripSuggestionStatus, decidedBy: string | null, decidedAt: string | null, decidedNote: string | null, waypointId: string | null, createdAt: string, author: { id: string, displayName: string, avatarUrl: string | null, publicUsername: string | null } }> };

export type TripTemplatesQueryVariables = Exact<{
  filter?: TripTemplateFilterInput | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type TripTemplatesQuery = { tripTemplates: { edges: Array<{ cursor: string, node: { id: string, slug: string | null, title: string, description: string, difficulty: string, dayCount: number | null, startLat: number | null, startLng: number | null, countryCode: string | null, regionCode: string | null, city: string | null, distanceM: number | null, elevationGainM: number | null, surfaceType: string | null, polyline: string | null, curvatureIndex: number | null, estimatedDurationMinutes: number | null, isFeatured: boolean, isMotovaultPick: boolean, coverImageUrl: string | null, viewCount: number, cloneCount: number, averageRating: number | null, reviewCount: number, publishedAt: string | null, organiser: { id: string, displayName: string, publicUsername: string | null, avatarUrl: string | null } } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type UnreviewedReceiptScansQueryVariables = Exact<{ [key: string]: never; }>;


export type UnreviewedReceiptScansQuery = { unreviewedReceiptScans: Array<{ scanId: string, storagePath: string | null, createdAt: string, result: { type: string, amount: number | null, currency: string | null, date: string | null, vendor: string | null, itemName: string | null, category: string | null, partsCost: number | null, laborCost: number | null, taxAmount: number | null, taxRate: number | null, odometerValue: number | null, odometerUnit: string | null, fuelLitres: number | null, partsNeeded: Array<string>, legibilityNote: string | null, needsCheck: Array<string>, lineItems: Array<{ label: string, serviceType: string | null, partRef: string | null, quantity: number | null, unitPrice: number | null, lineTotal: number | null }>, fieldConfidence: { amount: number, currency: number, date: number, vendor: number, category: number, odometer: number } } | null }> };

export type BlogPostFieldsFragment = { id: string, type: string, slug: string, status: string, publishedAt: string | null, scheduledFor: string | null, author: string | null, coverImage: string | null, coverAlt: string | null, specData: boolean, isSafetyCritical: boolean, createdAt: string, updatedAt: string, typeData: Record<string, unknown> | null, translations: Array<{ locale: string, title: string, excerpt: string | null, seoTitle: string | null, seoDescription: string | null, bodyRaw: string, faq: Record<string, unknown> | null, readingTime: string | null, wordCount: number | null }>, categories: Array<{ id: string, slug: string, name: string, parentId: string | null, isPrimary: boolean | null }>, keywords: Array<{ id: string, slug: string, name: string }> };

export type ApproveMaintenanceDraftMutationVariables = Exact<{
  input: ApproveMaintenanceDraftInput;
}>;


export type ApproveMaintenanceDraftMutation = { approveMaintenanceDraft: boolean };

export type CreateBillingPortalSessionMutationVariables = Exact<{ [key: string]: never; }>;


export type CreateBillingPortalSessionMutation = { createBillingPortalSession: { status: BillingPortalStatus, url: string | null } };

export type CreateBlogCategoryMutationVariables = Exact<{
  input: CreateBlogCategoryInput;
}>;


export type CreateBlogCategoryMutation = { createBlogCategory: { id: string, slug: string, name: string, parentId: string | null } };

export type CreateBlogKeywordMutationVariables = Exact<{
  input: CreateBlogKeywordInput;
}>;


export type CreateBlogKeywordMutation = { createBlogKeyword: { id: string, slug: string, name: string } };

export type CreateBlogPostMutationVariables = Exact<{
  input: CreateBlogPostInput;
}>;


export type CreateBlogPostMutation = { createBlogPost: { id: string, type: string, slug: string, status: string, publishedAt: string | null, scheduledFor: string | null, author: string | null, coverImage: string | null, coverAlt: string | null, specData: boolean, isSafetyCritical: boolean, createdAt: string, updatedAt: string, typeData: Record<string, unknown> | null, translations: Array<{ locale: string, title: string, excerpt: string | null, seoTitle: string | null, seoDescription: string | null, bodyRaw: string, faq: Record<string, unknown> | null, readingTime: string | null, wordCount: number | null }>, categories: Array<{ id: string, slug: string, name: string, parentId: string | null, isPrimary: boolean | null }>, keywords: Array<{ id: string, slug: string, name: string }> } };

export type DeleteBlogPostMutationVariables = Exact<{
  id: string;
}>;


export type DeleteBlogPostMutation = { deleteBlogPost: boolean };

export type PublishBlogPostMutationVariables = Exact<{
  id: string;
}>;


export type PublishBlogPostMutation = { publishBlogPost: { id: string, type: string, slug: string, status: string, publishedAt: string | null, scheduledFor: string | null, author: string | null, coverImage: string | null, coverAlt: string | null, specData: boolean, isSafetyCritical: boolean, createdAt: string, updatedAt: string, typeData: Record<string, unknown> | null, translations: Array<{ locale: string, title: string, excerpt: string | null, seoTitle: string | null, seoDescription: string | null, bodyRaw: string, faq: Record<string, unknown> | null, readingTime: string | null, wordCount: number | null }>, categories: Array<{ id: string, slug: string, name: string, parentId: string | null, isPrimary: boolean | null }>, keywords: Array<{ id: string, slug: string, name: string }> } };

export type RevertBlogPostVersionMutationVariables = Exact<{
  id: string;
  versionNum: number;
}>;


export type RevertBlogPostVersionMutation = { revertBlogPostVersion: { id: string, type: string, slug: string, status: string, publishedAt: string | null, scheduledFor: string | null, author: string | null, coverImage: string | null, coverAlt: string | null, specData: boolean, isSafetyCritical: boolean, createdAt: string, updatedAt: string, typeData: Record<string, unknown> | null, translations: Array<{ locale: string, title: string, excerpt: string | null, seoTitle: string | null, seoDescription: string | null, bodyRaw: string, faq: Record<string, unknown> | null, readingTime: string | null, wordCount: number | null }>, categories: Array<{ id: string, slug: string, name: string, parentId: string | null, isPrimary: boolean | null }>, keywords: Array<{ id: string, slug: string, name: string }> } };

export type ScheduleBlogPostMutationVariables = Exact<{
  input: ScheduleBlogPostInput;
}>;


export type ScheduleBlogPostMutation = { scheduleBlogPost: { id: string, type: string, slug: string, status: string, publishedAt: string | null, scheduledFor: string | null, author: string | null, coverImage: string | null, coverAlt: string | null, specData: boolean, isSafetyCritical: boolean, createdAt: string, updatedAt: string, typeData: Record<string, unknown> | null, translations: Array<{ locale: string, title: string, excerpt: string | null, seoTitle: string | null, seoDescription: string | null, bodyRaw: string, faq: Record<string, unknown> | null, readingTime: string | null, wordCount: number | null }>, categories: Array<{ id: string, slug: string, name: string, parentId: string | null, isPrimary: boolean | null }>, keywords: Array<{ id: string, slug: string, name: string }> } };

export type UnpublishBlogPostMutationVariables = Exact<{
  id: string;
}>;


export type UnpublishBlogPostMutation = { unpublishBlogPost: { id: string, type: string, slug: string, status: string, publishedAt: string | null, scheduledFor: string | null, author: string | null, coverImage: string | null, coverAlt: string | null, specData: boolean, isSafetyCritical: boolean, createdAt: string, updatedAt: string, typeData: Record<string, unknown> | null, translations: Array<{ locale: string, title: string, excerpt: string | null, seoTitle: string | null, seoDescription: string | null, bodyRaw: string, faq: Record<string, unknown> | null, readingTime: string | null, wordCount: number | null }>, categories: Array<{ id: string, slug: string, name: string, parentId: string | null, isPrimary: boolean | null }>, keywords: Array<{ id: string, slug: string, name: string }> } };

export type UpdateBlogPostMutationVariables = Exact<{
  input: UpdateBlogPostInput;
}>;


export type UpdateBlogPostMutation = { updateBlogPost: { id: string, type: string, slug: string, status: string, publishedAt: string | null, scheduledFor: string | null, author: string | null, coverImage: string | null, coverAlt: string | null, specData: boolean, isSafetyCritical: boolean, createdAt: string, updatedAt: string, typeData: Record<string, unknown> | null, translations: Array<{ locale: string, title: string, excerpt: string | null, seoTitle: string | null, seoDescription: string | null, bodyRaw: string, faq: Record<string, unknown> | null, readingTime: string | null, wordCount: number | null }>, categories: Array<{ id: string, slug: string, name: string, parentId: string | null, isPrimary: boolean | null }>, keywords: Array<{ id: string, slug: string, name: string }> } };

export type AdminBlogPostVersionsQueryVariables = Exact<{
  id: string;
}>;


export type AdminBlogPostVersionsQuery = { adminBlogPostVersions: Array<{ versionNum: number, title: string | null, status: string | null, createdBy: string | null, createdAt: string }> };

export type AdminBlogPostQueryVariables = Exact<{
  id: string;
}>;


export type AdminBlogPostQuery = { adminBlogPost: { id: string, type: string, slug: string, status: string, publishedAt: string | null, scheduledFor: string | null, author: string | null, coverImage: string | null, coverAlt: string | null, specData: boolean, isSafetyCritical: boolean, createdAt: string, updatedAt: string, typeData: Record<string, unknown> | null, translations: Array<{ locale: string, title: string, excerpt: string | null, seoTitle: string | null, seoDescription: string | null, bodyRaw: string, faq: Record<string, unknown> | null, readingTime: string | null, wordCount: number | null }>, categories: Array<{ id: string, slug: string, name: string, parentId: string | null, isPrimary: boolean | null }>, keywords: Array<{ id: string, slug: string, name: string }> } | null };

export type AdminBlogPostsQueryVariables = Exact<{
  input?: ListBlogPostsInput | null | undefined;
}>;


export type AdminBlogPostsQuery = { adminBlogPosts: { totalCount: number, pageInfo: { hasNextPage: boolean, endCursor: string | null }, edges: Array<{ cursor: string, node: { id: string, type: string, slug: string, status: string, publishedAt: string | null, scheduledFor: string | null, author: string | null, coverImage: string | null, coverAlt: string | null, specData: boolean, isSafetyCritical: boolean, createdAt: string, updatedAt: string, typeData: Record<string, unknown> | null, translations: Array<{ locale: string, title: string, excerpt: string | null, seoTitle: string | null, seoDescription: string | null, bodyRaw: string, faq: Record<string, unknown> | null, readingTime: string | null, wordCount: number | null }>, categories: Array<{ id: string, slug: string, name: string, parentId: string | null, isPrimary: boolean | null }>, keywords: Array<{ id: string, slug: string, name: string }> } }> } };

export type BlogTaxonomyQueryVariables = Exact<{ [key: string]: never; }>;


export type BlogTaxonomyQuery = { adminBlogCategories: Array<{ id: string, slug: string, name: string, parentId: string | null }>, adminBlogKeywords: Array<{ id: string, slug: string, name: string }> };

export type BrowsePlaceFieldsFragment = { id: string, kind: string, name: string, countryCode: string, regionCode: string | null, slug: string, parentId: string | null, routeCount: number };

export type BrowseCountriesQueryVariables = Exact<{ [key: string]: never; }>;


export type BrowseCountriesQuery = { browseCountries: Array<{ id: string, kind: string, name: string, countryCode: string, regionCode: string | null, slug: string, parentId: string | null, routeCount: number }> };

export type BrowseCountryBySlugQueryVariables = Exact<{
  slug: string;
}>;


export type BrowseCountryBySlugQuery = { browseCountryBySlug: { id: string, kind: string, name: string, countryCode: string, regionCode: string | null, slug: string, parentId: string | null, routeCount: number } | null };

export type BrowseRegionsByCountrySlugQueryVariables = Exact<{
  countrySlug: string;
}>;


export type BrowseRegionsByCountrySlugQuery = { browseRegionsByCountrySlug: Array<{ id: string, kind: string, name: string, countryCode: string, regionCode: string | null, slug: string, parentId: string | null, routeCount: number }> };

export type BrowseExploreRegionQueryVariables = Exact<{
  countrySlug: string;
  regionSlug: string;
}>;


export type BrowseExploreRegionQuery = { browseExploreRegion: { country: { id: string, kind: string, name: string, countryCode: string, regionCode: string | null, slug: string, parentId: string | null, routeCount: number }, region: { id: string, kind: string, name: string, countryCode: string, regionCode: string | null, slug: string, parentId: string | null, routeCount: number } } | null };

export type GetGpxQuotaStatusQueryVariables = Exact<{ [key: string]: never; }>;


export type GetGpxQuotaStatusQuery = { getGPXQuotaStatus: { feature: string, limit: number, used: number, remaining: number, resetDate: string, isExhausted: boolean } };

export type GetTrialEligibilityQueryVariables = Exact<{ [key: string]: never; }>;


export type GetTrialEligibilityQuery = { me: { id: string, hasUsedTrial: boolean | null } };

export type MaintenanceDraftReviewQueryVariables = Exact<{ [key: string]: never; }>;


export type MaintenanceDraftReviewQuery = { maintenanceDraftReview: { schedules: Array<{ id: string, make: string, model: string | null, variant: string | null, taskName: string, intervalKm: number | null, intervalDays: number | null, priority: MaintenancePriority, isSafetyCritical: boolean, sourcePage: string | null, sourceContext: string | null, sourceTitle: string | null, createdAt: string }>, specs: Array<{ id: string, make: string, model: string | null, variant: string | null, specType: string, specName: string, valueNumeric: number, valueDisplay: string | null, unit: string, isSafetyCritical: boolean, sourcePage: string | null, sourceContext: string | null, sourceTitle: string | null, createdAt: string }> } };

export type MyRideCountQueryVariables = Exact<{ [key: string]: never; }>;


export type MyRideCountQuery = { myRides: { totalCount: number } };

export type PublicSavedTripsQueryVariables = Exact<{
  handle: string;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type PublicSavedTripsQuery = { publicSavedTrips: { edges: Array<{ cursor: string, node: { id: string, title: string, distanceM: number | null, elevationGainM: number | null, surfaceType: string | null, isMotovaultPick: boolean, averageRating: number | null, reviewCount: number, organiser: { id: string, displayName: string, publicUsername: string | null, avatarUrl: string | null } } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type SitemapPublishedTripsQueryVariables = Exact<{ [key: string]: never; }>;


export type SitemapPublishedTripsQuery = { sitemapPublishedTrips: Array<{ countryCode: string, regionCode: string, slug: string, updatedAt: string }> };

export type WebTripBySlugQueryVariables = Exact<{
  country: string;
  region: string;
  slug: string;
}>;


export type WebTripBySlugQuery = { tripBySlug: { id: string, slug: string | null, title: string, description: string, difficulty: string, dayCount: number | null, startLat: number | null, startLng: number | null, countryCode: string | null, regionCode: string | null, city: string | null, distanceM: number | null, elevationGainM: number | null, estimatedDurationMinutes: number | null, surfaceType: string | null, isFeatured: boolean, isMotovaultPick: boolean, viewCount: number, polyline: string | null, cloneCount: number, averageRating: number | null, reviewCount: number, publishedAt: string | null, updatedAt: string | null, createdAt: string, organiser: { id: string, displayName: string, publicUsername: string | null }, waypoints: Array<{ sortOrder: number, dayIndex: number, type: string, name: string, lat: number, lng: number, notes: string | null }> | null } | null };

export type WebTripPathByIdQueryVariables = Exact<{
  tripId: string | number;
}>;


export type WebTripPathByIdQuery = { tripDetail: { id: string, slug: string | null, countryCode: string | null, regionCode: string | null, title: string } };

export type WebTripReviewsQueryVariables = Exact<{
  country: string;
  region: string;
  slug: string;
  first?: number | null | undefined;
}>;


export type WebTripReviewsQuery = { tripReviews: Array<{ id: string, rating: number, text: string | null, conditionTags: Array<string> | null, createdAt: string, author: { id: string, displayName: string, publicUsername: string | null, avatarUrl: string | null } | null, bike: { make: string, model: string, year: number } | null }> };

export const RiderInsightsBestRideFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RiderInsightsBestRideFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RiderInsightsBestRide"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"localDate"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"climbM"}},{"kind":"Field","name":{"kind":"Name","value":"bendsPer10km"}},{"kind":"Field","name":{"kind":"Name","value":"movingTimeS"}}]}}]} as unknown as DocumentNode<RiderInsightsBestRideFieldsFragment, unknown>;
export const BlogPostFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BlogPostFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BlogPost"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledFor"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"}},{"kind":"Field","name":{"kind":"Name","value":"coverAlt"}},{"kind":"Field","name":{"kind":"Name","value":"specData"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"typeData"}},{"kind":"Field","name":{"kind":"Name","value":"translations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"excerpt"}},{"kind":"Field","name":{"kind":"Name","value":"seoTitle"}},{"kind":"Field","name":{"kind":"Name","value":"seoDescription"}},{"kind":"Field","name":{"kind":"Name","value":"bodyRaw"}},{"kind":"Field","name":{"kind":"Name","value":"faq"}},{"kind":"Field","name":{"kind":"Name","value":"readingTime"}},{"kind":"Field","name":{"kind":"Name","value":"wordCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"keywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<BlogPostFieldsFragment, unknown>;
export const BrowsePlaceFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BrowsePlaceFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BrowsePlace"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"routeCount"}}]}}]} as unknown as DocumentNode<BrowsePlaceFieldsFragment, unknown>;
export const AcknowledgeRecallDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AcknowledgeRecall"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"campaignNumber"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"acknowledgeRecall"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}},{"kind":"Argument","name":{"kind":"Name","value":"campaignNumber"},"value":{"kind":"Variable","name":{"kind":"Name","value":"campaignNumber"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"acknowledgedCount"}},{"kind":"Field","name":{"kind":"Name","value":"checkedAt"}},{"kind":"Field","name":{"kind":"Name","value":"vinUsed"}},{"kind":"Field","name":{"kind":"Name","value":"recalls"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"campaignNumber"}},{"kind":"Field","name":{"kind":"Name","value":"reportDate"}},{"kind":"Field","name":{"kind":"Name","value":"component"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"consequence"}},{"kind":"Field","name":{"kind":"Name","value":"remedy"}},{"kind":"Field","name":{"kind":"Name","value":"acknowledged"}},{"kind":"Field","name":{"kind":"Name","value":"acknowledgedAt"}}]}}]}}]}}]} as unknown as DocumentNode<AcknowledgeRecallMutation, AcknowledgeRecallMutationVariables>;
export const AddDocumentCategoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddDocumentCategory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddDocumentCategoryInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addDocumentCategory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isHidden"}},{"kind":"Field","name":{"kind":"Name","value":"promptsExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<AddDocumentCategoryMutation, AddDocumentCategoryMutationVariables>;
export const AddExpensePhotoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddExpensePhoto"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddExpensePhotoInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addExpensePhoto"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"expenseId"}},{"kind":"Field","name":{"kind":"Name","value":"storagePath"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileSizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<AddExpensePhotoMutation, AddExpensePhotoMutationVariables>;
export const AddNotePhotoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddNotePhoto"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddNotePhotoInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addNotePhoto"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"noteId"}},{"kind":"Field","name":{"kind":"Name","value":"storagePath"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileSizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<AddNotePhotoMutation, AddNotePhotoMutationVariables>;
export const AddTaskPhotoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddTaskPhoto"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddTaskPhotoInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addTaskPhoto"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"storagePath"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileSizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<AddTaskPhotoMutation, AddTaskPhotoMutationVariables>;
export const AddWaypointDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddWaypoint"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateWaypointInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addWaypoint"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"tripId"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"periodOfDay"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<AddWaypointMutation, AddWaypointMutationVariables>;
export const AskTripAssistantDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AskTripAssistant"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AskTripAssistantInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"askTripAssistant"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]} as unknown as DocumentNode<AskTripAssistantMutation, AskTripAssistantMutationVariables>;
export const CancelGroupRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CancelGroupRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cancelGroupRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupRideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}}}]}]}}]} as unknown as DocumentNode<CancelGroupRideMutation, CancelGroupRideMutationVariables>;
export const CancelReceiptScanDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CancelReceiptScan"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"scanId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cancelReceiptScan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"scanId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"scanId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CancelReceiptScanSuccess"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"scanId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReceiptScanError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}}]}}]}}]}}]} as unknown as DocumentNode<CancelReceiptScanMutation, CancelReceiptScanMutationVariables>;
export const CloneTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CloneTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cloneTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}]}]}}]} as unknown as DocumentNode<CloneTripMutation, CloneTripMutationVariables>;
export const CompleteMaintenanceTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompleteMaintenanceTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"CompleteMaintenanceTaskInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"createNextOccurrence"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completeMaintenanceTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}},{"kind":"Argument","name":{"kind":"Name","value":"createNextOccurrence"},"value":{"kind":"Variable","name":{"kind":"Name","value":"createNextOccurrence"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completed"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedMileage"}},{"kind":"Field","name":{"kind":"Name","value":"cost"}},{"kind":"Field","name":{"kind":"Name","value":"partsCost"}},{"kind":"Field","name":{"kind":"Name","value":"laborCost"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nextOccurrence"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","name":{"kind":"Name","value":"targetMileage"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isRecurring"}},{"kind":"Field","name":{"kind":"Name","value":"intervalKm"}},{"kind":"Field","name":{"kind":"Name","value":"intervalDays"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]} as unknown as DocumentNode<CompleteMaintenanceTaskMutation, CompleteMaintenanceTaskMutationVariables>;
export const CompleteOnboardingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompleteOnboarding"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CompleteOnboardingInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completeOnboarding"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"preferences"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<CompleteOnboardingMutation, CompleteOnboardingMutationVariables>;
export const CreateCommentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateComment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateCommentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createComment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"flaggedCount"}},{"kind":"Field","name":{"kind":"Name","value":"parentCommentId"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}}]}}]}}]} as unknown as DocumentNode<CreateCommentMutation, CreateCommentMutationVariables>;
export const CreateDiagnosticDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateDiagnostic"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateDiagnosticInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createDiagnostic"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"confidence"}},{"kind":"Field","name":{"kind":"Name","value":"relatedArticleId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"dataSharingOptedIn"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<CreateDiagnosticMutation, CreateDiagnosticMutationVariables>;
export const CreateDocumentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateDocument"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateDocumentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createDocument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"categoryId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"expiryDate"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"files"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"documentId"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"fileSizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]} as unknown as DocumentNode<CreateDocumentMutation, CreateDocumentMutationVariables>;
export const CreateFlagDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateFlag"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateFlagInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createFlag"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"articleId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"sectionReference"}},{"kind":"Field","name":{"kind":"Name","value":"comment"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<CreateFlagMutation, CreateFlagMutationVariables>;
export const CreateGroupRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateGroupRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateGroupRideInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createGroupRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]} as unknown as DocumentNode<CreateGroupRideMutation, CreateGroupRideMutationVariables>;
export const CreateMaintenanceTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateMaintenanceTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateMaintenanceTaskInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createMaintenanceTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","name":{"kind":"Name","value":"targetMileage"}},{"kind":"Field","name":{"kind":"Name","value":"isRecurring"}},{"kind":"Field","name":{"kind":"Name","value":"intervalKm"}},{"kind":"Field","name":{"kind":"Name","value":"intervalDays"}},{"kind":"Field","name":{"kind":"Name","value":"remind30d"}},{"kind":"Field","name":{"kind":"Name","value":"remind7d"}},{"kind":"Field","name":{"kind":"Name","value":"remind1d"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<CreateMaintenanceTaskMutation, CreateMaintenanceTaskMutationVariables>;
export const CreateMotorcycleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateMotorcycle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateMotorcycleInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createMotorcycle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"year"}},{"kind":"Field","name":{"kind":"Name","value":"nickname"}},{"kind":"Field","name":{"kind":"Name","value":"variant"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<CreateMotorcycleMutation, CreateMotorcycleMutationVariables>;
export const CreateNoteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateNote"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateNoteInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createNote"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"odometer"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"linkedTaskId"}},{"kind":"Field","name":{"kind":"Name","value":"linkedTaskTitle"}},{"kind":"Field","name":{"kind":"Name","value":"linkedExpenseId"}},{"kind":"Field","name":{"kind":"Name","value":"linkedExpenseAmount"}},{"kind":"Field","name":{"kind":"Name","value":"linkedExpenseCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"storagePath"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}}]}}]}}]}}]} as unknown as DocumentNode<CreateNoteMutation, CreateNoteMutationVariables>;
export const CreateServiceReminderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateServiceReminder"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateServiceReminderInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createServiceReminder"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","name":{"kind":"Name","value":"isRecurring"}}]}}]}}]} as unknown as DocumentNode<CreateServiceReminderMutation, CreateServiceReminderMutationVariables>;
export const CreateShareLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateShareLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateShareLinkInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createShareLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]} as unknown as DocumentNode<CreateShareLinkMutation, CreateShareLinkMutationVariables>;
export const CreateTaskFromNoteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateTaskFromNote"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"noteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createTaskFromNote"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"noteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"noteId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"odometer"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"linkedTaskId"}},{"kind":"Field","name":{"kind":"Name","value":"linkedTaskTitle"}},{"kind":"Field","name":{"kind":"Name","value":"linkedExpenseId"}},{"kind":"Field","name":{"kind":"Name","value":"linkedExpenseAmount"}},{"kind":"Field","name":{"kind":"Name","value":"linkedExpenseCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"storagePath"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}}]}}]}}]}}]} as unknown as DocumentNode<CreateTaskFromNoteMutation, CreateTaskFromNoteMutationVariables>;
export const CreateTripReviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateTripReview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateTripReviewInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createTripReview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"conditionTags"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"tripId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"bikeId"}}]}}]}}]} as unknown as DocumentNode<CreateTripReviewMutation, CreateTripReviewMutationVariables>;
export const CreateTripSuggestionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateTripSuggestion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateTripSuggestionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createTripSuggestion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"tripId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"periodOfDay"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}}]}}]}}]} as unknown as DocumentNode<CreateTripSuggestionMutation, CreateTripSuggestionMutationVariables>;
export const CreateTripWithWaypointsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateTripWithWaypoints"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateTripWithWaypointsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createTripWithWaypoints"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"datesPending"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"waypoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"tripId"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"periodOfDay"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}}]}}]}}]}}]} as unknown as DocumentNode<CreateTripWithWaypointsMutation, CreateTripWithWaypointsMutationVariables>;
export const CreateTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateTripInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}}]} as unknown as DocumentNode<CreateTripMutation, CreateTripMutationVariables>;
export const DeleteAccountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteAccount"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteAccount"}}]}}]} as unknown as DocumentNode<DeleteAccountMutation, DeleteAccountMutationVariables>;
export const DeleteCommentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteComment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"commentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteComment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"commentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"commentId"}}}]}]}}]} as unknown as DocumentNode<DeleteCommentMutation, DeleteCommentMutationVariables>;
export const DeleteDocumentCategoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteDocumentCategory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteDocumentCategory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteDocumentCategoryMutation, DeleteDocumentCategoryMutationVariables>;
export const DeleteDocumentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteDocument"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteDocument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteDocumentMutation, DeleteDocumentMutationVariables>;
export const DeleteExpensePhotoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteExpensePhoto"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"photoId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteExpensePhoto"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"photoId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"photoId"}}}]}]}}]} as unknown as DocumentNode<DeleteExpensePhotoMutation, DeleteExpensePhotoMutationVariables>;
export const DeleteExpenseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteExpense"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteExpense"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteExpenseMutation, DeleteExpenseMutationVariables>;
export const DeleteMaintenanceTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteMaintenanceTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteMaintenanceTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteMaintenanceTaskMutation, DeleteMaintenanceTaskMutationVariables>;
export const DeleteMotorcycleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteMotorcycle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteMotorcycle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteMotorcycleMutation, DeleteMotorcycleMutationVariables>;
export const DeleteNotePhotoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteNotePhoto"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"photoId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteNotePhoto"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"photoId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"photoId"}}}]}]}}]} as unknown as DocumentNode<DeleteNotePhotoMutation, DeleteNotePhotoMutationVariables>;
export const DeleteNoteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteNote"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteNote"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteNoteMutation, DeleteNoteMutationVariables>;
export const DeleteRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteRideMutation, DeleteRideMutationVariables>;
export const DeleteTaskPhotoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteTaskPhoto"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"photoId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteTaskPhoto"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"photoId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"photoId"}}}]}]}}]} as unknown as DocumentNode<DeleteTaskPhotoMutation, DeleteTaskPhotoMutationVariables>;
export const DeleteTripReviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteTripReview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reviewId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteTripReview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"reviewId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reviewId"}}}]}]}}]} as unknown as DocumentNode<DeleteTripReviewMutation, DeleteTripReviewMutationVariables>;
export const DeleteTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}]}]}}]} as unknown as DocumentNode<DeleteTripMutation, DeleteTripMutationVariables>;
export const EndRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EndRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"EndRideInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"endRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ride"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"endedAt"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"maxSpeedMps"}},{"kind":"Field","name":{"kind":"Name","value":"avgSpeedMps"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGain"}},{"kind":"Field","name":{"kind":"Name","value":"elevationLoss"}},{"kind":"Field","name":{"kind":"Name","value":"pausedDurationS"}},{"kind":"Field","name":{"kind":"Name","value":"autoPausedDurationS"}},{"kind":"Field","name":{"kind":"Name","value":"gpsQuality"}},{"kind":"Field","name":{"kind":"Name","value":"routePolyline"}},{"kind":"Field","name":{"kind":"Name","value":"mileageApplied"}},{"kind":"Field","name":{"kind":"Name","value":"endSource"}}]}},{"kind":"Field","name":{"kind":"Name","value":"triggeredMaintenanceTasks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}}]}}]}}]}}]} as unknown as DocumentNode<EndRideMutation, EndRideMutationVariables>;
export const ExportTripGpxDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ExportTripGpx"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"country"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"region"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exportTripGPX"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"country"},"value":{"kind":"Variable","name":{"kind":"Name","value":"country"}}},{"kind":"Argument","name":{"kind":"Name","value":"region"},"value":{"kind":"Variable","name":{"kind":"Name","value":"region"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GPXExportSuccess"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fileUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GPXExportError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"quotaRemaining"}},{"kind":"Field","name":{"kind":"Name","value":"upgradeUrl"}}]}}]}}]}}]} as unknown as DocumentNode<ExportTripGpxMutation, ExportTripGpxMutationVariables>;
export const FlagCommentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FlagComment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"commentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"flagComment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"commentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"commentId"}}}]}]}}]} as unknown as DocumentNode<FlagCommentMutation, FlagCommentMutationVariables>;
export const FollowRiderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FollowRider"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FollowRiderInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"followRider"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"followerId"}},{"kind":"Field","name":{"kind":"Name","value":"followingId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<FollowRiderMutation, FollowRiderMutationVariables>;
export const GenerateArticleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"GenerateArticle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GenerateArticleInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"generateArticle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"contentJson"}},{"kind":"Field","name":{"kind":"Name","value":"readTime"}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}}]}}]}}]} as unknown as DocumentNode<GenerateArticleMutation, GenerateArticleMutationVariables>;
export const GenerateBikeHealthReportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"GenerateBikeHealthReport"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GenerateReportInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"generateBikeHealthReport"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"pdfUrl"}},{"kind":"Field","name":{"kind":"Name","value":"iapTransactionId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]}}]} as unknown as DocumentNode<GenerateBikeHealthReportMutation, GenerateBikeHealthReportMutationVariables>;
export const GenerateOnboardingInsightsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"GenerateOnboardingInsights"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GenerateInsightsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"generateOnboardingInsights"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]}}]} as unknown as DocumentNode<GenerateOnboardingInsightsMutation, GenerateOnboardingInsightsMutationVariables>;
export const ImportOemScheduleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ImportOemSchedule"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"importOemSchedule"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}]}]}}]} as unknown as DocumentNode<ImportOemScheduleMutation, ImportOemScheduleMutationVariables>;
export const InviteToTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InviteToTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"invitedUserId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"inviteToTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}},{"kind":"Argument","name":{"kind":"Name","value":"invitedUserId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"invitedUserId"}}}]}]}}]} as unknown as DocumentNode<InviteToTripMutation, InviteToTripMutationVariables>;
export const JoinGroupRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinGroupRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinGroupRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupRideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}}}]}]}}]} as unknown as DocumentNode<JoinGroupRideMutation, JoinGroupRideMutationVariables>;
export const JoinPremiumWaitlistDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinPremiumWaitlist"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"feature"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinPremiumWaitlist"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"feature"},"value":{"kind":"Variable","name":{"kind":"Name","value":"feature"}}}]}]}}]} as unknown as DocumentNode<JoinPremiumWaitlistMutation, JoinPremiumWaitlistMutationVariables>;
export const JoinTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"JoinTripInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<JoinTripMutation, JoinTripMutationVariables>;
export const LeaveGroupRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LeaveGroupRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"leaveGroupRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupRideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}}}]}]}}]} as unknown as DocumentNode<LeaveGroupRideMutation, LeaveGroupRideMutationVariables>;
export const LeaveTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LeaveTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"leaveTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}]}]}}]} as unknown as DocumentNode<LeaveTripMutation, LeaveTripMutationVariables>;
export const LogExpenseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LogExpense"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LogExpenseInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logExpense"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"itemName"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<LogExpenseMutation, LogExpenseMutationVariables>;
export const LogOdometerReadingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LogOdometerReading"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LogOdometerReadingInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logOdometerReading"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"currentMileage"}},{"kind":"Field","name":{"kind":"Name","value":"distanceUnit"}},{"kind":"Field","name":{"kind":"Name","value":"mileageUpdatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"odometerSyncSource"}},{"kind":"Field","name":{"kind":"Name","value":"odometerLastRideId"}}]}}]}}]} as unknown as DocumentNode<LogOdometerReadingMutation, LogOdometerReadingMutationVariables>;
export const MarkArticleReadDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarkArticleRead"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"articleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"markArticleRead"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"articleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"articleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"articleId"}},{"kind":"Field","name":{"kind":"Name","value":"articleRead"}},{"kind":"Field","name":{"kind":"Name","value":"quizCompleted"}},{"kind":"Field","name":{"kind":"Name","value":"quizBestScore"}},{"kind":"Field","name":{"kind":"Name","value":"firstReadAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastReadAt"}}]}}]}}]} as unknown as DocumentNode<MarkArticleReadMutation, MarkArticleReadMutationVariables>;
export const PauseRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PauseRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RidePauseInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pauseRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<PauseRideMutation, PauseRideMutationVariables>;
export const PublishAsTemplateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PublishAsTemplate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publishAsTemplate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"isTemplate"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<PublishAsTemplateMutation, PublishAsTemplateMutationVariables>;
export const PublishTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PublishTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publishTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<PublishTripMutation, PublishTripMutationVariables>;
export const RegenerateRideSummaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RegenerateRideSummary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"regenerateRideSummary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"rideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"rideId"}},{"kind":"Field","name":{"kind":"Name","value":"summaryText"}},{"kind":"Field","name":{"kind":"Name","value":"generationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<RegenerateRideSummaryMutation, RegenerateRideSummaryMutationVariables>;
export const RegisterPushTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RegisterPushToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RegisterPushTokenInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registerPushToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}}]}}]}}]} as unknown as DocumentNode<RegisterPushTokenMutation, RegisterPushTokenMutationVariables>;
export const RemoveWaypointDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveWaypoint"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"waypointId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removeWaypoint"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"waypointId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"waypointId"}}}]}]}}]} as unknown as DocumentNode<RemoveWaypointMutation, RemoveWaypointMutationVariables>;
export const ReorderWaypointsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReorderWaypoints"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ReorderWaypointsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reorderWaypoints"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<ReorderWaypointsMutation, ReorderWaypointsMutationVariables>;
export const RequestDataExportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RequestDataExport"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requestDataExport"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"requestedAt"}}]}}]}}]} as unknown as DocumentNode<RequestDataExportMutation, RequestDataExportMutationVariables>;
export const RespondToTripInviteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RespondToTripInvite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inviteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"accept"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"respondToTripInvite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"inviteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inviteId"}}},{"kind":"Argument","name":{"kind":"Name","value":"accept"},"value":{"kind":"Variable","name":{"kind":"Name","value":"accept"}}}]}]}}]} as unknown as DocumentNode<RespondToTripInviteMutation, RespondToTripInviteMutationVariables>;
export const RespondToTripSuggestionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RespondToTripSuggestion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RespondToTripSuggestionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"respondToTripSuggestion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"decidedBy"}},{"kind":"Field","name":{"kind":"Name","value":"decidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"decidedNote"}},{"kind":"Field","name":{"kind":"Name","value":"waypointId"}}]}}]}}]} as unknown as DocumentNode<RespondToTripSuggestionMutation, RespondToTripSuggestionMutationVariables>;
export const ResumeRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResumeRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RidePauseInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resumeRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<ResumeRideMutation, ResumeRideMutationVariables>;
export const RevokeShareLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RevokeShareLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"linkId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"revokeShareLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"linkId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"linkId"}}}]}]}}]} as unknown as DocumentNode<RevokeShareLinkMutation, RevokeShareLinkMutationVariables>;
export const RotateTripShareTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RotateTripShareToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rotateTripShareToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}]}]}}]} as unknown as DocumentNode<RotateTripShareTokenMutation, RotateTripShareTokenMutationVariables>;
export const SaveReceiptScanDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveReceiptScan"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"scanId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SaveReceiptScanInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saveReceiptScan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"scanId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"scanId"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SaveReceiptScanSuccess"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"scanId"}},{"kind":"Field","name":{"kind":"Name","value":"refs"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordType"}},{"kind":"Field","name":{"kind":"Name","value":"expenseId"}},{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"photoId"}},{"kind":"Field","name":{"kind":"Name","value":"odometer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"previous"}},{"kind":"Field","name":{"kind":"Name","value":"applied"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReceiptScanError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}}]}}]}}]}}]} as unknown as DocumentNode<SaveReceiptScanMutation, SaveReceiptScanMutationVariables>;
export const SaveTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saveTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}]}]}}]} as unknown as DocumentNode<SaveTripMutation, SaveTripMutationVariables>;
export const ScanReceiptDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ScanReceipt"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"scanId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isOnboarding"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"scanReceipt"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"scanId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"scanId"}}},{"kind":"Argument","name":{"kind":"Name","value":"isOnboarding"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isOnboarding"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReceiptScanSuccess"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"scanId"}},{"kind":"Field","name":{"kind":"Name","value":"result"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"vendor"}},{"kind":"Field","name":{"kind":"Name","value":"itemName"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"partsCost"}},{"kind":"Field","name":{"kind":"Name","value":"laborCost"}},{"kind":"Field","name":{"kind":"Name","value":"taxAmount"}},{"kind":"Field","name":{"kind":"Name","value":"taxRate"}},{"kind":"Field","name":{"kind":"Name","value":"lineItems"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"serviceType"}},{"kind":"Field","name":{"kind":"Name","value":"partRef"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPrice"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"Field","name":{"kind":"Name","value":"odometerValue"}},{"kind":"Field","name":{"kind":"Name","value":"odometerUnit"}},{"kind":"Field","name":{"kind":"Name","value":"fuelLitres"}},{"kind":"Field","name":{"kind":"Name","value":"partsNeeded"}},{"kind":"Field","name":{"kind":"Name","value":"legibilityNote"}},{"kind":"Field","name":{"kind":"Name","value":"needsCheck"}},{"kind":"Field","name":{"kind":"Name","value":"fieldConfidence"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"vendor"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"odometer"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReceiptScanError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}}]}}]}}]}}]} as unknown as DocumentNode<ScanReceiptMutation, ScanReceiptMutationVariables>;
export const SendFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SendFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SendFeedbackInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sendFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<SendFeedbackMutation, SendFeedbackMutationVariables>;
export const SetTripParticipantRoleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetTripParticipantRole"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SetParticipantRoleInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setTripParticipantRole"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<SetTripParticipantRoleMutation, SetTripParticipantRoleMutationVariables>;
export const ShareRideAsTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ShareRideAsTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ShareRideAsTripInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shareRideAsTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}}]}}]}}]} as unknown as DocumentNode<ShareRideAsTripMutation, ShareRideAsTripMutationVariables>;
export const ShareRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ShareRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sharedWithUserId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shareRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"rideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}}},{"kind":"Argument","name":{"kind":"Name","value":"sharedWithUserId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sharedWithUserId"}}}]}]}}]} as unknown as DocumentNode<ShareRideMutation, ShareRideMutationVariables>;
export const StartRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StartRideInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}}]}}]}}]} as unknown as DocumentNode<StartRideMutation, StartRideMutationVariables>;
export const SubmitDiagnosticDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SubmitDiagnostic"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SubmitDiagnosticInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"submitDiagnostic"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"confidence"}},{"kind":"Field","name":{"kind":"Name","value":"relatedArticleId"}},{"kind":"Field","name":{"kind":"Name","value":"resultJson"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"photoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<SubmitDiagnosticMutation, SubmitDiagnosticMutationVariables>;
export const TrackAffiliateClickDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"TrackAffiliateClick"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"TrackClickInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trackAffiliateClick"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"partner"}},{"kind":"Field","name":{"kind":"Name","value":"affiliateUrl"}},{"kind":"Field","name":{"kind":"Name","value":"productUrl"}},{"kind":"Field","name":{"kind":"Name","value":"tracked"}}]}}]}}]} as unknown as DocumentNode<TrackAffiliateClickMutation, TrackAffiliateClickMutationVariables>;
export const UnacknowledgeRecallDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnacknowledgeRecall"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"campaignNumber"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unacknowledgeRecall"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}},{"kind":"Argument","name":{"kind":"Name","value":"campaignNumber"},"value":{"kind":"Variable","name":{"kind":"Name","value":"campaignNumber"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"acknowledgedCount"}},{"kind":"Field","name":{"kind":"Name","value":"checkedAt"}},{"kind":"Field","name":{"kind":"Name","value":"vinUsed"}},{"kind":"Field","name":{"kind":"Name","value":"recalls"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"campaignNumber"}},{"kind":"Field","name":{"kind":"Name","value":"reportDate"}},{"kind":"Field","name":{"kind":"Name","value":"component"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"consequence"}},{"kind":"Field","name":{"kind":"Name","value":"remedy"}},{"kind":"Field","name":{"kind":"Name","value":"acknowledged"}},{"kind":"Field","name":{"kind":"Name","value":"acknowledgedAt"}}]}}]}}]}}]} as unknown as DocumentNode<UnacknowledgeRecallMutation, UnacknowledgeRecallMutationVariables>;
export const UndoReceiptScanSaveDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UndoReceiptScanSave"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"scanId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"undoReceiptScanSave"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"scanId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"scanId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UndoReceiptScanSuccess"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"scanId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReceiptScanError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}}]}}]}}]}}]} as unknown as DocumentNode<UndoReceiptScanSaveMutation, UndoReceiptScanSaveMutationVariables>;
export const UnfollowRiderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnfollowRider"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UnfollowRiderInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unfollowRider"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<UnfollowRiderMutation, UnfollowRiderMutationVariables>;
export const UnpublishTemplateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnpublishTemplate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unpublishTemplate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}]}]}}]} as unknown as DocumentNode<UnpublishTemplateMutation, UnpublishTemplateMutationVariables>;
export const UnregisterPushTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnregisterPushToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UnregisterPushTokenInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unregisterPushToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}}]}}]}}]} as unknown as DocumentNode<UnregisterPushTokenMutation, UnregisterPushTokenMutationVariables>;
export const UnsaveTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnsaveTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unsaveTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}]}]}}]} as unknown as DocumentNode<UnsaveTripMutation, UnsaveTripMutationVariables>;
export const UnshareRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnshareRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sharedWithUserId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unshareRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"rideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}}},{"kind":"Argument","name":{"kind":"Name","value":"sharedWithUserId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sharedWithUserId"}}}]}]}}]} as unknown as DocumentNode<UnshareRideMutation, UnshareRideMutationVariables>;
export const UpdateDocumentCategoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateDocumentCategory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateDocumentCategoryInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateDocumentCategory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isHidden"}},{"kind":"Field","name":{"kind":"Name","value":"promptsExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateDocumentCategoryMutation, UpdateDocumentCategoryMutationVariables>;
export const UpdateDocumentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateDocument"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateDocumentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateDocument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"categoryId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"expiryDate"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateDocumentMutation, UpdateDocumentMutationVariables>;
export const UpdateMaintenanceTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateMaintenanceTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateMaintenanceTaskInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateMaintenanceTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","name":{"kind":"Name","value":"targetMileage"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"isRecurring"}},{"kind":"Field","name":{"kind":"Name","value":"intervalKm"}},{"kind":"Field","name":{"kind":"Name","value":"intervalDays"}},{"kind":"Field","name":{"kind":"Name","value":"remind30d"}},{"kind":"Field","name":{"kind":"Name","value":"remind7d"}},{"kind":"Field","name":{"kind":"Name","value":"remind1d"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateMaintenanceTaskMutation, UpdateMaintenanceTaskMutationVariables>;
export const UpdateMotorcycleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateMotorcycle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateMotorcycleInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateMotorcycle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"year"}},{"kind":"Field","name":{"kind":"Name","value":"nickname"}},{"kind":"Field","name":{"kind":"Name","value":"variant"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"primaryPhotoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"currentMileage"}},{"kind":"Field","name":{"kind":"Name","value":"mileageUnit"}},{"kind":"Field","name":{"kind":"Name","value":"distanceUnit"}},{"kind":"Field","name":{"kind":"Name","value":"mileageUpdatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"purchaseDate"}},{"kind":"Field","name":{"kind":"Name","value":"vin"}},{"kind":"Field","name":{"kind":"Name","value":"recallCount"}},{"kind":"Field","name":{"kind":"Name","value":"recallLastCheckedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateMotorcycleMutation, UpdateMotorcycleMutationVariables>;
export const UpdateMyProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateMyProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateProfileInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateMyProfile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"followerCount"}},{"kind":"Field","name":{"kind":"Name","value":"followingCount"}}]}}]}}]} as unknown as DocumentNode<UpdateMyProfileMutation, UpdateMyProfileMutationVariables>;
export const UpdateNoteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateNote"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateNoteInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateNote"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"odometer"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"linkedTaskId"}},{"kind":"Field","name":{"kind":"Name","value":"linkedTaskTitle"}},{"kind":"Field","name":{"kind":"Name","value":"linkedExpenseId"}},{"kind":"Field","name":{"kind":"Name","value":"linkedExpenseAmount"}},{"kind":"Field","name":{"kind":"Name","value":"linkedExpenseCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"storagePath"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateNoteMutation, UpdateNoteMutationVariables>;
export const UpdateParticipantStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateParticipantStatus"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateParticipantStatusInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateParticipantStatus"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<UpdateParticipantStatusMutation, UpdateParticipantStatusMutationVariables>;
export const UpdateRideVisibilityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateRideVisibility"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"visibility"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateRideVisibility"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"rideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}}},{"kind":"Argument","name":{"kind":"Name","value":"visibility"},"value":{"kind":"Variable","name":{"kind":"Name","value":"visibility"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}}]}}]}}]} as unknown as DocumentNode<UpdateRideVisibilityMutation, UpdateRideVisibilityMutationVariables>;
export const UpdateRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateRideInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"mileageApplied"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"purpose"}},{"kind":"Field","name":{"kind":"Name","value":"passenger"}}]}}]}}]} as unknown as DocumentNode<UpdateRideMutation, UpdateRideMutationVariables>;
export const UpdateTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateTripInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"waypoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"tripId"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"periodOfDay"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateTripMutation, UpdateTripMutationVariables>;
export const UpdateUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateUserInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}},{"kind":"Field","name":{"kind":"Name","value":"preferences"}},{"kind":"Field","name":{"kind":"Name","value":"measurementSystem"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}}]}}]}}]} as unknown as DocumentNode<UpdateUserMutation, UpdateUserMutationVariables>;
export const UpdateWaypointDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateWaypoint"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateWaypointInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateWaypoint"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"periodOfDay"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}}]}}]}}]} as unknown as DocumentNode<UpdateWaypointMutation, UpdateWaypointMutationVariables>;
export const UploadWaypointsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UploadWaypoints"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UploadWaypointsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"uploadWaypoints"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<UploadWaypointsMutation, UploadWaypointsMutationVariables>;
export const AllMaintenanceTasksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AllMaintenanceTasks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"allMaintenanceTasks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","name":{"kind":"Name","value":"targetMileage"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}},{"kind":"Field","name":{"kind":"Name","value":"remind30d"}},{"kind":"Field","name":{"kind":"Name","value":"remind7d"}},{"kind":"Field","name":{"kind":"Name","value":"remind1d"}}]}}]}}]} as unknown as DocumentNode<AllMaintenanceTasksQuery, AllMaintenanceTasksQueryVariables>;
export const ArticleBySlugFullDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ArticleBySlugFull"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"articleBySlugFull"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"contentJson"}},{"kind":"Field","name":{"kind":"Name","value":"readTime"}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<ArticleBySlugFullQuery, ArticleBySlugFullQueryVariables>;
export const DiagnosticByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DiagnosticById"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"diagnosticById"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"confidence"}},{"kind":"Field","name":{"kind":"Name","value":"relatedArticleId"}},{"kind":"Field","name":{"kind":"Name","value":"resultJson"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"photoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"dataSharingOptedIn"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<DiagnosticByIdQuery, DiagnosticByIdQueryVariables>;
export const DiagnosticQuotaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DiagnosticQuota"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"diagnosticQuota"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"used"}},{"kind":"Field","name":{"kind":"Name","value":"limit"}},{"kind":"Field","name":{"kind":"Name","value":"resetDate"}}]}}]}}]} as unknown as DocumentNode<DiagnosticQuotaQuery, DiagnosticQuotaQueryVariables>;
export const DiscoverRiderTripsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DiscoverRiderTrips"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"discoverRiderTrips"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"coverImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"waypoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}}]} as unknown as DocumentNode<DiscoverRiderTripsQuery, DiscoverRiderTripsQueryVariables>;
export const DocumentCategoriesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DocumentCategories"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeHidden"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"documentCategories"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"includeHidden"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeHidden"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isHidden"}},{"kind":"Field","name":{"kind":"Name","value":"promptsExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<DocumentCategoriesQuery, DocumentCategoriesQueryVariables>;
export const GetDocumentSignedUrlDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetDocumentSignedUrl"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"fileId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"download"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getDocumentSignedUrl"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"fileId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"fileId"}}},{"kind":"Argument","name":{"kind":"Name","value":"download"},"value":{"kind":"Variable","name":{"kind":"Name","value":"download"}}}]}]}}]} as unknown as DocumentNode<GetDocumentSignedUrlQuery, GetDocumentSignedUrlQueryVariables>;
export const DocumentsByMotorcycleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DocumentsByMotorcycle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"documents"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"categoryId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"expiryDate"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"files"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"documentId"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"fileSizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]} as unknown as DocumentNode<DocumentsByMotorcycleQuery, DocumentsByMotorcycleQueryVariables>;
export const ExpenseDashboardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExpenseDashboard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"expenseDashboard"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"currentYearTotal"}},{"kind":"Field","name":{"kind":"Name","value":"previousYearTotal"}},{"kind":"Field","name":{"kind":"Name","value":"allTimeTotal"}},{"kind":"Field","name":{"kind":"Name","value":"expenseCount"}},{"kind":"Field","name":{"kind":"Name","value":"monthlyBuckets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"month"}},{"kind":"Field","name":{"kind":"Name","value":"year"}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categoryTotals"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"currencies"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"currentYearTotal"}},{"kind":"Field","name":{"kind":"Name","value":"previousYearTotal"}},{"kind":"Field","name":{"kind":"Name","value":"allTimeTotal"}},{"kind":"Field","name":{"kind":"Name","value":"expenseCount"}},{"kind":"Field","name":{"kind":"Name","value":"monthlyBuckets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"month"}},{"kind":"Field","name":{"kind":"Name","value":"year"}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categoryTotals"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ExpenseDashboardQuery, ExpenseDashboardQueryVariables>;
export const ExpensePhotosDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExpensePhotos"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"expenseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"expensePhotos"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"expenseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"expenseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"expenseId"}},{"kind":"Field","name":{"kind":"Name","value":"storagePath"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileSizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<ExpensePhotosQuery, ExpensePhotosQueryVariables>;
export const ExpensesByMotorcycleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExpensesByMotorcycle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"year"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"expenses"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}},{"kind":"Argument","name":{"kind":"Name","value":"year"},"value":{"kind":"Variable","name":{"kind":"Name","value":"year"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ytdTotal"}},{"kind":"Field","name":{"kind":"Name","value":"currencyTotals"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"currencyTotals"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"expenses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"itemName"}},{"kind":"Field","name":{"kind":"Name","value":"maintenanceTaskId"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ExpensesByMotorcycleQuery, ExpensesByMotorcycleQueryVariables>;
export const ExpiringDocumentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExpiringDocuments"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"withinDays"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"expiringDocuments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"withinDays"},"value":{"kind":"Variable","name":{"kind":"Name","value":"withinDays"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"categoryId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"expiryDate"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}}]}}]}}]} as unknown as DocumentNode<ExpiringDocumentsQuery, ExpiringDocumentsQueryVariables>;
export const GetArticleBySlugDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetArticleBySlug"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"articleBySlug"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetArticleBySlugQuery, GetArticleBySlugQueryVariables>;
export const GetCommentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetComments"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"routeId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getComments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"rideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}}},{"kind":"Argument","name":{"kind":"Name","value":"routeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"routeId"}}},{"kind":"Argument","name":{"kind":"Name","value":"groupRideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}}},{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"comments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"flaggedCount"}},{"kind":"Field","name":{"kind":"Name","value":"parentCommentId"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"replies"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"flaggedCount"}},{"kind":"Field","name":{"kind":"Name","value":"parentCommentId"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<GetCommentsQuery, GetCommentsQueryVariables>;
export const GetFollowersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFollowers"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getFollowers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"followerId"}},{"kind":"Field","name":{"kind":"Name","value":"followingId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}},{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<GetFollowersQuery, GetFollowersQueryVariables>;
export const GetFollowingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFollowing"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getFollowing"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"followerId"}},{"kind":"Field","name":{"kind":"Name","value":"followingId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}},{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<GetFollowingQuery, GetFollowingQueryVariables>;
export const GetGroupRidesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetGroupRides"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getGroupRides"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"dateTime"}},{"kind":"Field","name":{"kind":"Name","value":"meetingPointLat"}},{"kind":"Field","name":{"kind":"Name","value":"meetingPointLng"}},{"kind":"Field","name":{"kind":"Name","value":"meetingPointName"}},{"kind":"Field","name":{"kind":"Name","value":"routeId"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}}]} as unknown as DocumentNode<GetGroupRidesQuery, GetGroupRidesQueryVariables>;
export const GetOnboardingRevealDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetOnboardingReveal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"make"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"year"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"model"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"onboardingReveal"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"make"},"value":{"kind":"Variable","name":{"kind":"Name","value":"make"}}},{"kind":"Argument","name":{"kind":"Name","value":"year"},"value":{"kind":"Variable","name":{"kind":"Name","value":"year"}}},{"kind":"Argument","name":{"kind":"Name","value":"model"},"value":{"kind":"Variable","name":{"kind":"Name","value":"model"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"year"}},{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"recallCount"}},{"kind":"Field","name":{"kind":"Name","value":"recallsChecked"}},{"kind":"Field","name":{"kind":"Name","value":"recalls"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"component"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"oemTaskCount"}},{"kind":"Field","name":{"kind":"Name","value":"projectedYearlyCostEur"}},{"kind":"Field","name":{"kind":"Name","value":"riderCount"}},{"kind":"Field","name":{"kind":"Name","value":"insights"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"knownIssues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetOnboardingRevealQuery, GetOnboardingRevealQueryVariables>;
export const GetPublicRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPublicRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getPublicRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"endedAt"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"maxSpeedMps"}},{"kind":"Field","name":{"kind":"Name","value":"avgSpeedMps"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGain"}},{"kind":"Field","name":{"kind":"Name","value":"elevationLoss"}},{"kind":"Field","name":{"kind":"Name","value":"pausedDurationS"}},{"kind":"Field","name":{"kind":"Name","value":"autoPausedDurationS"}},{"kind":"Field","name":{"kind":"Name","value":"durationS"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"routePolyline"}},{"kind":"Field","name":{"kind":"Name","value":"routeThumbnailUri"}},{"kind":"Field","name":{"kind":"Name","value":"gpsQuality"}},{"kind":"Field","name":{"kind":"Name","value":"mileageApplied"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<GetPublicRideQuery, GetPublicRideQueryVariables>;
export const GetRideSummaryStatsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRideSummaryStats"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ride"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"newRoadsM"}},{"kind":"Field","name":{"kind":"Name","value":"stats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"climbM"}}]}}]}}]}}]} as unknown as DocumentNode<GetRideSummaryStatsQuery, GetRideSummaryStatsQueryVariables>;
export const GetRideWaypointsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRideWaypoints"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"maxPoints"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideWaypoints"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"rideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}}},{"kind":"Argument","name":{"kind":"Name","value":"maxPoints"},"value":{"kind":"Variable","name":{"kind":"Name","value":"maxPoints"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordedAt"}},{"kind":"Field","name":{"kind":"Name","value":"latitude"}},{"kind":"Field","name":{"kind":"Name","value":"longitude"}},{"kind":"Field","name":{"kind":"Name","value":"altitude"}},{"kind":"Field","name":{"kind":"Name","value":"speedMps"}}]}}]}}]} as unknown as DocumentNode<GetRideWaypointsQuery, GetRideWaypointsQueryVariables>;
export const GetRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ride"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"endedAt"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"maxSpeedMps"}},{"kind":"Field","name":{"kind":"Name","value":"avgSpeedMps"}},{"kind":"Field","name":{"kind":"Name","value":"maxLeanAngle"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGain"}},{"kind":"Field","name":{"kind":"Name","value":"elevationLoss"}},{"kind":"Field","name":{"kind":"Name","value":"pausedDurationS"}},{"kind":"Field","name":{"kind":"Name","value":"autoPausedDurationS"}},{"kind":"Field","name":{"kind":"Name","value":"durationS"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"routePolyline"}},{"kind":"Field","name":{"kind":"Name","value":"routeThumbnailUri"}},{"kind":"Field","name":{"kind":"Name","value":"gpsQuality"}},{"kind":"Field","name":{"kind":"Name","value":"mileageApplied"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<GetRideQuery, GetRideQueryVariables>;
export const GetRiderInsightsHeadlineDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRiderInsightsHeadline"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"timeZone"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"riderInsights"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"timeZone"},"value":{"kind":"Variable","name":{"kind":"Name","value":"timeZone"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"season"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totals"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rides"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"countries"}}]}},{"kind":"Field","name":{"kind":"Name","value":"coverage"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rides"}},{"kind":"Field","name":{"kind":"Name","value":"qualifyingRides"}}]}},{"kind":"Field","name":{"kind":"Name","value":"latestRide"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideId"}},{"kind":"Field","name":{"kind":"Name","value":"localDate"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"newCountries"}}]}},{"kind":"Field","name":{"kind":"Name","value":"countries"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isoA2"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<GetRiderInsightsHeadlineQuery, GetRiderInsightsHeadlineQueryVariables>;
export const GetRiderInsightsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRiderInsights"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"from"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"to"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"timeZone"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"refreshEntitlement"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"riderInsights"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"from"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"Argument","name":{"kind":"Name","value":"to"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}},{"kind":"Argument","name":{"kind":"Name","value":"timeZone"},"value":{"kind":"Variable","name":{"kind":"Name","value":"timeZone"}}},{"kind":"Argument","name":{"kind":"Name","value":"refreshEntitlement"},"value":{"kind":"Variable","name":{"kind":"Name","value":"refreshEntitlement"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isPro"}},{"kind":"Field","name":{"kind":"Name","value":"season"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totals"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rides"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"countries"}}]}},{"kind":"Field","name":{"kind":"Name","value":"coverage"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rides"}},{"kind":"Field","name":{"kind":"Name","value":"qualifyingRides"}},{"kind":"Field","name":{"kind":"Name","value":"pendingRides"}},{"kind":"Field","name":{"kind":"Name","value":"pendingRecentRides"}},{"kind":"Field","name":{"kind":"Name","value":"ridesWithBike"}},{"kind":"Field","name":{"kind":"Name","value":"qualifying"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"withStats"}},{"kind":"Field","name":{"kind":"Name","value":"withRoute"}},{"kind":"Field","name":{"kind":"Name","value":"withWaypoints"}},{"kind":"Field","name":{"kind":"Name","value":"withBands"}},{"kind":"Field","name":{"kind":"Name","value":"withLean"}},{"kind":"Field","name":{"kind":"Name","value":"withMovingTime"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"latestRide"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideId"}},{"kind":"Field","name":{"kind":"Name","value":"localDate"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"newCountries"}}]}},{"kind":"Field","name":{"kind":"Name","value":"longestRide"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"localDate"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"movingTimeS"}},{"kind":"Field","name":{"kind":"Name","value":"durationS"}},{"kind":"Field","name":{"kind":"Name","value":"startPlace"}},{"kind":"Field","name":{"kind":"Name","value":"endPlace"}}]}},{"kind":"Field","name":{"kind":"Name","value":"ribbon"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"weekStart"}},{"kind":"Field","name":{"kind":"Name","value":"rides"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}}]}},{"kind":"Field","name":{"kind":"Name","value":"regions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"isoA2"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"rides"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"bounds"}},{"kind":"Field","name":{"kind":"Name","value":"routes"}}]}},{"kind":"Field","name":{"kind":"Name","value":"countries"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isoA2"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"firstDate"}},{"kind":"Field","name":{"kind":"Name","value":"firstRideId"}},{"kind":"Field","name":{"kind":"Name","value":"rides"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}}]}},{"kind":"Field","name":{"kind":"Name","value":"bikes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"rides"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"movingTimeS"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"territory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"headline"}},{"kind":"Field","name":{"kind":"Name","value":"detail"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exploredCells"}},{"kind":"Field","name":{"kind":"Name","value":"exploredKm2"}},{"kind":"Field","name":{"kind":"Name","value":"routedM"}},{"kind":"Field","name":{"kind":"Name","value":"newRoadM"}},{"kind":"Field","name":{"kind":"Name","value":"newRoadShare"}},{"kind":"Field","name":{"kind":"Name","value":"furthest"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"localDate"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"roadCharacter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"headline"}},{"kind":"Field","name":{"kind":"Name","value":"teaser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bandShares"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"straight"}},{"kind":"Field","name":{"kind":"Name","value":"sweeping"}},{"kind":"Field","name":{"kind":"Name","value":"twisty"}},{"kind":"Field","name":{"kind":"Name","value":"tight"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"detail"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bandKm"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"straight"}},{"kind":"Field","name":{"kind":"Name","value":"sweeping"}},{"kind":"Field","name":{"kind":"Name","value":"twisty"}},{"kind":"Field","name":{"kind":"Name","value":"tight"}}]}},{"kind":"Field","name":{"kind":"Name","value":"routedKm"}},{"kind":"Field","name":{"kind":"Name","value":"bendsCount"}},{"kind":"Field","name":{"kind":"Name","value":"bendsPer10km"}},{"kind":"Field","name":{"kind":"Name","value":"ridesWithBands"}},{"kind":"Field","name":{"kind":"Name","value":"ridesWithLean"}},{"kind":"Field","name":{"kind":"Name","value":"twistiest"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"localDate"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"bendsPer10km"}}]}},{"kind":"Field","name":{"kind":"Name","value":"straightest"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"localDate"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"bendsPer10km"}}]}},{"kind":"Field","name":{"kind":"Name","value":"lean"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"corners"}},{"kind":"Field","name":{"kind":"Name","value":"under20"}},{"kind":"Field","name":{"kind":"Name","value":"from20to30"}},{"kind":"Field","name":{"kind":"Name","value":"from30to40"}},{"kind":"Field","name":{"kind":"Name","value":"from40"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"rhythm"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"headline"}},{"kind":"Field","name":{"kind":"Name","value":"teaser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"grid"}}]}},{"kind":"Field","name":{"kind":"Name","value":"detail"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"grid"}},{"kind":"Field","name":{"kind":"Name","value":"rides"}},{"kind":"Field","name":{"kind":"Name","value":"weekendRides"}},{"kind":"Field","name":{"kind":"Name","value":"weekendShare"}},{"kind":"Field","name":{"kind":"Name","value":"medianDistanceM"}},{"kind":"Field","name":{"kind":"Name","value":"medianMovingTimeS"}},{"kind":"Field","name":{"kind":"Name","value":"ridesWithMovingTime"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"bestRides"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"headline"}},{"kind":"Field","name":{"kind":"Name","value":"teaser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"detail"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"byDistance"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RiderInsightsBestRideFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"byClimb"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RiderInsightsBestRideFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"byBends"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RiderInsightsBestRideFields"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"costPerKm"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"spend"}},{"kind":"Field","name":{"kind":"Name","value":"expenseCount"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"distanceSource"}},{"kind":"Field","name":{"kind":"Name","value":"costPerKm"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RiderInsightsBestRideFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RiderInsightsBestRide"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"localDate"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"climbM"}},{"kind":"Field","name":{"kind":"Name","value":"bendsPer10km"}},{"kind":"Field","name":{"kind":"Name","value":"movingTimeS"}}]}}]} as unknown as DocumentNode<GetRiderInsightsQuery, GetRiderInsightsQueryVariables>;
export const GetRiderProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRiderProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getRiderProfile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}},{"kind":"Field","name":{"kind":"Name","value":"followerCount"}},{"kind":"Field","name":{"kind":"Name","value":"followingCount"}},{"kind":"Field","name":{"kind":"Name","value":"isFollowing"}},{"kind":"Field","name":{"kind":"Name","value":"bikes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"year"}},{"kind":"Field","name":{"kind":"Name","value":"nickname"}}]}},{"kind":"Field","name":{"kind":"Name","value":"rideStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalRides"}},{"kind":"Field","name":{"kind":"Name","value":"totalDistance"}},{"kind":"Field","name":{"kind":"Name","value":"joinDate"}}]}}]}}]}}]} as unknown as DocumentNode<GetRiderProfileQuery, GetRiderProfileQueryVariables>;
export const GetTripsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetTrips"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getTrips"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"coverImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"waypoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}}]} as unknown as DocumentNode<GetTripsQuery, GetTripsQueryVariables>;
export const GetWeatherForecastDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetWeatherForecast"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WeatherForecastInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"weatherForecast"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"days"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"tempMax"}},{"kind":"Field","name":{"kind":"Name","value":"tempMin"}},{"kind":"Field","name":{"kind":"Name","value":"precipProbability"}},{"kind":"Field","name":{"kind":"Name","value":"weatherCode"}}]}}]}}]}}]} as unknown as DocumentNode<GetWeatherForecastQuery, GetWeatherForecastQueryVariables>;
export const GroupRideDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GroupRideDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groupRideDetail"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupRideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"dateTime"}},{"kind":"Field","name":{"kind":"Name","value":"meetingPointLat"}},{"kind":"Field","name":{"kind":"Name","value":"meetingPointLng"}},{"kind":"Field","name":{"kind":"Name","value":"meetingPointName"}},{"kind":"Field","name":{"kind":"Name","value":"routeId"}},{"kind":"Field","name":{"kind":"Name","value":"routeDescription"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}},{"kind":"Field","name":{"kind":"Name","value":"joinedAt"}}]}}]}}]}}]} as unknown as DocumentNode<GroupRideDetailQuery, GroupRideDetailQueryVariables>;
export const IsTripSavedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"IsTripSaved"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isTripSaved"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}]}]}}]} as unknown as DocumentNode<IsTripSavedQuery, IsTripSavedQueryVariables>;
export const ListPopularArticlesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ListPopularArticles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"popularArticles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"readTime"}},{"kind":"Field","name":{"kind":"Name","value":"keywords"}}]}}]}}]} as unknown as DocumentNode<ListPopularArticlesQuery, ListPopularArticlesQueryVariables>;
export const MaintenanceTaskHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MaintenanceTaskHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maintenanceTaskHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","name":{"kind":"Name","value":"targetMileage"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"partsNeeded"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedMileage"}},{"kind":"Field","name":{"kind":"Name","value":"cost"}},{"kind":"Field","name":{"kind":"Name","value":"partsCost"}},{"kind":"Field","name":{"kind":"Name","value":"laborCost"}},{"kind":"Field","name":{"kind":"Name","value":"totalAmount"}},{"kind":"Field","name":{"kind":"Name","value":"taxAmount"}},{"kind":"Field","name":{"kind":"Name","value":"taxRate"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"oemScheduleId"}},{"kind":"Field","name":{"kind":"Name","value":"intervalKm"}},{"kind":"Field","name":{"kind":"Name","value":"intervalDays"}},{"kind":"Field","name":{"kind":"Name","value":"isRecurring"}},{"kind":"Field","name":{"kind":"Name","value":"lineItems"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"serviceType"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<MaintenanceTaskHistoryQuery, MaintenanceTaskHistoryQueryVariables>;
export const MaintenanceTasksByMotorcycleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MaintenanceTasksByMotorcycle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maintenanceTasks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","name":{"kind":"Name","value":"targetMileage"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"partsNeeded"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedMileage"}},{"kind":"Field","name":{"kind":"Name","value":"cost"}},{"kind":"Field","name":{"kind":"Name","value":"partsCost"}},{"kind":"Field","name":{"kind":"Name","value":"laborCost"}},{"kind":"Field","name":{"kind":"Name","value":"totalAmount"}},{"kind":"Field","name":{"kind":"Name","value":"taxAmount"}},{"kind":"Field","name":{"kind":"Name","value":"taxRate"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"isRecurring"}},{"kind":"Field","name":{"kind":"Name","value":"intervalKm"}},{"kind":"Field","name":{"kind":"Name","value":"intervalDays"}},{"kind":"Field","name":{"kind":"Name","value":"remind30d"}},{"kind":"Field","name":{"kind":"Name","value":"remind7d"}},{"kind":"Field","name":{"kind":"Name","value":"remind1d"}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"storagePath"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"lineItems"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"serviceType"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<MaintenanceTasksByMotorcycleQuery, MaintenanceTasksByMotorcycleQueryVariables>;
export const MakeStatsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MakeStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"makeStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"riders"}},{"kind":"Field","name":{"kind":"Name","value":"models"}},{"kind":"Field","name":{"kind":"Name","value":"totalBikes"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}}]}}]}}]} as unknown as DocumentNode<MakeStatsQuery, MakeStatsQueryVariables>;
export const MeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"preferences"}},{"kind":"Field","name":{"kind":"Name","value":"measurementSystem"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"followerCount"}},{"kind":"Field","name":{"kind":"Name","value":"followingCount"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<MeQuery, MeQueryVariables>;
export const MotorcycleMakesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MotorcycleMakes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"motorcycleMakes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"makeId"}},{"kind":"Field","name":{"kind":"Name","value":"makeName"}},{"kind":"Field","name":{"kind":"Name","value":"isPopular"}}]}}]}}]} as unknown as DocumentNode<MotorcycleMakesQuery, MotorcycleMakesQueryVariables>;
export const MotorcycleModelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MotorcycleModels"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"makeId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"year"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"motorcycleModels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"makeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"makeId"}}},{"kind":"Argument","name":{"kind":"Name","value":"year"},"value":{"kind":"Variable","name":{"kind":"Name","value":"year"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modelId"}},{"kind":"Field","name":{"kind":"Name","value":"modelName"}}]}}]}}]} as unknown as DocumentNode<MotorcycleModelsQuery, MotorcycleModelsQueryVariables>;
export const MotorcycleRecallsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MotorcycleRecalls"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"motorcycleRecalls"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"acknowledgedCount"}},{"kind":"Field","name":{"kind":"Name","value":"checkedAt"}},{"kind":"Field","name":{"kind":"Name","value":"vinUsed"}},{"kind":"Field","name":{"kind":"Name","value":"recalls"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"campaignNumber"}},{"kind":"Field","name":{"kind":"Name","value":"reportDate"}},{"kind":"Field","name":{"kind":"Name","value":"component"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"consequence"}},{"kind":"Field","name":{"kind":"Name","value":"remedy"}},{"kind":"Field","name":{"kind":"Name","value":"acknowledged"}},{"kind":"Field","name":{"kind":"Name","value":"acknowledgedAt"}}]}}]}}]}}]} as unknown as DocumentNode<MotorcycleRecallsQuery, MotorcycleRecallsQueryVariables>;
export const MyDiagnosticsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyDiagnostics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myDiagnostics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"confidence"}},{"kind":"Field","name":{"kind":"Name","value":"relatedArticleId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"dataSharingOptedIn"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<MyDiagnosticsQuery, MyDiagnosticsQueryVariables>;
export const GetMyHealthReportsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMyHealthReports"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getMyHealthReports"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"pdfUrl"}},{"kind":"Field","name":{"kind":"Name","value":"iapTransactionId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]}}]} as unknown as DocumentNode<GetMyHealthReportsQuery, GetMyHealthReportsQueryVariables>;
export const MyMotorcyclesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyMotorcycles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myMotorcycles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"year"}},{"kind":"Field","name":{"kind":"Name","value":"nickname"}},{"kind":"Field","name":{"kind":"Name","value":"variant"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"primaryPhotoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"currentMileage"}},{"kind":"Field","name":{"kind":"Name","value":"mileageUnit"}},{"kind":"Field","name":{"kind":"Name","value":"distanceUnit"}},{"kind":"Field","name":{"kind":"Name","value":"mileageUpdatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"purchaseDate"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"engineCc"}},{"kind":"Field","name":{"kind":"Name","value":"vin"}},{"kind":"Field","name":{"kind":"Name","value":"recallCount"}},{"kind":"Field","name":{"kind":"Name","value":"recallLastCheckedAt"}},{"kind":"Field","name":{"kind":"Name","value":"odometerSyncSource"}},{"kind":"Field","name":{"kind":"Name","value":"odometerLastRideId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<MyMotorcyclesQuery, MyMotorcyclesQueryVariables>;
export const MyProgressDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyProgress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myProgress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"articleId"}},{"kind":"Field","name":{"kind":"Name","value":"articleRead"}},{"kind":"Field","name":{"kind":"Name","value":"quizCompleted"}},{"kind":"Field","name":{"kind":"Name","value":"quizBestScore"}},{"kind":"Field","name":{"kind":"Name","value":"firstReadAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastReadAt"}}]}}]}}]} as unknown as DocumentNode<MyProgressQuery, MyProgressQueryVariables>;
export const MyRidesForHeatmapDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyRidesForHeatmap"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myRides"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"routePolyline"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<MyRidesForHeatmapQuery, MyRidesForHeatmapQueryVariables>;
export const MyRidesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyRides"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myRides"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"endedAt"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"maxSpeedMps"}},{"kind":"Field","name":{"kind":"Name","value":"avgSpeedMps"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGain"}},{"kind":"Field","name":{"kind":"Name","value":"pausedDurationS"}},{"kind":"Field","name":{"kind":"Name","value":"autoPausedDurationS"}},{"kind":"Field","name":{"kind":"Name","value":"durationS"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"routePolyline"}},{"kind":"Field","name":{"kind":"Name","value":"routeThumbnailUri"}},{"kind":"Field","name":{"kind":"Name","value":"gpsQuality"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<MyRidesQuery, MyRidesQueryVariables>;
export const MyShareLinksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyShareLinks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myShareLinks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<MyShareLinksQuery, MyShareLinksQueryVariables>;
export const MyTripsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyTrips"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myTrips"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"coverImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"waypoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}}]} as unknown as DocumentNode<MyTripsQuery, MyTripsQueryVariables>;
export const NotesByMotorcycleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"NotesByMotorcycle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"notes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"odometer"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"linkedTaskId"}},{"kind":"Field","name":{"kind":"Name","value":"linkedTaskTitle"}},{"kind":"Field","name":{"kind":"Name","value":"linkedExpenseId"}},{"kind":"Field","name":{"kind":"Name","value":"linkedExpenseAmount"}},{"kind":"Field","name":{"kind":"Name","value":"linkedExpenseCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"storagePath"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}}]}}]}}]}}]} as unknown as DocumentNode<NotesByMotorcycleQuery, NotesByMotorcycleQueryVariables>;
export const OdometerReadingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"OdometerReadings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"odometerReadings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"recordedAt"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"rideId"}}]}}]}}]} as unknown as DocumentNode<OdometerReadingsQuery, OdometerReadingsQueryVariables>;
export const OemSchedulesPreviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"OemSchedulesPreview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"make"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"model"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"year"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"variant"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"oemSchedulesPreview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"make"},"value":{"kind":"Variable","name":{"kind":"Name","value":"make"}}},{"kind":"Argument","name":{"kind":"Name","value":"model"},"value":{"kind":"Variable","name":{"kind":"Name","value":"model"}}},{"kind":"Argument","name":{"kind":"Name","value":"year"},"value":{"kind":"Variable","name":{"kind":"Name","value":"year"}}},{"kind":"Argument","name":{"kind":"Name","value":"variant"},"value":{"kind":"Variable","name":{"kind":"Name","value":"variant"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"taskName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"intervalKm"}},{"kind":"Field","name":{"kind":"Name","value":"intervalDays"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}}]} as unknown as DocumentNode<OemSchedulesPreviewQuery, OemSchedulesPreviewQueryVariables>;
export const PendingRideDistanceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PendingRideDistance"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pendingRideDistance"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideCount"}},{"kind":"Field","name":{"kind":"Name","value":"distance"}}]}}]}}]} as unknown as DocumentNode<PendingRideDistanceQuery, PendingRideDistanceQueryVariables>;
export const ReceiptScanQuotaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ReceiptScanQuota"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"receiptScanQuota"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"used"}},{"kind":"Field","name":{"kind":"Name","value":"limit"}},{"kind":"Field","name":{"kind":"Name","value":"resetDate"}}]}}]}}]} as unknown as DocumentNode<ReceiptScanQuotaQuery, ReceiptScanQuotaQueryVariables>;
export const RideMilestoneStatsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RideMilestoneStats"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"excludeRideId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideMilestoneStats"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"excludeRideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"excludeRideId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"qualifyingRideCount"}},{"kind":"Field","name":{"kind":"Name","value":"longestQualifyingDistanceM"}}]}}]}}]} as unknown as DocumentNode<RideMilestoneStatsQuery, RideMilestoneStatsQueryVariables>;
export const RideOverviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RideOverview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideOverview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lastRide"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"durationS"}},{"kind":"Field","name":{"kind":"Name","value":"maxSpeedMps"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleName"}},{"kind":"Field","name":{"kind":"Name","value":"summaryTitle"}}]}},{"kind":"Field","name":{"kind":"Name","value":"last7Days"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideCount"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"durationS"}}]}},{"kind":"Field","name":{"kind":"Name","value":"last30Days"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideCount"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"durationS"}}]}},{"kind":"Field","name":{"kind":"Name","value":"thisWeek"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideCount"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"durationS"}}]}},{"kind":"Field","name":{"kind":"Name","value":"thisMonth"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideCount"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"durationS"}}]}},{"kind":"Field","name":{"kind":"Name","value":"dailyDistances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalRecords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordType"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"achievedAt"}},{"kind":"Field","name":{"kind":"Name","value":"previousValue"}},{"kind":"Field","name":{"kind":"Name","value":"rideId"}}]}}]}}]}}]} as unknown as DocumentNode<RideOverviewQuery, RideOverviewQueryVariables>;
export const SavedTripsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SavedTrips"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"savedTrips"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"dayCount"}},{"kind":"Field","name":{"kind":"Name","value":"startLat"}},{"kind":"Field","name":{"kind":"Name","value":"startLng"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGainM"}},{"kind":"Field","name":{"kind":"Name","value":"surfaceType"}},{"kind":"Field","name":{"kind":"Name","value":"isFeatured"}},{"kind":"Field","name":{"kind":"Name","value":"isMotovaultPick"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"cloneCount"}},{"kind":"Field","name":{"kind":"Name","value":"averageRating"}},{"kind":"Field","name":{"kind":"Name","value":"reviewCount"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"isTemplate"}},{"kind":"Field","name":{"kind":"Name","value":"isSaved"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}}]} as unknown as DocumentNode<SavedTripsQuery, SavedTripsQueryVariables>;
export const SearchArticlesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchArticles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SearchArticlesInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchArticles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"keywords"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}},{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<SearchArticlesQuery, SearchArticlesQueryVariables>;
export const SearchTypeaheadDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchTypeahead"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"q"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchTypeahead"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"q"},"value":{"kind":"Variable","name":{"kind":"Name","value":"q"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"routes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}}]}},{"kind":"Field","name":{"kind":"Name","value":"places"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"population"}}]}}]}}]}}]} as unknown as DocumentNode<SearchTypeaheadQuery, SearchTypeaheadQueryVariables>;
export const SpendingSummaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SpendingSummary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"spendingSummary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"thisYear"}},{"kind":"Field","name":{"kind":"Name","value":"allTime"}},{"kind":"Field","name":{"kind":"Name","value":"thisYearByCurrency"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"allTimeByCurrency"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]}}]} as unknown as DocumentNode<SpendingSummaryQuery, SpendingSummaryQueryVariables>;
export const TemplateTripIdForRouteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TemplateTripIdForRoute"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"routeId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"templateTripIdForRoute"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"routeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"routeId"}}}]}]}}]} as unknown as DocumentNode<TemplateTripIdForRouteQuery, TemplateTripIdForRouteQueryVariables>;
export const TripByShareTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TripByShareToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shareToken"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripByShareToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shareToken"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shareToken"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"coverImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"waypoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"periodOfDay"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"anonId"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}}]}}]}}]} as unknown as DocumentNode<TripByShareTokenQuery, TripByShareTokenQueryVariables>;
export const TripBySlugDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TripBySlug"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"country"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"region"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripBySlug"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"country"},"value":{"kind":"Variable","name":{"kind":"Name","value":"country"}}},{"kind":"Argument","name":{"kind":"Name","value":"region"},"value":{"kind":"Variable","name":{"kind":"Name","value":"region"}}},{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"dayCount"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"coverImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"isTemplate"}},{"kind":"Field","name":{"kind":"Name","value":"polyline"}},{"kind":"Field","name":{"kind":"Name","value":"startLat"}},{"kind":"Field","name":{"kind":"Name","value":"startLng"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGainM"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedDurationMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"surfaceType"}},{"kind":"Field","name":{"kind":"Name","value":"curvatureIndex"}},{"kind":"Field","name":{"kind":"Name","value":"isFeatured"}},{"kind":"Field","name":{"kind":"Name","value":"isMotovaultPick"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"cloneCount"}},{"kind":"Field","name":{"kind":"Name","value":"averageRating"}},{"kind":"Field","name":{"kind":"Name","value":"reviewCount"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"isFlagged"}},{"kind":"Field","name":{"kind":"Name","value":"clonedFromTripId"}},{"kind":"Field","name":{"kind":"Name","value":"forkedFromTripId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"waypoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"tripId"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"periodOfDay"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]} as unknown as DocumentNode<TripBySlugQuery, TripBySlugQueryVariables>;
export const TripDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TripDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripDetail"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"datesPending"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"coverImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"isTemplate"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"polyline"}},{"kind":"Field","name":{"kind":"Name","value":"startLat"}},{"kind":"Field","name":{"kind":"Name","value":"startLng"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGainM"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedDurationMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"surfaceType"}},{"kind":"Field","name":{"kind":"Name","value":"curvatureIndex"}},{"kind":"Field","name":{"kind":"Name","value":"dayCount"}},{"kind":"Field","name":{"kind":"Name","value":"isFeatured"}},{"kind":"Field","name":{"kind":"Name","value":"isMotovaultPick"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"cloneCount"}},{"kind":"Field","name":{"kind":"Name","value":"averageRating"}},{"kind":"Field","name":{"kind":"Name","value":"reviewCount"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"isFlagged"}},{"kind":"Field","name":{"kind":"Name","value":"isSaved"}},{"kind":"Field","name":{"kind":"Name","value":"clonedFromTripId"}},{"kind":"Field","name":{"kind":"Name","value":"forkedFromTripId"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"waypoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"tripId"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"periodOfDay"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"bikeId"}},{"kind":"Field","name":{"kind":"Name","value":"joinedAt"}}]}}]}}]}}]} as unknown as DocumentNode<TripDetailQuery, TripDetailQueryVariables>;
export const TripInvitesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TripInvites"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripInvites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"invitedUserId"}},{"kind":"Field","name":{"kind":"Name","value":"invitedAt"}},{"kind":"Field","name":{"kind":"Name","value":"acceptedAt"}},{"kind":"Field","name":{"kind":"Name","value":"declinedAt"}}]}}]}}]} as unknown as DocumentNode<TripInvitesQuery, TripInvitesQueryVariables>;
export const TripReviewsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TripReviews"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripReviews"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"conditionTags"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"tripId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"bikeId"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"bike"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"year"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]}}]}}]} as unknown as DocumentNode<TripReviewsQuery, TripReviewsQueryVariables>;
export const TripSuggestionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TripSuggestions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripSuggestions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"tripId"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"periodOfDay"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"decidedBy"}},{"kind":"Field","name":{"kind":"Name","value":"decidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"decidedNote"}},{"kind":"Field","name":{"kind":"Name","value":"waypointId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}}]}}]}}]}}]} as unknown as DocumentNode<TripSuggestionsQuery, TripSuggestionsQueryVariables>;
export const TripTemplatesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TripTemplates"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"TripTemplateFilterInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripTemplates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"dayCount"}},{"kind":"Field","name":{"kind":"Name","value":"startLat"}},{"kind":"Field","name":{"kind":"Name","value":"startLng"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGainM"}},{"kind":"Field","name":{"kind":"Name","value":"surfaceType"}},{"kind":"Field","name":{"kind":"Name","value":"polyline"}},{"kind":"Field","name":{"kind":"Name","value":"curvatureIndex"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedDurationMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"isFeatured"}},{"kind":"Field","name":{"kind":"Name","value":"isMotovaultPick"}},{"kind":"Field","name":{"kind":"Name","value":"coverImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"cloneCount"}},{"kind":"Field","name":{"kind":"Name","value":"averageRating"}},{"kind":"Field","name":{"kind":"Name","value":"reviewCount"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}}]} as unknown as DocumentNode<TripTemplatesQuery, TripTemplatesQueryVariables>;
export const UnreviewedReceiptScansDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UnreviewedReceiptScans"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unreviewedReceiptScans"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"scanId"}},{"kind":"Field","name":{"kind":"Name","value":"storagePath"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"result"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"vendor"}},{"kind":"Field","name":{"kind":"Name","value":"itemName"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"partsCost"}},{"kind":"Field","name":{"kind":"Name","value":"laborCost"}},{"kind":"Field","name":{"kind":"Name","value":"taxAmount"}},{"kind":"Field","name":{"kind":"Name","value":"taxRate"}},{"kind":"Field","name":{"kind":"Name","value":"lineItems"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"serviceType"}},{"kind":"Field","name":{"kind":"Name","value":"partRef"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPrice"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"Field","name":{"kind":"Name","value":"odometerValue"}},{"kind":"Field","name":{"kind":"Name","value":"odometerUnit"}},{"kind":"Field","name":{"kind":"Name","value":"fuelLitres"}},{"kind":"Field","name":{"kind":"Name","value":"partsNeeded"}},{"kind":"Field","name":{"kind":"Name","value":"legibilityNote"}},{"kind":"Field","name":{"kind":"Name","value":"needsCheck"}},{"kind":"Field","name":{"kind":"Name","value":"fieldConfidence"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"vendor"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"odometer"}}]}}]}}]}}]}}]} as unknown as DocumentNode<UnreviewedReceiptScansQuery, UnreviewedReceiptScansQueryVariables>;
export const ApproveMaintenanceDraftDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ApproveMaintenanceDraft"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ApproveMaintenanceDraftInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"approveMaintenanceDraft"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<ApproveMaintenanceDraftMutation, ApproveMaintenanceDraftMutationVariables>;
export const CreateBillingPortalSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateBillingPortalSession"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createBillingPortalSession"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]} as unknown as DocumentNode<CreateBillingPortalSessionMutation, CreateBillingPortalSessionMutationVariables>;
export const CreateBlogCategoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateBlogCategory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateBlogCategoryInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createBlogCategory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}}]}}]}}]} as unknown as DocumentNode<CreateBlogCategoryMutation, CreateBlogCategoryMutationVariables>;
export const CreateBlogKeywordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateBlogKeyword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateBlogKeywordInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createBlogKeyword"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<CreateBlogKeywordMutation, CreateBlogKeywordMutationVariables>;
export const CreateBlogPostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateBlogPost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateBlogPostInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createBlogPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BlogPostFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BlogPostFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BlogPost"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledFor"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"}},{"kind":"Field","name":{"kind":"Name","value":"coverAlt"}},{"kind":"Field","name":{"kind":"Name","value":"specData"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"typeData"}},{"kind":"Field","name":{"kind":"Name","value":"translations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"excerpt"}},{"kind":"Field","name":{"kind":"Name","value":"seoTitle"}},{"kind":"Field","name":{"kind":"Name","value":"seoDescription"}},{"kind":"Field","name":{"kind":"Name","value":"bodyRaw"}},{"kind":"Field","name":{"kind":"Name","value":"faq"}},{"kind":"Field","name":{"kind":"Name","value":"readingTime"}},{"kind":"Field","name":{"kind":"Name","value":"wordCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"keywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<CreateBlogPostMutation, CreateBlogPostMutationVariables>;
export const DeleteBlogPostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteBlogPost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteBlogPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteBlogPostMutation, DeleteBlogPostMutationVariables>;
export const PublishBlogPostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PublishBlogPost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publishBlogPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BlogPostFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BlogPostFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BlogPost"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledFor"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"}},{"kind":"Field","name":{"kind":"Name","value":"coverAlt"}},{"kind":"Field","name":{"kind":"Name","value":"specData"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"typeData"}},{"kind":"Field","name":{"kind":"Name","value":"translations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"excerpt"}},{"kind":"Field","name":{"kind":"Name","value":"seoTitle"}},{"kind":"Field","name":{"kind":"Name","value":"seoDescription"}},{"kind":"Field","name":{"kind":"Name","value":"bodyRaw"}},{"kind":"Field","name":{"kind":"Name","value":"faq"}},{"kind":"Field","name":{"kind":"Name","value":"readingTime"}},{"kind":"Field","name":{"kind":"Name","value":"wordCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"keywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<PublishBlogPostMutation, PublishBlogPostMutationVariables>;
export const RevertBlogPostVersionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RevertBlogPostVersion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"versionNum"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"revertBlogPostVersion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"versionNum"},"value":{"kind":"Variable","name":{"kind":"Name","value":"versionNum"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BlogPostFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BlogPostFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BlogPost"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledFor"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"}},{"kind":"Field","name":{"kind":"Name","value":"coverAlt"}},{"kind":"Field","name":{"kind":"Name","value":"specData"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"typeData"}},{"kind":"Field","name":{"kind":"Name","value":"translations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"excerpt"}},{"kind":"Field","name":{"kind":"Name","value":"seoTitle"}},{"kind":"Field","name":{"kind":"Name","value":"seoDescription"}},{"kind":"Field","name":{"kind":"Name","value":"bodyRaw"}},{"kind":"Field","name":{"kind":"Name","value":"faq"}},{"kind":"Field","name":{"kind":"Name","value":"readingTime"}},{"kind":"Field","name":{"kind":"Name","value":"wordCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"keywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<RevertBlogPostVersionMutation, RevertBlogPostVersionMutationVariables>;
export const ScheduleBlogPostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ScheduleBlogPost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ScheduleBlogPostInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"scheduleBlogPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BlogPostFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BlogPostFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BlogPost"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledFor"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"}},{"kind":"Field","name":{"kind":"Name","value":"coverAlt"}},{"kind":"Field","name":{"kind":"Name","value":"specData"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"typeData"}},{"kind":"Field","name":{"kind":"Name","value":"translations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"excerpt"}},{"kind":"Field","name":{"kind":"Name","value":"seoTitle"}},{"kind":"Field","name":{"kind":"Name","value":"seoDescription"}},{"kind":"Field","name":{"kind":"Name","value":"bodyRaw"}},{"kind":"Field","name":{"kind":"Name","value":"faq"}},{"kind":"Field","name":{"kind":"Name","value":"readingTime"}},{"kind":"Field","name":{"kind":"Name","value":"wordCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"keywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<ScheduleBlogPostMutation, ScheduleBlogPostMutationVariables>;
export const UnpublishBlogPostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnpublishBlogPost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unpublishBlogPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BlogPostFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BlogPostFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BlogPost"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledFor"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"}},{"kind":"Field","name":{"kind":"Name","value":"coverAlt"}},{"kind":"Field","name":{"kind":"Name","value":"specData"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"typeData"}},{"kind":"Field","name":{"kind":"Name","value":"translations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"excerpt"}},{"kind":"Field","name":{"kind":"Name","value":"seoTitle"}},{"kind":"Field","name":{"kind":"Name","value":"seoDescription"}},{"kind":"Field","name":{"kind":"Name","value":"bodyRaw"}},{"kind":"Field","name":{"kind":"Name","value":"faq"}},{"kind":"Field","name":{"kind":"Name","value":"readingTime"}},{"kind":"Field","name":{"kind":"Name","value":"wordCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"keywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<UnpublishBlogPostMutation, UnpublishBlogPostMutationVariables>;
export const UpdateBlogPostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateBlogPost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateBlogPostInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateBlogPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BlogPostFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BlogPostFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BlogPost"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledFor"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"}},{"kind":"Field","name":{"kind":"Name","value":"coverAlt"}},{"kind":"Field","name":{"kind":"Name","value":"specData"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"typeData"}},{"kind":"Field","name":{"kind":"Name","value":"translations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"excerpt"}},{"kind":"Field","name":{"kind":"Name","value":"seoTitle"}},{"kind":"Field","name":{"kind":"Name","value":"seoDescription"}},{"kind":"Field","name":{"kind":"Name","value":"bodyRaw"}},{"kind":"Field","name":{"kind":"Name","value":"faq"}},{"kind":"Field","name":{"kind":"Name","value":"readingTime"}},{"kind":"Field","name":{"kind":"Name","value":"wordCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"keywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<UpdateBlogPostMutation, UpdateBlogPostMutationVariables>;
export const AdminBlogPostVersionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AdminBlogPostVersions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminBlogPostVersions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"versionNum"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdBy"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<AdminBlogPostVersionsQuery, AdminBlogPostVersionsQueryVariables>;
export const AdminBlogPostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AdminBlogPost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminBlogPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BlogPostFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BlogPostFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BlogPost"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledFor"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"}},{"kind":"Field","name":{"kind":"Name","value":"coverAlt"}},{"kind":"Field","name":{"kind":"Name","value":"specData"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"typeData"}},{"kind":"Field","name":{"kind":"Name","value":"translations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"excerpt"}},{"kind":"Field","name":{"kind":"Name","value":"seoTitle"}},{"kind":"Field","name":{"kind":"Name","value":"seoDescription"}},{"kind":"Field","name":{"kind":"Name","value":"bodyRaw"}},{"kind":"Field","name":{"kind":"Name","value":"faq"}},{"kind":"Field","name":{"kind":"Name","value":"readingTime"}},{"kind":"Field","name":{"kind":"Name","value":"wordCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"keywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<AdminBlogPostQuery, AdminBlogPostQueryVariables>;
export const AdminBlogPostsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AdminBlogPosts"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ListBlogPostsInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminBlogPosts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BlogPostFields"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BlogPostFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BlogPost"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledFor"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"}},{"kind":"Field","name":{"kind":"Name","value":"coverAlt"}},{"kind":"Field","name":{"kind":"Name","value":"specData"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"typeData"}},{"kind":"Field","name":{"kind":"Name","value":"translations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"excerpt"}},{"kind":"Field","name":{"kind":"Name","value":"seoTitle"}},{"kind":"Field","name":{"kind":"Name","value":"seoDescription"}},{"kind":"Field","name":{"kind":"Name","value":"bodyRaw"}},{"kind":"Field","name":{"kind":"Name","value":"faq"}},{"kind":"Field","name":{"kind":"Name","value":"readingTime"}},{"kind":"Field","name":{"kind":"Name","value":"wordCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"keywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<AdminBlogPostsQuery, AdminBlogPostsQueryVariables>;
export const BlogTaxonomyDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BlogTaxonomy"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminBlogCategories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"adminBlogKeywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<BlogTaxonomyQuery, BlogTaxonomyQueryVariables>;
export const BrowseCountriesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BrowseCountries"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"browseCountries"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BrowsePlaceFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BrowsePlaceFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BrowsePlace"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"routeCount"}}]}}]} as unknown as DocumentNode<BrowseCountriesQuery, BrowseCountriesQueryVariables>;
export const BrowseCountryBySlugDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BrowseCountryBySlug"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"browseCountryBySlug"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BrowsePlaceFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BrowsePlaceFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BrowsePlace"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"routeCount"}}]}}]} as unknown as DocumentNode<BrowseCountryBySlugQuery, BrowseCountryBySlugQueryVariables>;
export const BrowseRegionsByCountrySlugDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BrowseRegionsByCountrySlug"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"countrySlug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"browseRegionsByCountrySlug"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"countrySlug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"countrySlug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BrowsePlaceFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BrowsePlaceFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BrowsePlace"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"routeCount"}}]}}]} as unknown as DocumentNode<BrowseRegionsByCountrySlugQuery, BrowseRegionsByCountrySlugQueryVariables>;
export const BrowseExploreRegionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BrowseExploreRegion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"countrySlug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"regionSlug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"browseExploreRegion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"countrySlug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"countrySlug"}}},{"kind":"Argument","name":{"kind":"Name","value":"regionSlug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"regionSlug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"country"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BrowsePlaceFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"region"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BrowsePlaceFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BrowsePlaceFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BrowsePlace"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"routeCount"}}]}}]} as unknown as DocumentNode<BrowseExploreRegionQuery, BrowseExploreRegionQueryVariables>;
export const GetGpxQuotaStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetGPXQuotaStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getGPXQuotaStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feature"}},{"kind":"Field","name":{"kind":"Name","value":"limit"}},{"kind":"Field","name":{"kind":"Name","value":"used"}},{"kind":"Field","name":{"kind":"Name","value":"remaining"}},{"kind":"Field","name":{"kind":"Name","value":"resetDate"}},{"kind":"Field","name":{"kind":"Name","value":"isExhausted"}}]}}]}}]} as unknown as DocumentNode<GetGpxQuotaStatusQuery, GetGpxQuotaStatusQueryVariables>;
export const GetTrialEligibilityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetTrialEligibility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"hasUsedTrial"}}]}}]}}]} as unknown as DocumentNode<GetTrialEligibilityQuery, GetTrialEligibilityQueryVariables>;
export const MaintenanceDraftReviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MaintenanceDraftReview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maintenanceDraftReview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"schedules"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"variant"}},{"kind":"Field","name":{"kind":"Name","value":"taskName"}},{"kind":"Field","name":{"kind":"Name","value":"intervalKm"}},{"kind":"Field","name":{"kind":"Name","value":"intervalDays"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"sourcePage"}},{"kind":"Field","name":{"kind":"Name","value":"sourceContext"}},{"kind":"Field","name":{"kind":"Name","value":"sourceTitle"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"specs"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"variant"}},{"kind":"Field","name":{"kind":"Name","value":"specType"}},{"kind":"Field","name":{"kind":"Name","value":"specName"}},{"kind":"Field","name":{"kind":"Name","value":"valueNumeric"}},{"kind":"Field","name":{"kind":"Name","value":"valueDisplay"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"sourcePage"}},{"kind":"Field","name":{"kind":"Name","value":"sourceContext"}},{"kind":"Field","name":{"kind":"Name","value":"sourceTitle"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]} as unknown as DocumentNode<MaintenanceDraftReviewQuery, MaintenanceDraftReviewQueryVariables>;
export const MyRideCountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyRideCount"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myRides"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<MyRideCountQuery, MyRideCountQueryVariables>;
export const PublicSavedTripsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PublicSavedTrips"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"handle"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publicSavedTrips"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"handle"},"value":{"kind":"Variable","name":{"kind":"Name","value":"handle"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGainM"}},{"kind":"Field","name":{"kind":"Name","value":"surfaceType"}},{"kind":"Field","name":{"kind":"Name","value":"isMotovaultPick"}},{"kind":"Field","name":{"kind":"Name","value":"averageRating"}},{"kind":"Field","name":{"kind":"Name","value":"reviewCount"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}}]} as unknown as DocumentNode<PublicSavedTripsQuery, PublicSavedTripsQueryVariables>;
export const SitemapPublishedTripsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SitemapPublishedTrips"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sitemapPublishedTrips"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<SitemapPublishedTripsQuery, SitemapPublishedTripsQueryVariables>;
export const WebTripBySlugDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WebTripBySlug"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"country"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"region"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripBySlug"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"country"},"value":{"kind":"Variable","name":{"kind":"Name","value":"country"}}},{"kind":"Argument","name":{"kind":"Name","value":"region"},"value":{"kind":"Variable","name":{"kind":"Name","value":"region"}}},{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"dayCount"}},{"kind":"Field","name":{"kind":"Name","value":"startLat"}},{"kind":"Field","name":{"kind":"Name","value":"startLng"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGainM"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedDurationMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"surfaceType"}},{"kind":"Field","name":{"kind":"Name","value":"isFeatured"}},{"kind":"Field","name":{"kind":"Name","value":"isMotovaultPick"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"polyline"}},{"kind":"Field","name":{"kind":"Name","value":"cloneCount"}},{"kind":"Field","name":{"kind":"Name","value":"averageRating"}},{"kind":"Field","name":{"kind":"Name","value":"reviewCount"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}}]}},{"kind":"Field","name":{"kind":"Name","value":"waypoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}}]}}]}}]}}]} as unknown as DocumentNode<WebTripBySlugQuery, WebTripBySlugQueryVariables>;
export const WebTripPathByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WebTripPathById"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripDetail"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]} as unknown as DocumentNode<WebTripPathByIdQuery, WebTripPathByIdQueryVariables>;
export const WebTripReviewsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WebTripReviews"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"country"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"region"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripReviews"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"country"},"value":{"kind":"Variable","name":{"kind":"Name","value":"country"}}},{"kind":"Argument","name":{"kind":"Name","value":"region"},"value":{"kind":"Variable","name":{"kind":"Name","value":"region"}}},{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"conditionTags"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"bike"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"year"}}]}}]}}]}}]} as unknown as DocumentNode<WebTripReviewsQuery, WebTripReviewsQueryVariables>;